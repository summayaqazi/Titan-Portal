import QRCode from 'qrcode';
import { resolveFileUrl } from './fileUrl';

// Renders the logged-in Trainer's ID card entirely on an offscreen <canvas>
// and downloads it as a PNG. Canvas (not html2canvas over the live DOM) is
// used deliberately: it can't produce a half-rendered/blank capture from a
// slow-loading image or web font, every asset (photo, QR, crest) is loaded
// and confirmed *before* a single pixel is drawn, and a failed/missing
// photo falls back to an initials avatar instead of ever leaving a broken
// image on the card. Colors below mirror the app's primary-* palette
// (client/src/index.css) so the card matches the rest of the UI.
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
// text doesn't fit — so a trainer with an unusually long course/campus list
// can never stretch or overflow the fixed-size card.
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

// Builds a small, non-sensitive verification payload — never a password or
// anything auth-related, per the ID card spec.
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

// @param user  The logged-in trainer's user object (AuthContext shape:
//              name/email/avatar + trainerProfile from /auth/me or /auth/login).
export async function downloadTrainerIdCard(user) {
  const trainerProfile = user?.trainerProfile;
  if (!trainerProfile) {
    throw new Error('Trainer profile is not available yet.');
  }

  const scale = 2;
  const width = 540;
  const height = 340;
  const padding = 18;
  const headerHeight = 72;
  const footerHeight = 26;

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

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Card base + clip so every element below (including the header band)
  // respects the rounded corners.
  ctx.save();
  roundedRectPath(ctx, 0, 0, width, height, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.clip();

  // Header band
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, COLORS.headerFrom);
  gradient.addColorStop(1, COLORS.headerTo);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, headerHeight);

  const crestSize = 44;
  const crestX = padding;
  const crestY = (headerHeight - crestSize) / 2;
  if (crestImg) ctx.drawImage(crestImg, crestX, crestY, crestSize, crestSize);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 18px Arial, sans-serif';
  ctx.fillText('TITAN INSTITUTE', crestX + crestSize + 12, headerHeight / 2 - 3);
  ctx.fillStyle = '#e2eef9';
  ctx.font = '600 11px Arial, sans-serif';
  ctx.fillText('TRAINER IDENTIFICATION CARD', crestX + crestSize + 12, headerHeight / 2 + 15);

  // Photo
  const photoR = 46;
  const photoCX = padding + photoR;
  const photoCY = headerHeight + padding + photoR;
  drawAvatar(ctx, avatarImg, user?.name, photoCX, photoCY, photoR);

  // Employee ID badge under the photo
  ctx.font = '700 12px Arial, sans-serif';
  const badgeText = trainerProfile.employeeId || '—';
  const badgeTextWidth = ctx.measureText(badgeText).width;
  const badgeW = badgeTextWidth + 20;
  const badgeH = 22;
  const badgeX = photoCX - badgeW / 2;
  const badgeY = photoCY + photoR + 14;
  roundedRectPath(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fillStyle = COLORS.badgeBg;
  ctx.fill();
  ctx.fillStyle = COLORS.badgeText;
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, photoCX, badgeY + badgeH / 2 + 4);
  ctx.textAlign = 'left';

  // QR code (reserved on the right, right column text is capped to its
  // left edge so no combination of name/course/campus length can ever
  // overlap it).
  const qrSize = 88;
  const qrX = width - padding - qrSize;
  const qrY = height - footerHeight - qrSize - 12;
  if (qrImg) {
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(qrX, qrY, qrSize, qrSize);
    ctx.fillStyle = COLORS.faint;
    ctx.font = '500 9px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Scan to verify', qrX + qrSize / 2, qrY + qrSize + 12);
    ctx.textAlign = 'left';
  }

  // Right column: name, role tag, and key details
  const colX = photoCX + photoR + 24;
  const colMaxWidth = qrX - colX - 14;
  let cursorY = headerHeight + padding + 20;

  ctx.fillStyle = COLORS.text;
  ctx.font = '700 20px Arial, sans-serif';
  cursorY = drawWrappedText(ctx, user?.name || 'Trainer', colX, cursorY, colMaxWidth, 22, 1);

  cursorY += 6;
  ctx.font = '700 10px Arial, sans-serif';
  const tag = 'TRAINER';
  const tagW = ctx.measureText(tag).width + 16;
  roundedRectPath(ctx, colX, cursorY - 12, tagW, 18, 9);
  ctx.fillStyle = COLORS.badgeBg;
  ctx.fill();
  ctx.fillStyle = COLORS.badgeText;
  ctx.fillText(tag, colX + 8, cursorY + 1);
  cursorY += 18;

  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(colX, cursorY);
  ctx.lineTo(colX + colMaxWidth, cursorY);
  ctx.stroke();
  cursorY += 18;

  const detailRow = (label, value) => {
    ctx.fillStyle = COLORS.faint;
    ctx.font = '600 9px Arial, sans-serif';
    ctx.fillText(label.toUpperCase(), colX, cursorY);
    cursorY += 13;
    ctx.fillStyle = COLORS.text;
    ctx.font = '500 12px Arial, sans-serif';
    cursorY = drawWrappedText(ctx, value, colX, cursorY, colMaxWidth, 15, 2);
    cursorY += 10;
  };

  const courseNames = (trainerProfile.courses || []).map((c) => c.name).filter(Boolean);
  detailRow('Assigned Course(s)', courseNames.length ? courseNames.join(', ') : 'Not assigned yet');

  const campusNames = (trainerProfile.campuses || []).map((c) => c.name).filter(Boolean);
  detailRow('Campus', campusNames.length ? campusNames.join(', ') : '—');

  if (trainerProfile.qualification) {
    detailRow('Qualification', trainerProfile.qualification);
  }

  // Footer
  const footerY = height - footerHeight;
  ctx.strokeStyle = COLORS.border;
  ctx.beginPath();
  ctx.moveTo(padding, footerY);
  ctx.lineTo(width - padding, footerY);
  ctx.stroke();
  ctx.fillStyle = COLORS.faint;
  ctx.font = '500 9px Arial, sans-serif';
  ctx.fillText(
    `Property of TITAN Institute • Issued ${new Date().toLocaleDateString()}`,
    padding,
    footerY + 16
  );

  ctx.restore();

  // Outer border, drawn after restore() so it sits on top, unclipped.
  roundedRectPath(ctx, 0.5, 0.5, width - 1, height - 1, 16);
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Failed to render the ID card.');

  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `TITAN-Trainer-ID-${sanitizeFileName(trainerProfile.employeeId || user?.name)}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}
