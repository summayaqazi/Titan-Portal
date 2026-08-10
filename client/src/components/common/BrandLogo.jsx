import { useState } from 'react';

// Renders the TITAN logo from a static public asset (client/public/titan-logo.png)
// so it works with zero build-time dependency on the file existing. Falls
// back to the caller-supplied placeholder only after a retry — a single
// transient load failure (slow network, a dev-server hiccup) shouldn't
// permanently swap the real logo for the fallback letter for the rest of
// the session, which would look like the logo "disappearing" on whatever
// page happens to render next. Branding locations never show a broken
// image icon either way.
//
// LOGO_VERSION cache-busts the request: the file lives at a fixed,
// unhashed URL (no build pipeline involved), so replacing its bytes on
// disk alone does NOT change the URL a browser has already cached the old
// image under — it keeps showing the stale copy indefinitely. Bump this
// string whenever the underlying titan-logo.png file is replaced, so
// every browser is forced to fetch the new bytes instead of serving what
// it cached from the old file at the same path.
const LOGO_VERSION = '5';

// `size` sets the rendered HEIGHT only — width is 'auto' so the browser
// scales the logo proportionally to its own real aspect ratio instead of
// forcing it into a square box. The current asset is a wide horizontal
// logo (roughly 2.2:1); a fixed width===height box would squeeze it down
// to a sliver. Any future logo (square or otherwise) still renders at its
// correct proportions this way, with zero code change needed.
export default function BrandLogo({ size = 36, className = '', fallback }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  if (failed) return fallback;

  return (
    <img
      src={`/titan-logo.png?v=${LOGO_VERSION}${attempt > 0 ? `-retry${attempt}` : ''}`}
      alt="TITAN"
      onError={() => (attempt === 0 ? setAttempt(1) : setFailed(true))}
      style={{ height: size, width: 'auto' }}
      className={`object-contain ${className}`}
    />
  );
}
