import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title = 'No records found', description }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-slate-400">
      <Icon size={28} className="text-slate-300" />
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {description && <p className="max-w-sm text-xs text-slate-400">{description}</p>}
    </div>
  );
}
