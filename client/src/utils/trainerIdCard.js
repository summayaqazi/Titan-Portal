import QRCode from 'qrcode';
import { resolveFileUrl } from './fileUrl';

// Renders the logged-in Trainer's ID card(s) entirely on an offscreen
// <canvas> and downloads them as PNGs. Canvas (not html2canvas over the
// live DOM) is used deliberately: it can't produce a half-rendered/blank
// capture from a slow-loading image or web font, every asset (photo, QR,
// crest) is loaded and confirmed *before* a single pixel is drawn, and a
// failed/missing photo falls back to an initials avatar instead of ever
// leaving a broken image on the card.
//
// Visual design: dark navy-blue / white / gold, matching the portal's own
// theme (COLORS below are drawn straight from the shared --color-sidebar*
// tokens in index.css — the exact navy already used for the Admin/Super
// Admin/Trainer portal's own navbar — plus a gold accent for the crest/
// badges/dividers), not an invented palette. Same ornate header (wave-
// bottom navy band, gold-bordered crest, gold subtitle), photo ring, ID/
// role badges, icon-led info panel, QR block, and navy footer band as the
// Student ID card (utils/studentIdCard.js) — the two are meant to read as
// a matching pair from the same institute, so any visual change here
// should be mirrored there and vice versa. Deliberately duplicated rather
// than shared, matching this codebase's existing precedent of small
// per-portal files over a forced shared abstraction across the Trainer/
// Student portal boundary.
//
// Card is portrait/vertical and one separate card is generated per
// assigned course — a trainer assigned to two courses downloads two PNGs,
// each carrying that course's own name/code, not a single card listing
// every course.
const COLORS = {
  navy: '#0d1330', // --color-sidebar
  navyDark: '#0a0f24', // --color-sidebar-header
  navyLight: '#1a2249', // --color-sidebar-hover
  gold: '#9c7a3d', // --color-sidebar-active
  goldLight: '#c9a961', // lighter highlight derived from the same gold, for gradients/borders only
  text: '#0d1330', // name/value text — the same navy as the header, not plain black
  subtext: '#64748b', // slate-500
  faint: '#94a3b8', // slate-400
  border: '#e2e8f0', // slate-200
  panelBg: '#f8fafc', // slate-50
  avatarBg: '#e2eef9', // primary-100
  avatarText: '#216297', // primary-700
};

// Card geometry — width is fixed (a real portrait ID card's proportions);
// height is NOT — it's derived per card by rendering once on a throwaway
// canvas to measure how tall the content actually is (see
// renderCardToBlob), then re-rendered for real at that exact height. That
// is what keeps every card fitting its own portrait canvas precisely,
// however many detail rows it ends up needing (course code, campus list,
// optional qualification), with nothing ever clipped or leaving dead space.
const CARD_WIDTH = 380;
const CARD_SCALE = 2;
const CARD_PADDING = 20;
// The header isn't a plain rectangle — its bottom edge is a shallow wave
// (flat at the edges, dipping down to a point in the center, where the
// photo sits) — see drawHeaderPath. These are its two edge heights.
const HEADER_EDGE_HEIGHT = 100;
const HEADER_CENTER_HEIGHT = 152;
const HEADER_WAVE_HALF_WIDTH = 78;
const PHOTO_RADIUS = 46;

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
// Ring is a double-line (white then gold) instead of the old single blue
// ring, matching the reference design's photo treatment.
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
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
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

// Raw lucide-react icon node data (path/circle defs, 24x24 viewBox,
// stroke-only) copied directly from the exact icon set already used
// everywhere else in this app (node_modules/lucide-react) — not
// re-drawn/approximated by hand, so these small badge icons read
// identically to every other icon in the UI. Canvas can't render the
// <GraduationCap>/<Users>/<BookOpen>/<Shield>/<Scan> React components
// directly, so drawLucideIcon below replays their own path data with
// ctx.stroke() instead.
const ICONS = {
  graduationCap: [
    ['path', 'M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z'],
    ['path', 'M22 10v6'],
    ['path', 'M6 12.5V16a6 3 0 0 0 12 0v-3.5'],
  ],
  users: [
    ['path', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'],
    ['path', 'M16 3.128a4 4 0 0 1 0 7.744'],
    ['path', 'M22 21v-2a4 4 0 0 0-3-3.87'],
    ['circle', { cx: 9, cy: 7, r: 4 }],
  ],
  bookOpen: [
    ['path', 'M12 5v16'],
    [
      'path',
      'M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z',
    ],
  ],
  shield: [
    [
      'path',
      'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
    ],
  ],
  scan: [
    ['path', 'M3 7V5a2 2 0 0 1 2-2h2'],
    ['path', 'M17 3h2a2 2 0 0 1 2 2v2'],
    ['path', 'M21 17v2a2 2 0 0 1-2 2h-2'],
    ['path', 'M7 21H5a2 2 0 0 1-2-2v-2'],
  ],
};

// Draws one lucide icon (see ICONS above), centered at (cx, cy), scaled so
// its 24x24 viewBox maps onto a `size`-px box — same stroke width/cap/join
// lucide itself uses (strokeWidth 2, round caps/joins) so it reads
// identically at any size, not just thinner/thicker.
function drawLucideIcon(ctx, iconKey, cx, cy, size, color) {
  const scale = size / 24;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [type, data] of ICONS[iconKey]) {
    if (type === 'path') {
      ctx.stroke(new Path2D(data));
    } else if (type === 'circle') {
      ctx.beginPath();
      ctx.arc(data.cx, data.cy, data.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// A small rotated-square accent — the gold "◆" bullets flanking the ID
// badge in the reference design.
function drawDiamond(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

// The header's own path — flat navy at the left/right edges, dipping down
// to a point at the horizontal center (where the photo sits), instead of a
// plain rectangle. Shared by the fill and the gold trace line along the
// same edge so they always agree exactly.
function headerPath(ctx, width) {
  const midX = width / 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width, 0);
  ctx.lineTo(width, HEADER_EDGE_HEIGHT);
  ctx.lineTo(midX + HEADER_WAVE_HALF_WIDTH, HEADER_EDGE_HEIGHT);
  ctx.lineTo(midX, HEADER_CENTER_HEIGHT);
  ctx.lineTo(midX - HEADER_WAVE_HALF_WIDTH, HEADER_EDGE_HEIGHT);
  ctx.lineTo(0, HEADER_EDGE_HEIGHT);
  ctx.closePath();
}

// The QR payload — a short, plain-text `PREFIX + trainerId` string, NOT
// JSON. Deliberately minimal (no name, no wrapper object): every extra byte
// here pushes the printed QR to a higher version (more, smaller modules
// packed into the same physical square), which is what actually made
// real-world scans unreliable — a normal arm's-length phone camera, a
// slight angle, a bit of blur, or scanning a photo of the card all lose
// fine module detail first. `TRAINER_QR_PREFIX` must exactly match the
// server's own copy in server/src/utils/trainerQrAttendance.js — that's
// what lets the Admin/Super Admin QR scanner (Attendance page) tell a
// Trainer card apart from a Student one (whose own buildQrPayload in
// studentIdCard.js is unrelated/untouched — still JSON, still its own
// format) and parse it. Trainer-level (not per-course), so it's generated
// once and reused across every course card below.
const TRAINER_QR_PREFIX = 'TITAN-TRAINER:';

function buildQrPayload(trainerProfile) {
  return `${TRAINER_QR_PREFIX}${trainerProfile?.trainerId}`;
}

function sanitizeFileName(value) {
  return (value || 'trainer').replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// One icon-led row inside the info panel (Course/Campus/Qualification) — a
// small filled navy circle with a white lucide icon on the left, an
// uppercase faint label + bold value stacked to its right. Returns the Y
// just past this row's own content (icon bottom or wrapped value's last
// line, whichever is taller) so the caller can place the next divider/row.
function drawInfoRow(ctx, { iconKey, label, value, x, y, width }) {
  const iconR = 15;
  const iconCX = x + iconR;
  const iconCY = y + iconR;
  ctx.beginPath();
  ctx.arc(iconCX, iconCY, iconR, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.navy;
  ctx.fill();
  drawLucideIcon(ctx, iconKey, iconCX, iconCY, iconR * 1.05, '#ffffff');

  const textX = x + iconR * 2 + 12;
  const textMaxWidth = width - (iconR * 2 + 12);
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.faint;
  ctx.font = '700 8.5px Arial, sans-serif';
  ctx.fillText(label.toUpperCase(), textX, y + 11);
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 13px Arial, sans-serif';
  const textBottom = drawWrappedText(ctx, value, textX, y + 27, textMaxWidth, 15, 2);

  return Math.max(textBottom, iconCY + iconR);
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

  // Header — navy, wave-bottomed (see headerPath), with a subtle lighter
  // diagonal "shine" folded into the top corners for depth, matching the
  // reference design's ribbon-corner effect. Purely decorative layering,
  // never affects any text/content position below it.
  headerPath(ctx, width);
  ctx.fillStyle = COLORS.navy;
  ctx.fill();

  const cornerShineSize = 88;
  ctx.save();
  headerPath(ctx, width);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(cornerShineSize, 0);
  ctx.lineTo(0, cornerShineSize * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(width, 0);
  ctx.lineTo(width - cornerShineSize, 0);
  ctx.lineTo(width, cornerShineSize * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  headerPath(ctx, width);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  ctx.stroke();

  const centerX = width / 2;
  const crestSize = 50;
  const crestY = 13;
  if (crestImg) ctx.drawImage(crestImg, centerX - crestSize / 2, crestY, crestSize, crestSize);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 19px Arial, sans-serif';
  ctx.fillText('TITAN INSTITUTE', centerX, crestY + crestSize + 20);

  const subtitle = 'TRAINER IDENTIFICATION CARD';
  const subtitleY = crestY + crestSize + 34;
  ctx.font = '700 9.5px Arial, sans-serif';
  const subtitleW = ctx.measureText(subtitle).width;
  ctx.fillStyle = COLORS.goldLight;
  ctx.fillText(subtitle, centerX, subtitleY);
  ctx.strokeStyle = COLORS.goldLight;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - subtitleW / 2 - 26, subtitleY - 3);
  ctx.lineTo(centerX - subtitleW / 2 - 8, subtitleY - 3);
  ctx.moveTo(centerX + subtitleW / 2 + 8, subtitleY - 3);
  ctx.lineTo(centerX + subtitleW / 2 + 26, subtitleY - 3);
  ctx.stroke();

  // Photo — centered on the header wave's own deepest point, so it
  // straddles navy above and white below exactly like the reference.
  const photoCX = centerX;
  const photoCY = HEADER_CENTER_HEIGHT;
  drawAvatar(ctx, avatarImg, user?.name, photoCX, photoCY, PHOTO_RADIUS);

  // Employee ID badge — solid navy pill, white text, flanked by two small
  // gold diamond accents (replaces the old plain light-blue pill).
  ctx.font = '700 13px Arial, sans-serif';
  const badgeText = trainerProfile.employeeId || '—';
  const badgeTextWidth = ctx.measureText(badgeText).width;
  const badgeW = badgeTextWidth + 26;
  const badgeH = 24;
  const badgeX = photoCX - badgeW / 2;
  const badgeY = photoCY + PHOTO_RADIUS + 16;
  roundedRectPath(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fillStyle = COLORS.navy;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, photoCX, badgeY + badgeH / 2 + 4.5);
  drawDiamond(ctx, badgeX - 12, badgeY + badgeH / 2, 4, COLORS.gold);
  drawDiamond(ctx, badgeX + badgeW + 12, badgeY + badgeH / 2, 4, COLORS.gold);

  let cursorY = badgeY + badgeH + 24;

  ctx.fillStyle = COLORS.text;
  ctx.font = '700 21px Arial, sans-serif';
  ctx.textAlign = 'center';
  drawCenteredEllipsis(ctx, user?.name || 'Trainer', photoCX, cursorY, width - CARD_PADDING * 2);
  cursorY += 12;

  // Role badge — navy pill with gold text (replaces the old light-blue
  // pill with navy text), matching the ID badge's own treatment above.
  ctx.font = '700 11px Arial, sans-serif';
  const tag = 'TRAINER';
  const tagW = ctx.measureText(tag).width + 20;
  roundedRectPath(ctx, photoCX - tagW / 2, cursorY, tagW, 20, 10);
  ctx.fillStyle = COLORS.navy;
  ctx.fill();
  ctx.fillStyle = COLORS.goldLight;
  ctx.fillText(tag, photoCX, cursorY + 14);
  cursorY += 20 + 20;

  // Divider with a small centered gold diamond, replacing the old plain
  // slate line.
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CARD_PADDING, cursorY);
  ctx.lineTo(centerX - 8, cursorY);
  ctx.moveTo(centerX + 8, cursorY);
  ctx.lineTo(width - CARD_PADDING, cursorY);
  ctx.stroke();
  drawDiamond(ctx, centerX, cursorY, 4, COLORS.gold);
  cursorY += 20;

  // Info panel — light rounded panel holding the icon-led detail rows
  // (replaces the old plain label/value list). Course/Campus mirror
  // exactly what the previous design showed (course name+code folded into
  // one row, the trainer's full campus list — campuses aren't mapped
  // per-course in the data model, so this stays the trainer's full list on
  // every one of their course cards, same as before); Qualification is
  // only added when the trainer profile actually has one set. Email is
  // still deliberately never shown on the card.
  const panelX = CARD_PADDING;
  const panelW = width - CARD_PADDING * 2;
  const panelInnerPad = 14;
  let rowY = cursorY + panelInnerPad;
  const rowX = panelX + panelInnerPad;
  const rowW = panelW - panelInnerPad * 2;

  const courseName = course?.name || 'Not assigned yet';
  const courseValue = course?.code ? `${courseName} (${course.code})` : courseName;
  const campusNames = (trainerProfile.campuses || []).map((c) => c.name).filter(Boolean);
  const rows = [{ iconKey: 'graduationCap', label: 'Course', value: courseValue }];
  rows.push({ iconKey: 'users', label: 'Campus', value: campusNames.length ? campusNames.join(', ') : '—' });
  if (trainerProfile.qualification) {
    rows.push({ iconKey: 'bookOpen', label: 'Qualification', value: trainerProfile.qualification });
  }

  rows.forEach((row, i) => {
    rowY = drawInfoRow(ctx, { ...row, x: rowX, y: rowY, width: rowW });
    if (i < rows.length - 1) {
      rowY += 10;
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rowX, rowY);
      ctx.lineTo(rowX + rowW, rowY);
      ctx.stroke();
      rowY += 12;
    }
  });

  const panelH = rowY + panelInnerPad - cursorY;
  roundedRectPath(ctx, panelX, cursorY, panelW, panelH, 12);
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.stroke();
  cursorY += panelH + 20;

  // QR code, with a solid navy "Scan to verify" pill (icon + text, both
  // white/gold-light) underneath — see buildQrPayload above for what it
  // actually encodes.
  const qrSize = 116;
  const qrX = photoCX - qrSize / 2;
  const qrY = cursorY;
  if (qrImg) {
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(qrX, qrY, qrSize, qrSize);
    cursorY = qrY + qrSize + 14;

    const caption = 'Scan to verify';
    ctx.font = '700 10px Arial, sans-serif';
    const captionW = ctx.measureText(caption).width;
    const pillIconGap = 18;
    const pillW = captionW + pillIconGap + 30;
    const pillH = 24;
    roundedRectPath(ctx, photoCX - pillW / 2, cursorY, pillW, pillH, pillH / 2);
    ctx.fillStyle = COLORS.navy;
    ctx.fill();
    drawLucideIcon(ctx, 'scan', photoCX - pillW / 2 + 16, cursorY + pillH / 2, 13, COLORS.goldLight);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(caption, photoCX - pillW / 2 + pillIconGap + 12, cursorY + pillH / 2 + 3.5);
    cursorY += pillH + 18;
  }

  // Footer — gold line, then a solid navy band (shield icon + "Property
  // of…"/"Issued …", light text), replacing the old plain slate-on-white
  // caption line.
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(CARD_PADDING, cursorY);
  ctx.lineTo(width - CARD_PADDING, cursorY);
  ctx.stroke();

  const footerH = 34;
  ctx.fillStyle = COLORS.navy;
  ctx.fillRect(0, cursorY + 1.5, width, footerH);

  const footerCY = cursorY + 1.5 + footerH / 2;
  const shieldSize = 13;
  const line1 = 'Property of TITAN Institute';
  const line2 = `Issued ${new Date().toLocaleDateString()}`;
  ctx.font = '600 9.5px Arial, sans-serif';
  const line1W = ctx.measureText(line1).width;
  ctx.font = '600 9.5px Arial, sans-serif';
  const line2W = ctx.measureText(line2).width;
  const sepGap = 22;
  const totalW = shieldSize + 8 + line1W + sepGap + line2W;
  let fx = centerX - totalW / 2;
  drawLucideIcon(ctx, 'shield', fx + shieldSize / 2, footerCY, shieldSize, COLORS.goldLight);
  fx += shieldSize + 8;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(line1, fx, footerCY + 3.5);
  fx += line1W + sepGap / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fx, footerCY - 6);
  ctx.lineTo(fx, footerCY + 6);
  ctx.stroke();
  fx += sepGap / 2;
  ctx.fillText(line2, fx, footerCY + 3.5);

  cursorY += 1.5 + footerH;

  if (drawBackground) {
    ctx.restore();
    // Outer gold border, drawn after restore() so it sits on top, unclipped.
    roundedRectPath(ctx, 1, 1, width - 2, height - 2, 16);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
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
    // errorCorrectionLevel: 'H' (~30% of the code can be damaged/obscured/
    // blurred and still decode) is only affordable because buildQrPayload
    // is now this short — at the old JSON payload's length, 'H' would have
    // pushed the QR to an even higher version (smaller modules), actively
    // hurting scannability instead of helping it. margin: 4 is the QR
    // spec's own recommended "quiet zone" (margin: 1, the old value,
    // starves the scanner's finder-pattern detection of the blank border it
    // needs — a bare, undersized quiet zone is exactly what breaks
    // off-angle/at-distance/photo-of-a-photo scans). width 280 for a bit
    // more source resolution before the camera's own resolution becomes the
    // limiting factor; still comfortably downscaled (not upscaled/blurred)
    // onto the card's own 116px QR slot.
    QRCode.toDataURL(buildQrPayload(trainerProfile), {
      errorCorrectionLevel: 'H',
      margin: 4,
      width: 280,
      color: { dark: COLORS.navy, light: '#ffffff' },
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
