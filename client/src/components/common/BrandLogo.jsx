import { useState } from 'react';

// Renders the TITAN logo from a static public asset (client/public/titan-logo.png)
// so it works with zero build-time dependency on the file existing. Falls
// back to the caller-supplied placeholder if the file is missing or fails to
// load, so branding locations never show a broken image icon.
export default function BrandLogo({ size = 36, className = '', fallback }) {
  const [failed, setFailed] = useState(false);

  if (failed) return fallback;

  return (
    <img
      src="/titan-logo.png"
      alt="TITAN"
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
      className={`object-contain ${className}`}
    />
  );
}
