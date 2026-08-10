export default function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
