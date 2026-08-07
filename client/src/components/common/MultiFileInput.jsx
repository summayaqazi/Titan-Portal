import { useRef } from 'react';
import { Paperclip, X } from 'lucide-react';
import { resolveFileUrl } from '../../utils/fileUrl';

// Accumulates multiple new File objects (shown as removable chips) plus an
// optional list of already-uploaded server paths (existingUrls) that can be
// marked for removal via onRemoveExisting — for any form field that uploads
// several files at once (currently Assignment reference images/attachments).
export default function MultiFileInput({ label, accept, files, onFilesChange, existingUrls = [], onRemoveExisting, error }) {
  const inputRef = useRef(null);

  const handlePick = (e) => {
    const picked = Array.from(e.target.files || []);
    onFilesChange([...files, ...picked]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeNew = (index) => onFilesChange(files.filter((_, i) => i !== index));

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600"
      >
        <Paperclip size={14} /> {label || 'Add files'}
      </button>
      <input ref={inputRef} type="file" accept={accept} multiple className="hidden" onChange={handlePick} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {(existingUrls.length > 0 || files.length > 0) && (
        <ul className="mt-2 space-y-1">
          {existingUrls.map((url) => (
            <li key={url} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
              <a href={resolveFileUrl(url)} target="_blank" rel="noreferrer" className="truncate text-blue-600 hover:underline">
                {url.split('/').pop()}
              </a>
              {onRemoveExisting && (
                <button type="button" onClick={() => onRemoveExisting(url)} className="shrink-0 text-slate-400 hover:text-red-600">
                  <X size={13} />
                </button>
              )}
            </li>
          ))}
          {files.map((file, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700">
              <span className="truncate">{file.name}</span>
              <button type="button" onClick={() => removeNew(i)} className="shrink-0 text-blue-400 hover:text-red-600">
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
