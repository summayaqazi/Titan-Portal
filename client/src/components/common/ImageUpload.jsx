import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { validateImageFile } from '../../utils/validateFile';

// Reusable drag-drop image picker with preview, used by Student/Trainer forms
// and the Profile avatar. `currentUrl` is an existing image URL to show until
// a new file is picked; `onChange(file|null)` receives the picked File.
// `onRemove()` (optional) fires specifically when the user clears an image
// via the X button — distinct from `onChange(null)`'s initial/no-op state —
// so the parent can tell "explicitly removed" apart from "never touched" and
// signal the server to actually delete the stored file on save.
export default function ImageUpload({ currentUrl, onChange, onRemove, error, setError, round = false }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [removed, setRemoved] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const applyFile = (file) => {
    const validationError = validateImageFile(file);
    if (validationError) {
      setError?.(validationError);
      return;
    }
    setError?.('');
    setRemoved(false);
    setPreview(URL.createObjectURL(file));
    onChange(file);
  };

  const handleFiles = (files) => {
    const file = files?.[0];
    if (file) applyFile(file);
  };

  const handleRemove = () => {
    setPreview(null);
    setRemoved(true);
    setError?.('');
    if (inputRef.current) inputRef.current.value = '';
    onChange(null);
    onRemove?.();
  };

  // Once removed, ignore currentUrl even if the parent re-renders with the
  // same (stale) prop — otherwise the image would reappear immediately.
  const displayUrl = preview || (removed ? null : currentUrl);
  const shape = round ? 'rounded-full' : 'rounded-md';

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer items-center gap-3 border-2 border-dashed px-4 py-3 text-sm transition-colors ${shape} ${
          dragActive ? 'border-primary-400 bg-primary-50' : 'border-slate-300 hover:bg-slate-50'
        }`}
      >
        {displayUrl ? (
          <img src={displayUrl} alt="Preview" className={`h-14 w-14 object-cover ${shape} border border-slate-200`} />
        ) : (
          <div className={`flex h-14 w-14 items-center justify-center bg-slate-100 text-slate-400 ${shape}`}>
            <ImagePlus size={20} />
          </div>
        )}
        <div className="flex-1 text-slate-500">
          <p className="font-medium text-slate-600">Click or drag an image here</p>
          <p className="text-xs">JPG, PNG or WEBP, up to 2MB</p>
        </div>
        {displayUrl && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            aria-label="Remove image"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
