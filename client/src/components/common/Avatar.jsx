import { useState } from 'react';
import { User } from 'lucide-react';

// Consistent avatar rendering wherever a person's uploaded image (student,
// trainer) is shown: the image if present and loadable, else initials, else
// a generic user icon — so a missing OR broken/stale image URL never renders
// as a broken-image icon.
export default function Avatar({ src, name, size = 32, className = '' }) {
  const [failed, setFailed] = useState(false);
  const dimension = `${size}px`;

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        onError={() => setFailed(true)}
        style={{ width: dimension, height: dimension }}
        className={`shrink-0 rounded-full border border-slate-200 object-cover ${className}`}
      />
    );
  }

  return (
    <div
      style={{ width: dimension, height: dimension }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700 ${className}`}
    >
      {name?.trim() ? name.trim().charAt(0).toUpperCase() : <User size={size * 0.55} />}
    </div>
  );
}
