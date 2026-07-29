import { Construction } from 'lucide-react';

export default function ComingSoon({ label }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white py-20 text-center">
      <Construction className="mb-3 text-slate-300" size={36} />
      <p className="text-sm font-medium text-slate-500">{label} module is coming soon</p>
      <p className="mt-1 text-xs text-slate-400">This section will be built in an upcoming task.</p>
    </div>
  );
}
