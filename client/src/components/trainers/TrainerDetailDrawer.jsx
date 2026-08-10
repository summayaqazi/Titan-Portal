import DOMPurify from 'dompurify';
import { Globe, Link2 } from 'lucide-react';
import { Drawer, StatusBadge, Avatar } from '../common';
import { resolveFileUrl } from '../../utils/fileUrl';

// lucide-react's brand/social icon set was removed upstream, so social links
// use a neutral link icon (website gets a globe) instead of per-network marks.
const SOCIAL_ICONS = { linkedin: Link2, twitter: Link2, facebook: Link2, website: Globe };

export default function TrainerDetailDrawer({ open, onClose, trainer }) {
  if (!trainer) return null;

  const socialEntries = Object.entries(trainer.socialLinks || {}).filter(([, url]) => url);

  return (
    <Drawer open={open} onClose={onClose} title={trainer.user?.name || 'Trainer'} width="w-[520px]">
      <div className="mb-4 flex items-center gap-4">
        <Avatar src={resolveFileUrl(trainer.profileImage)} name={trainer.user?.name} size={64} />
        <div>
          <p className="text-sm font-semibold text-slate-800">{trainer.user?.name}</p>
          <p className="text-xs text-slate-500">{trainer.user?.email}</p>
          <StatusBadge status={trainer.isActive ? 'active' : 'inactive'} />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-slate-400">Hourly Rate</p>
          <p className="text-slate-700">{trainer.hourlyRate ? `PKR ${trainer.hourlyRate.toLocaleString()}` : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Qualification</p>
          <p className="text-slate-700">{trainer.qualification || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Campuses</p>
          <p className="text-slate-700">{trainer.campuses?.map((c) => c.name).join(', ') || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Joining Date</p>
          <p className="text-slate-700">{trainer.joiningDate ? new Date(trainer.joiningDate).toLocaleDateString() : '—'}</p>
        </div>
      </div>

      <div className="mb-4">
        <p className="mb-1 text-xs font-medium text-slate-500">Assigned Courses</p>
        <div className="flex flex-wrap gap-1.5">
          {trainer.courses?.length ? (
            trainer.courses.map((c) => (
              <span key={c._id} className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
                {c.name}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400">No courses assigned</span>
          )}
        </div>
      </div>

      {socialEntries.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {socialEntries.map(([key, url]) => {
            const Icon = SOCIAL_ICONS[key];
            return (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium capitalize text-slate-500 hover:bg-slate-200 hover:text-primary-600"
              >
                <Icon size={14} /> {key}
              </a>
            );
          })}
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Biography</p>
        {trainer.bio ? (
          <div
            className="prose prose-sm max-w-none text-slate-600"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(trainer.bio) }}
          />
        ) : (
          <p className="text-xs text-slate-400">No biography on file.</p>
        )}
      </div>
    </Drawer>
  );
}
