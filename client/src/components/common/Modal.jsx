import { X } from 'lucide-react';
import useOnEscape from '../../hooks/useOnEscape';

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useOnEscape(open, onClose);

  if (!open) return null;

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    // Added for the Student Assignment "Assignment Information" detail
    // modal (~760-800px on desktop) — purely additive, every existing
    // caller keeps passing its own sm/md/lg (or the 'md' default)
    // unchanged.
    xl: 'max-w-3xl',
  }[size];

  return (
    <div
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // Resets the backdrop's cursor: pointer (see the wrapper above) —
        // `cursor` inherits by default, and without this every plain-text
        // element inside the actual dialog (not just its buttons/links,
        // which already get their own pointer via the global rule) would
        // incorrectly show a pointer cursor too.
        className={`flex max-h-[90vh] w-full ${sizeClass} cursor-auto flex-col rounded-lg bg-white shadow-xl`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5 sm:py-4">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-4 sm:px-5">{footer}</div>
        )}
      </div>
    </div>
  );
}
