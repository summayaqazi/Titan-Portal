import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Check, X, Layers, CheckCircle2, Circle, TrendingUp } from 'lucide-react';
import { Button, Input, EmptyState, ConfirmDialog, StatPill } from '../common';
import useSubmitGuard from '../../hooks/useSubmitGuard';
import trainerProgressApi from '../../api/trainerProgressApi';
import { getErrorMessage } from '../../utils/errors';

function ProgressBar({ percent, className = '' }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-100 ${className}`}>
      <div
        className={`h-full rounded-full transition-all ${percent === 100 ? 'bg-green-500' : 'bg-primary-500'}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

// Small "click pencil to rename inline" control shared by module and topic
// rows — avoids a modal for a single-field edit.
function InlineEditable({ value, onSave, textClassName }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const guardSubmit = useSubmitGuard();

  if (!editing) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className={`truncate ${textClassName}`}>{value}</span>
        <button
          type="button"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          className="text-slate-300 hover:text-primary-600"
        >
          <Pencil size={12} />
        </button>
      </div>
    );
  }

  const save = () => {
    guardSubmit(async () => {
      if (draft.trim() && draft.trim() !== value) await onSave(draft.trim());
      setEditing(false);
    });
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <Input
        autoFocus
        className="h-7 py-1 text-sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
      <button type="button" onClick={save} className="text-green-600 hover:text-green-700">
        <Check size={14} />
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600">
        <X size={14} />
      </button>
    </div>
  );
}

function AddInline({ placeholder, onAdd, buttonLabel }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardSubmit = useSubmitGuard();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline">
        <Plus size={13} /> {buttonLabel}
      </button>
    );
  }

  const submit = () => {
    guardSubmit(async () => {
      if (!value.trim()) return;
      setSubmitting(true);
      try {
        await onAdd(value.trim());
        setValue('');
        setOpen(false);
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        className="h-8 max-w-xs py-1 text-sm"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      <Button type="button" className="h-8 px-2.5 py-0 text-xs" onClick={submit} disabled={submitting}>
        Add
      </Button>
      <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
        <X size={15} />
      </button>
    </div>
  );
}

function TopicRow({ topic, onToggle, onRename, onDelete }) {
  return (
    // Completion is now shown by the row's own subtle green tint (plus the
    // filled check icon below) instead of strikethrough — the topic name
    // stays full, normal text either way, never dimmed or crossed out.
    <div
      className={`flex items-center gap-2 border-t border-slate-100 py-2 pl-8 pr-1 first:border-t-0 ${
        topic.completed ? 'bg-green-50/60' : ''
      }`}
    >
      <button type="button" onClick={onToggle} className={topic.completed ? 'text-green-600' : 'text-slate-300 hover:text-slate-400'}>
        {topic.completed ? <CheckCircle2 size={17} /> : <Circle size={17} />}
      </button>
      <InlineEditable value={topic.title} onSave={onRename} textClassName="text-sm text-slate-700" />
      <button type="button" onClick={onDelete} className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-600">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function ModuleCard({ module, onRename, onDelete, onAddTopic, onToggleTopic, onRenameTopic, onDeleteTopic }) {
  const [expanded, setExpanded] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-3">
        <button type="button" onClick={() => setExpanded((e) => !e)} className="text-slate-400 hover:text-slate-600">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <InlineEditable value={module.title} onSave={onRename} textClassName="text-sm font-semibold text-slate-800" />
        <span className="whitespace-nowrap text-xs text-slate-400">
          {module.completedTopics}/{module.totalTopics} topics
        </span>
        <div className="w-24">
          <ProgressBar percent={module.progressPercent} />
        </div>
        <span className="w-9 text-right text-xs font-medium text-slate-500">{module.progressPercent}%</span>
        <button type="button" onClick={() => setDeleteConfirm(true)} className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-600">
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 pb-2">
          {module.topics.length === 0 ? (
            <p className="px-8 py-2 text-xs text-slate-400">No topics yet</p>
          ) : (
            module.topics.map((topic) => (
              <TopicRow
                key={topic._id}
                topic={topic}
                onToggle={() => onToggleTopic(topic)}
                onRename={(title) => onRenameTopic(topic, title)}
                onDelete={() => onDeleteTopic(topic)}
              />
            ))
          )}
          <div className="mt-2 pl-8">
            <AddInline placeholder="Topic title" buttonLabel="Add Topic" onAdd={onAddTopic} />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={() => {
          setDeleteConfirm(false);
          onDelete();
        }}
        title="Delete Module"
        message={`Delete "${module.title}" and all its topics? This cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}

// Overall / Module / Topic progress for one batch — trainer's own curriculum
// breakdown, everything saved immediately (every action below is its own
// API call that persists and re-syncs local state from the server response).
export default function ProgressTab({ batchId }) {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    trainerProgressApi
      .get(batchId)
      .then(setProgress)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load course progress')))
      .finally(() => setLoading(false));
  };

  useEffect(load, [batchId]);

  const handleAddModule = async (title) => setProgress(await trainerProgressApi.addModule(batchId, title));
  const handleRenameModule = async (moduleId, title) => setProgress(await trainerProgressApi.updateModule(moduleId, title));
  const handleDeleteModule = async (moduleId) => setProgress(await trainerProgressApi.removeModule(moduleId));
  const handleAddTopic = async (moduleId, title) => setProgress(await trainerProgressApi.addTopic(moduleId, title));
  const handleToggleTopic = async (topic) => setProgress(await trainerProgressApi.toggleTopic(topic._id, !topic.completed));
  const handleRenameTopic = async (topicId, title) => setProgress(await trainerProgressApi.updateTopic(topicId, title));
  const handleDeleteTopic = async (topicId) => setProgress(await trainerProgressApi.removeTopic(topicId));

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>;
  if (!progress) return null;

  return (
    <div>
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Overall Progress</h3>
          <span className="text-lg font-bold text-slate-800">{progress.progressPercent}%</span>
        </div>
        <ProgressBar percent={progress.progressPercent} className="h-2.5" />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill size="md" icon={Layers} label="Modules" value={progress.modules.length} colorClass="bg-primary-50 text-primary-600" />
        <StatPill size="md" icon={TrendingUp} label="Total Topics" value={progress.totalTopics} colorClass="bg-slate-100 text-slate-600" />
        <StatPill size="md" icon={CheckCircle2} label="Completed Topics" value={progress.completedTopics} colorClass="bg-green-50 text-green-600" />
        <StatPill size="md" icon={Circle} label="Remaining Topics" value={progress.remainingTopics} colorClass="bg-amber-50 text-amber-600" />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Modules</h3>
        <AddInline placeholder="Module title" buttonLabel="Add Module" onAdd={handleAddModule} />
      </div>

      {progress.modules.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white">
          <EmptyState title="No modules yet" description="Break this course down into modules and topics to start tracking progress." />
        </div>
      ) : (
        <div className="space-y-3">
          {progress.modules.map((module) => (
            <ModuleCard
              key={module._id}
              module={module}
              onRename={(title) => handleRenameModule(module._id, title)}
              onDelete={() => handleDeleteModule(module._id)}
              onAddTopic={(title) => handleAddTopic(module._id, title)}
              onToggleTopic={handleToggleTopic}
              onRenameTopic={(topic, title) => handleRenameTopic(topic._id, title)}
              onDeleteTopic={(topic) => handleDeleteTopic(topic._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
