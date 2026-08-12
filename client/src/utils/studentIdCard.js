import QRCode from 'qrcode';
import { resolveFileUrl } from './fileUrl';

// Renders the logged-in Student's ID card(s) entirely on an offscreen
// <canvas> and downloads them as PNGs — same rendering approach and exact
// same visual language as utils/trainerIdCard.js (colors, layout, QR
// placement) so the two cards read as a matching pair from the same
// institute; deliberately duplicated rather than shared, matching this
// codebase's existing precedent of small per-portal files over a forced
// shared abstraction across the Trainer/Student portal boundary.
//
// Card is portrait/vertical (not the old landscape layout) and one
// separate card is generated per enrolled course — a student enrolled in
// two courses downloads two PNGs, each carrying that course's own roll
// number/batch, not a single card listing every course.
const COLORS = {
  headerFrom: '#1a4f7a',
  headerTo: '#2877b9',
  text: '#1e293b',
  subtext: '#64748b',
  faint: '#94a3b8',
  badgeBg: '#f2f8fc',
  badgeText: '#216297',
  ring: '#2877b9',
  border: '#e2e8f0',
  avatarBg: '#e2eef9',
  avatarText: '#216297',
};

// Card geometry — width is fixed (a real portrait ID card's proportions);
// height is NOT — it's derived per card by rendering once on a throwaway
// canvas to measure how tall the content actually is (see
// renderCardToBlob), then re-rendered for real at that exact height. That
// is what keeps every card fitting its own portrait canvas precisely,
// however many detail rows/lines it ends up needing, with nothing ever
// clipped or leaving dead space.
const CARD_WIDTH = 380;
const CARD_SCALE = 2;
const CARD_PADDING = 18;
const HEADER_HEIGHT = 96;
const PHOTO_RADIUS = 44;

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawImageCover(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx, sy, sw, sh;
  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = sh * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawAvatar(ctx, img, name, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    drawImageCover(ctx, img, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = COLORS.avatarBg;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = COLORS.avatarText;
    ctx.font = `700 ${Math.round(r)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initial = name?.trim() ? name.trim().charAt(0).toUpperCase() : '?';
    ctx.fillText(initial, cx, cy + 1);
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.ring;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !current) {
      current = test;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);

  const usedWordCount = lines.join(' ').split(' ').length;
  const truncated = usedWordCount < words.length;

  if (truncated && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last}…`;
  }

  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

// Single-line variant for centered text (name/title) — truncates with an
// ellipsis instead of wrapping, since it's drawn centered on one line.
function drawCenteredEllipsis(ctx, text, cx, y, maxWidth) {
  let t = text;
  if (ctx.measureText(t).width > maxWidth) {
    while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) {
      t = t.slice(0, -1);
    }
    t = `${t}…`;
  }
  ctx.fillText(t, cx, y);
}

// The QR payload — small, structured JSON (not the freeform display text
// the Trainer card uses, since THIS QR is actually parsed back
// programmatically by markOwnAttendanceViaQr in
// studentPortal.controller.js). `type` must exactly match STUDENT_QR_TYPE
// there. Never anything sensitive (no password/token) — just enough for the
// server to confirm "this card belongs to the student currently scanning
// it", the same non-auth-payload spirit the Trainer card's own comment
// documents. Student-level (not per-course), so it's generated once and
// reused across every course card below.
const STUDENT_QR_TYPE = 'titan-student-id-card';

function buildQrPayload(profile) {
  return JSON.stringify({
    type: STUDENT_QR_TYPE,
    studentId: profile.studentId,
    name: profile.name,
  });
}

function sanitizeFileName(value) {
  return (value || 'student').replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// Draws the full card top-to-bottom into `ctx` and returns the Y-coordinate
// of its final drawn pixel (the content height). Called twice per card by
// renderCardToBlob: once on a scratch canvas purely to measure that
// content height (drawBackground: false — no point painting a background
// that's about to be thrown away), then again on a canvas sized exactly to
// the result to actually produce the PNG. Because the draw calls are the
// same both times, the measured height and the real card always agree —
// nothing is ever clipped and there's never dead space at the bottom.
function drawStudentCard(ctx, { width, height, drawBackground }, { avatarImg, crestImg, qrImg, profile, enrollment }) {
  if (drawBackground) {
    ctx.save();
    roundedRectPath(ctx, 0, 0, width, height, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.clip();
  }

  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, COLORS.headerFrom);
  gradient.addColorStop(1, COLORS.headerTo);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, HEADER_HEIGHT);

  const centerX = width / 2;
  const crestSize = 36;
  if (crestImg) ctx.drawImage(crestImg, centerX - crestSize / 2, 14, crestSize, crestSize);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 17px Arial, sans-serif';
  ctx.fillText('TITAN INSTITUTE', centerX, 14 + crestSize + 18);
  ctx.fillStyle = '#e2eef9';
  ctx.font = '600 10px Arial, sans-serif';
  ctx.fillText('STUDENT IDENTIFICATION CARD', centerX, 14 + crestSize + 32);

  const photoCX = centerX;
  const photoCY = HEADER_HEIGHT + CARD_PADDING + PHOTO_RADIUS;
  drawAvatar(ctx, avatarImg, profile.name, photoCX, photoCY, PHOTO_RADIUS);

  ctx.font = '700 12px Arial, sans-serif';
  const badgeText = enrollment?.rollNumber || '—';
  const badgeTextWidth = ctx.measureText(badgeText).width;
  const badgeW = badgeTextWidth + 20;
  const badgeH = 22;
  const badgeX = photoCX - badgeW / 2;
  const badgeY = photoCY + PHOTO_RADIUS + 12;
  roundedRectPath(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fillStyle = COLORS.badgeBg;
  ctx.fill();
  ctx.fillStyle = COLORS.badgeText;
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, photoCX, badgeY + badgeH / 2 + 4);

  let cursorY = badgeY + badgeH + 22;

  ctx.fillStyle = COLORS.text;
  ctx.font = '700 19px Arial, sans-serif';
  ctx.textAlign = 'center';
  drawCenteredEllipsis(ctx, profile.name || 'Student', photoCX, cursorY, width - CARD_PADDING * 2);
  cursorY += 8;

  ctx.font = '700 10px Arial, sans-serif';
  const tag = 'STUDENT';
  const tagW = ctx.measureText(tag).width + 16;
  roundedRectPath(ctx, photoCX - tagW / 2, cursorY, tagW, 18, 9);
  ctx.fillStyle = COLORS.badgeBg;
  ctx.fill();
  ctx.fillStyle = COLORS.badgeText;
  ctx.fillText(tag, photoCX, cursorY + 13);
  cursorY += 18 + 18;

  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CARD_PADDING, cursorY);
  ctx.lineTo(width - CARD_PADDING, cursorY);
  ctx.stroke();
  cursorY += 18;

  ctx.textAlign = 'left';
  const colX = CARD_PADDING;
  const colMaxWidth = width - CARD_PADDING * 2;
  const detailRow = (label, value) => {
    ctx.fillStyle = COLORS.faint;
    ctx.font = '600 9px Arial, sans-serif';
    ctx.fillText(label.toUpperCase(), colX, cursorY);
    cursorY += 12;
    ctx.fillStyle = COLORS.text;
    ctx.font = '500 13px Arial, sans-serif';
    cursorY = drawWrappedText(ctx, value, colX, cursorY, colMaxWidth, 16, 2);
    cursorY += 12;
  };

  // Email is deliberately never shown on the card — course/roll details
  // only.
  detailRow('Course', enrollment?.courseName || 'Not enrolled yet');
  if (enrollment) detailRow('Batch', enrollment.batchCode || '—');

  cursorY += 4;

  const qrSize = 116;
  const qrX = photoCX - qrSize / 2;
  const qrY = cursorY;
  if (qrImg) {
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(qrX, qrY, qrSize, qrSize);
    cursorY = qrY + qrSize + 14;
    ctx.fillStyle = COLORS.faint;
    ctx.font = '500 9px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Scan for attendance', photoCX, cursorY);
    cursorY += 18;
  }

  ctx.strokeStyle = COLORS.border;
  ctx.beginPath();
  ctx.moveTo(CARD_PADDING, cursorY);
  ctx.lineTo(width - CARD_PADDING, cursorY);
  ctx.stroke();
  cursorY += 14;
  ctx.fillStyle = COLORS.faint;
  ctx.font = '500 9px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Property of TITAN Institute • Issued ${new Date().toLocaleDateString()}`, photoCX, cursorY);
  cursorY += CARD_PADDING;

  if (drawBackground) {
    ctx.restore();
    roundedRectPath(ctx, 0.5, 0.5, width - 1, height - 1, 16);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  return cursorY;
}

async function renderCardToBlob(assets, drawFn) {
  // Pass 1 — measure. Canvas size here is irrelevant (nothing from it is
  // ever exported); only the returned content height is used.
  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = CARD_WIDTH;
  measureCanvas.height = 10;
  const measureCtx = measureCanvas.getContext('2d');
  const contentHeight = drawFn(measureCtx, { width: CARD_WIDTH, height: 10, drawBackground: false }, assets);

  // Pass 2 — render for real at exactly the measured height.
  const height = Math.ceil(contentHeight);
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH * CARD_SCALE;
  canvas.height = height * CARD_SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(CARD_SCALE, CARD_SCALE);
  drawFn(ctx, { width: CARD_WIDTH, height, drawBackground: true }, assets);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Failed to render the ID card.');
  return blob;
}

function downloadBlob(blob, fileName) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

// @param profile  studentPortalApi.getMyProfile()'s own response shape
//                 (name/email/profilePicture/studentId/enrollments).
export async function downloadStudentIdCard(profile) {
  if (!profile?.studentId) {
    throw new Error('Student profile is not available yet.');
  }

  const [avatarImg, crestImg, qrDataUrl] = await Promise.all([
    loadImage(resolveFileUrl(profile.profilePicture)),
    loadImage(`/favicon-crest.png?v=1`),
    QRCode.toDataURL(buildQrPayload(profile), {
      margin: 1,
      width: 240,
      color: { dark: COLORS.headerFrom, light: '#ffffff' },
    }),
  ]);
  const qrImg = await loadImage(qrDataUrl);

  // One card per enrolled course — a student enrolled in more than one
  // course downloads one separate, correctly-labeled card per course
  // instead of a single card listing every course. A student with no
  // enrollments still gets exactly one fallback card (same as previous
  // single-card behavior), so `enrollment` is `null` in that case.
  const enrollments = profile.enrollments?.length ? profile.enrollments : [null];

  for (let i = 0; i < enrollments.length; i++) {
    const enrollment = enrollments[i];
    const blob = await renderCardToBlob({ avatarImg, crestImg, qrImg, profile, enrollment }, drawStudentCard);
    const suffix = enrollment?.courseName ? `-${sanitizeFileName(enrollment.courseName)}` : '';
    const fileName = `TITAN-Student-ID-${sanitizeFileName(enrollment?.rollNumber || profile.name)}${suffix}.png`;
    downloadBlob(blob, fileName);
    // Stagger multi-file downloads slightly — firing several a[download]
    // clicks in the same tick is what makes browsers start treating the
    // later ones as blocked popups instead of separate downloads.
    if (i < enrollments.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
}
