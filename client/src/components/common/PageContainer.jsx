// `className` defaults to the original padding exactly — every existing
// caller that doesn't pass it renders byte-identical to before. Only a page
// that explicitly opts in (passing its own value) gets different spacing.
export default function PageContainer({ title, description, actions, children, className = 'p-4 sm:p-6' }) {
  return (
    <div className={className}>
      {(title || actions) && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title && <h1 className="text-lg font-semibold text-slate-800 sm:text-xl">{title}</h1>}
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
