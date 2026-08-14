import QRCode from 'qrcode';
import { resolveFileUrl } from './fileUrl';

// Renders the logged-in Trainer's ID card(s) entirely on an offscreen
// <canvas> and downloads them as PNGs. Canvas (not html2canvas over the
// live DOM) is used deliberately: it can't produce a half-rendered/blank
// capture from a slow-loading image or web font, every asset (photo, QR,
// crest) is loaded and confirmed *before* a single pixel is drawn, and a
// failed/missing photo falls back to an initials avatar instead of ever
// leaving a broken image on the card. Colors below mirror the app's
// primary-* palette (client/src/index.css) so the card matches the rest of
// the UI.
//
// Card is portrait/vertical (not the old landscape layout) and one
// separate card is generated per assigned course — a trainer assigned to
// two courses downloads two PNGs, each carrying that course's own
// name/code, not a single card listing every course.
const COLORS = {
  headerFrom: '#1a4f7a', // primary-800
  headerTo: '#2877b9', // primary-600
  text: '#1e293b', // slate-800
  subtext: '#64748b', // slate-500
  faint: '#94a3b8', // slate-400
  badgeBg: '#f2f8fc', // primary-50
  badgeText: '#216297', // primary-700
  ring: '#2877b9', // primary-600
  border: '#e2e8f0', // slate-200
  avatarBg: '#e2eef9', // primary-100
  avatarText: '#216297', // primary-700
};

// Card geometry — width is fixed (a real portrait ID card's proportions);
// height is NOT — it's derived per card by rendering once on a throwaway
// canvas to measure how tall the content actually is (see
// renderCardToBlob), then re-rendered for real at that exact height. That
// is what keeps every card fitting its own portrait canvas precisely,
// however many detail rows/lines it ends up needing (course code, campus
// list, optional qualification), with nothing ever clipped or leaving dead
// space.
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

// Same "image if present, else initials" rule as the shared Avatar
// component (client/src/components/common/Avatar.jsx) — a trainer without
// a photo yet never gets a random/default picture or a broken-image icon.
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

// Greedy word-wrap capped at `maxLines`, ellipsizing the final line if the
// text doesn't fit — so a trainer with an unusually long course/campus name
// can never stretch or overflow the card.
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

// Builds a small, non-sensitive verification payload — never a password or
// anything auth-related, per the ID card spec. Trainer-level (not
// per-course), so it's generated once and reused across every course card
// below.
function buildQrPayload(user, trainerProfile) {
  const lines = [
    'TITAN Institute — Trainer ID',
    `Name: ${user?.name || ''}`,
    `Employee ID: ${trainerProfile?.employeeId || ''}`,
    `Trainer Ref: ${trainerProfile?.trainerId || ''}`,
  ];
  return lines.join('\n');
}

function sanitizeFileName(value) {
  return (value || 'trainer').replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// Draws the full card top-to-bottom into `ctx` and returns the Y-coordinate
// of its final drawn pixel (the content height). Called twice per card by
// renderCardToBlob: once on a scratch canvas purely to measure that
// content height (drawBackground: false — no point painting a background
// that's about to be thrown away), then again on a canvas sized exactly to
// the result to actually produce the PNG. Because the draw calls are the
// same both times, the measured height and the real card always agree —
// nothing is ever clipped and there's never dead space at the bottom.
function drawTrainerCard(ctx, { width, height, drawBackground }, { avatarImg, crestImg, qrImg, user, trainerProfile, course }) {
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
  ctx.fillText('TRAINER IDENTIFICATION CARD', centerX, 14 + crestSize + 32);

  // Photo
  const photoCX = centerX;
  const photoCY = HEADER_HEIGHT + CARD_PADDING + PHOTO_RADIUS;
  drawAvatar(ctx, avatarImg, user?.name, photoCX, photoCY, PHOTO_RADIUS);

  // Employee ID badge under the photo
  ctx.font = '700 12px Arial, sans-serif';
  const badgeText = trainerProfile.employeeId || '—';
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
  drawCenteredEllipsis(ctx, user?.name || 'Trainer', photoCX, cursorY, width - CARD_PADDING * 2);
  cursorY += 8;

  ctx.font = '700 10px Arial, sans-serif';
  const tag = 'TRAINER';
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

  // Detail rows: this course, its code, the trainer's assigned campus(es)
  // (campuses aren't mapped per-course in the data model, so this stays
  // the trainer's full campus list on every one of their course cards,
  // same as it was on the single combined card), then qualification if set.
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

  // Email is deliberately never shown on the card — course/employee
  // details only.
  detailRow('Course', course?.name || 'Not assigned yet');
  if (course?.code) detailRow('Course Code', course.code);

  const campusNames = (trainerProfile.campuses || []).map((c) => c.name).filter(Boolean);
  detailRow('Campus', campusNames.length ? campusNames.join(', ') : '—');

  if (trainerProfile.qualification) {
    detailRow('Qualification', trainerProfile.qualification);
  }

  cursorY += 4;

  // QR code
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
    ctx.fillText('Scan to verify', photoCX, cursorY);
    cursorY += 18;
  }

  // Footer
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
    // Outer border, drawn after restore() so it sits on top, unclipped.
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

// @param user  The logged-in trainer's user object (AuthContext shape:
//              name/email/avatar + trainerProfile from /auth/me or /auth/login).
export async function downloadTrainerIdCard(user) {
  const trainerProfile = user?.trainerProfile;
  if (!trainerProfile) {
    throw new Error('Trainer profile is not available yet.');
  }

  const [avatarImg, crestImg, qrDataUrl] = await Promise.all([
    loadImage(resolveFileUrl(user?.avatar)),
    loadImage(`/favicon-crest.png?v=1`),
    QRCode.toDataURL(buildQrPayload(user, trainerProfile), {
      margin: 1,
      width: 240,
      color: { dark: COLORS.headerFrom, light: '#ffffff' },
    }),
  ]);
  const qrImg = await loadImage(qrDataUrl);

  // One card per assigned course — a trainer assigned to more than one
  // course downloads one separate, correctly-labeled card per course
  // instead of a single card listing every course. A trainer with no
  // assigned courses still gets exactly one fallback card (same as the
  // previous single-card behavior), so `course` is `null` in that case.
  const courses = trainerProfile.courses?.length ? trainerProfile.courses : [null];

  for (let i = 0; i < courses.length; i++) {
    const course = courses[i];
    const blob = await renderCardToBlob({ avatarImg, crestImg, qrImg, user, trainerProfile, course }, drawTrainerCard);
    const suffix = course?.name ? `-${sanitizeFileName(course.name)}` : '';
    const fileName = `TITAN-Trainer-ID-${sanitizeFileName(trainerProfile.employeeId || user?.name)}${suffix}.png`;
    downloadBlob(blob, fileName);
    // Stagger multi-file downloads slightly — firing several a[download]
    // clicks in the same tick is what makes browsers start treating the
    // later ones as blocked popups instead of separate downloads.
    if (i < courses.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
}
