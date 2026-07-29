export default function PageContainer({ title, description, actions, children }) {
  return (
    <div className="p-6">
      {(title || actions) && (
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            {title && <h1 className="text-xl font-semibold text-slate-800">{title}</h1>}
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
