import { Eye } from 'lucide-react';
import { ROLE_DESCRIPTIONS } from '@/shared/utils';

/** Sticky banner shown across the dashboard for read-only visitors. */
export function ReadOnlyBanner() {
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 flex items-start gap-3 shadow-sm">
      <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
        <Eye size={16} className="text-sky-600" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-sky-900">Read-only preview</p>
        <p className="text-xs text-sky-700 mt-0.5 leading-relaxed">
          {ROLE_DESCRIPTIONS.visitor} Sign in as Owner or Manager to record orders and edit data.
        </p>
      </div>
    </div>
  );
}
