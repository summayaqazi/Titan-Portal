import { useEffect } from 'react';

// Calls onEscape when the Escape key is pressed while `active` (e.g. a Modal
// or Drawer is open). Shared by both so they close consistently.
export default function useOnEscape(active, onEscape) {
  useEffect(() => {
    if (!active) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onEscape();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, onEscape]);
}
