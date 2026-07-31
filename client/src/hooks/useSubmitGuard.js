import { useRef } from 'react';

// Wraps a submit handler so a rapid double-click or Enter-key repeat can't
// fire it twice while the first call is still in flight. Uses a ref (not
// state) so the check is synchronous and immune to stale closures.
export default function useSubmitGuard() {
  const inFlight = useRef(false);

  return async (fn) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await fn();
    } finally {
      inFlight.current = false;
    }
  };
}
