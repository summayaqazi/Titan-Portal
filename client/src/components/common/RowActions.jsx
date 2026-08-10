import { Pencil, Trash2, Eye } from 'lucide-react';

// Shared Edit/Delete (and optional View) icon-button cluster used by every
// Super Admin list table's actions column.
export default function RowActions({ onView, onEdit, onDelete, deleteDisabled = false, deleteTitle }) {
  return (
    <div className="flex items-center gap-1">
      {onView && (
        <button
          type="button"
          onClick={onView}
          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600"
          aria-label="View"
        >
          <Eye size={15} />
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600"
          aria-label="Edit"
        >
          <Pencil size={15} />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleteDisabled}
          title={deleteDisabled ? deleteTitle : undefined}
          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Delete"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
