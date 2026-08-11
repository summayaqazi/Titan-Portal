import { useState } from 'react';
import { Bug, Lightbulb, MessageSquare, Send } from 'lucide-react';
import { Modal, Button, FormField, Textarea, MultiFileInput } from '../common';
import studentPortalApi from '../../api/studentPortalApi';
import { getErrorMessage } from '../../utils/errors';
import useSubmitGuard from '../../hooks/useSubmitGuard';

const TYPES = [
  { value: 'bug', label: 'Bug', icon: Bug },
  { value: 'idea', label: 'Idea', icon: Lightbulb },
  { value: 'other', label: 'Other', icon: MessageSquare },
];

// Reusable from anywhere in the Student Portal (currently only the
// Dashboard's header action) — kept as its own component rather than
// inlined so a second entry point (e.g. a future "Help" menu) doesn't
// have to duplicate this form.
export default function FeedbackModal({ open, onClose }) {
  const guardSubmit = useSubmitGuard();
  const [type, setType] = useState('bug');
  const [message, setMessage] = useState('');
  const [images, setImages] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setType('bug');
    setMessage('');
    setImages([]);
    setError('');
    setSuccess(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    guardSubmit(async () => {
      setError('');
      if (!message.trim()) {
        setError('Please describe your feedback');
        return;
      }
      setSubmitting(true);
      try {
        // Only a genuine 201 from the backend counts as success — nothing
        // here is shown as "sent" before the request actually resolves.
        await studentPortalApi.submitFeedback({ type, message: message.trim(), images });
        setSuccess(true);
        setMessage('');
        setImages([]);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to send feedback'));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <Modal open={open} onClose={handleClose} title="Send Feedback" size="md">
      {success ? (
        <div className="py-2 text-center">
          <p className="text-sm font-medium text-green-700">Thanks — your feedback was sent.</p>
          <Button className="mt-4" onClick={handleClose}>
            Close
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <FormField label="Feedback Type" required>
            <div className="flex gap-2">
              {TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors ${
                    type === value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Feedback" htmlFor="feedback-message" required>
            <Textarea
              id="feedback-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              placeholder="Tell us what's on your mind…"
            />
          </FormField>

          <FormField label="Reference Images (optional)">
            <MultiFileInput label="Add images" accept="image/*" files={images} onFilesChange={setImages} />
          </FormField>

          {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              <Send size={15} /> {submitting ? 'Sending…' : 'Send Feedback'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
