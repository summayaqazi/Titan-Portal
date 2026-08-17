import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from '../common';

// Confetti-piece palette + the celebration emoji set the design calls for.
// Kept local to this component — nothing shared/global is touched.
const CONFETTI_COLORS = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#eab308'];
const CONFETTI_EMOJIS = ['🎉', '🎊', '✨', '🏆', '🥳'];
const PIECE_COUNT = 60;

// Auto-dismiss timing — long enough to enjoy, short enough to not block the
// student from reading their actual result underneath for long.
const AUTO_DISMISS_MS = 6000;

// Random-but-stable confetti field: a mix of colored paper pieces and
// floating celebration emoji, each with its own horizontal position, fall
// duration/delay, size and (for paper pieces) rotation/color — regenerated
// only once per mount via useMemo, not on every re-render.
function useConfettiPieces() {
  return useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, i) => {
        const isEmoji = i % 3 === 0;
        return {
          id: i,
          isEmoji,
          left: Math.random() * 100,
          duration: 2.6 + Math.random() * 2.2,
          delay: Math.random() * 1.4,
          size: isEmoji ? 14 + Math.random() * 14 : 6 + Math.random() * 6,
          rotate: Math.random() * 360,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          emoji: CONFETTI_EMOJIS[i % CONFETTI_EMOJIS.length],
        };
      }),
    []
  );
}

/**
 * A celebratory overlay shown after a quiz result loads with a "good"
 * score — confetti + a congratulations card. Purely decorative/additive: it
 * renders on top of the existing result UI and dismisses itself (or via the
 * Continue button), never altering any quiz/scoring data or the result
 * markup underneath it.
 */
export default function QuizCelebration({ show, onDismiss, percentage }) {
  const pieces = useConfettiPieces();

  useEffect(() => {
    if (!show) return undefined;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [show, onDismiss]);

  if (!show) return null;

  return (
    <div className="celebration-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-900/60 p-4">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {pieces.map((p) => (
          <span
            key={p.id}
            className="celebration-confetti-piece"
            style={{
              left: `${p.left}%`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              ...(p.isEmoji
                ? { fontSize: `${p.size}px` }
                : {
                    width: `${p.size}px`,
                    height: `${p.size * 0.4}px`,
                    backgroundColor: p.color,
                    borderRadius: '2px',
                    transform: `rotate(${p.rotate}deg)`,
                  }),
            }}
          >
            {p.isEmoji ? p.emoji : null}
          </span>
        ))}
      </div>

      <div className="celebration-card relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X size={16} />
        </button>

        <div className="celebration-bounce text-5xl leading-none">🏆</div>
        <p className="mt-3 text-2xl">
          🎉 🎊 🥳 ✨ 👏
        </p>
        <h2 className="mt-3 text-xl font-bold text-slate-800">Congratulations!</h2>
        <p className="mt-1 text-sm font-medium text-slate-600">
          🎉 You completed the quiz with excellent marks!
        </p>
        {typeof percentage === 'number' && (
          <p className="mt-3 inline-block rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-700">
            Score: {percentage}%
          </p>
        )}

        <Button className="mt-5 w-full justify-center" onClick={onDismiss}>
          Continue ✨
        </Button>
      </div>
    </div>
  );
}
