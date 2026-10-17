import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Download,
  Eye,
  Pencil,
  Ban,
  Clock3,
  UserCheck,
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { hrService } from '@/core/api/services';
import { useCanMutate, useClientPagination } from '@/shared/hooks';
import { Pagination, StatCard } from '@/shared/components/ui';
import { todayBusinessKey } from '@/shared/utils/businessDate';
import { ATTENDANCE, type Attendance, type Shift, type ShiftInput, type StaffMember } from '../types/hr.types';
import {
  addDays,
  dateLabel,
  rosterCSV,
  shiftFormError,
  shiftMinutes,
  weekStart,
  weekdayLabel,
} from '../utils/roster';
import { download } from '../utils/download';
import { apiErrorMessage } from '../utils/apiError';
import { HrDrawer, Field, FormError, RegisterState } from '../components/HrDrawer';
import { LegacyHrImportBanner } from '../components/LegacyHrImportBanner';
import {
  buttonClass,
  dangerClass,
  inputClass,
  primaryClass,
  selectAutoClass,
} from '../components/hrStyles';

const statusClass: Record<Attendance, string> = {
  scheduled: 'border-slate-200 bg-slate-50 text-slate-600',
  present: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  late: 'border-amber-200 bg-amber-50 text-amber-700',
  absent: 'border-rose-200 bg-rose-50 text-rose-700',
  leave: 'border-blue-200 bg-blue-50 text-blue-700',
  cancelled: 'border-slate-200 bg-slate-100 text-slate-500',
};

function Status({ value }: { value: Attendance }) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-semibold capitalize ${statusClass[value]}`}
    >
      {value}
    </span>
  );
}

type ShiftDraft = ShiftInput & { id?: string };

function ShiftEditor({
  initial,
  staff,
  onSave,
  onClose,
}: {
  initial: ShiftDraft;
  staff: StaffMember[];
  onSave: (shift: ShiftDraft) => Promise<string | null>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isNew = !initial.id;
  const update = <K extends keyof ShiftDraft>(key: K, value: ShiftDraft[K]) =>
    setDraft((old) => ({ ...old, [key]: value }));
  const hours = shiftMinutes(draft) / 60;
  return (
    <HrDrawer title={isNew ? 'Add shift' : 'Edit shift & attendance'} onClose={onClose}>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={async (event) => {
          event.preventDefault();
          const problem = shiftFormError(draft, todayBusinessKey());
          if (problem) {
            setError(problem);
            return;
          }
          setSaving(true);
          const failure = await onSave(draft);
          setSaving(false);
          setError(failure ?? '');
        }}
      >
        <fieldset disabled={saving} className="flex-1 space-y-5 overflow-y-auto p-5">
          <Field label="Staff member">
            <select
              autoFocus
              required
              aria-label="Staff member"
              value={draft.staffId}
              onChange={(event) => update('staffId', event.target.value)}
              className={inputClass}
            >
              <option value="">Choose staff</option>
              {staff
                .filter((person) => person.active || person.id === initial.staffId)
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                    {person.role ? ` · ${person.role}` : ''}
                    {!person.active ? ' (inactive)' : ''}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Shift date">
            <input
              type="date"
              required
              value={draft.date}
              onChange={(event) => update('date', event.target.value)}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start time">
              <input
                type="time"
                required
                value={draft.start}
                onChange={(event) => update('start', event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="End time">
              <input
                type="time"
                required
                value={draft.end}
                onChange={(event) => update('end', event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.overnight}
              onChange={(event) => update('overnight', event.target.checked)}
              className="h-4 w-4 accent-violet-600"
            />
            Ends next day
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unpaid break (minutes)">
              <input
                type="number"
                required
                min="0"
                max="1439"
                step="1"
                value={Number.isNaN(draft.breakMinutes) ? '' : draft.breakMinutes}
                onChange={(event) => update('breakMinutes', event.target.valueAsNumber)}
                className={inputClass}
              />
            </Field>
            <Field label="Attendance">
              <select
                aria-label="Attendance"
                value={draft.status}
                onChange={(event) => update('status', event.target.value as Attendance)}
                className={`${inputClass} capitalize`}
              >
                {ATTENDANCE.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs text-violet-800">
            <strong>
              {Number.isFinite(hours) && hours > 0 && hours <= 24 ? hours.toFixed(2) : '—'} planned
              hours
            </strong>
            <p className="mt-1">
              Excludes unpaid break. Attendance is entered manually and does not change payroll
              amounts.
            </p>
          </div>
          <Field label="Notes (optional)">
            <textarea
              rows={3}
              maxLength={500}
              value={draft.notes}
              onChange={(event) => update('notes', event.target.value)}
              className={inputClass}
              placeholder="Handover, coverage, or attendance note"
            />
          </Field>
          <FormError message={error} />
        </fieldset>
        <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 p-4">
          <button type="button" onClick={onClose} className={buttonClass}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={primaryClass}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            {isNew ? 'Save shift' : 'Save changes'}
          </button>
        </footer>
      </form>
    </HrDrawer>
  );
}

type StaffDraft = Omit<StaffMember, 'id'> & { id?: string };

function StaffManager({
  staff,
  onSave,
  onClose,
}: {
  staff: StaffMember[];
  onSave: (person: StaffDraft) => Promise<string | null>;
  onClose: () => void;
}) {
  const blank = (): StaffDraft => ({ name: '', role: '', active: true });
  const [draft, setDraft] = useState<StaffDraft>(blank);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <HrDrawer title="Manage staff" subtitle="Shared by Staff Schedule and Payroll" onClose={onClose}>
      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <form
          className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const name = draft.name.trim();
            if (!name) {
              setError('Enter the staff member’s name.');
              return;
            }
            setSaving(true);
            const problem = await onSave({ ...draft, name, role: draft.role.trim() });
            setSaving(false);
            setError(problem ?? '');
            if (!problem) setDraft(blank());
          }}
        >
          <h3 className="text-sm font-bold">
            {draft.id ? `Edit ${draft.code ?? 'staff member'}` : 'Add staff member'}
          </h3>
          <fieldset disabled={saving} className="space-y-4">
            <Field label="Full name">
              <input
                autoFocus
                required
                maxLength={80}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Role / position">
              <input
                maxLength={80}
                value={draft.role}
                onChange={(event) => setDraft({ ...draft, role: event.target.value })}
                placeholder="e.g. Barista"
                className={inputClass}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
                className="h-4 w-4 accent-violet-600"
              />
              Active staff member
            </label>
          </fieldset>
          <FormError message={error} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className={primaryClass}>
              {saving && <Loader2 size={15} className="animate-spin" />}
              {draft.id ? 'Save staff' : 'Add staff'}
            </button>
            {draft.id && (
              <button
                type="button"
                onClick={() => {
                  setDraft(blank());
                  setError('');
                }}
                className={buttonClass}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
            Staff directory · {staff.length}
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            Deactivate staff to stop new shifts and payroll while keeping their history.
          </p>
          {!staff.length && (
            <p className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
              Add your first staff member above.
            </p>
          )}
          <ul className="divide-y divide-slate-100">
            {staff.map((person) => (
              <li key={person.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold">{person.name}</p>
                  <p className="text-xs text-slate-500">
                    {person.code ? `${person.code} · ` : ''}
                    {person.role || 'No role'} ·{' '}
                    <span className={person.active ? 'text-emerald-600' : 'text-slate-400'}>
                      {person.active ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(person);
                    setError('');
                  }}
                  aria-label={`Edit ${person.name}`}
                  className={buttonClass}
                >
                  <Pencil size={14} />
                  Edit
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </HrDrawer>
  );
}

type Overlay =
  | { kind: 'staff' }
  | { kind: 'edit'; shift: ShiftDraft }
  | { kind: 'view'; id: string }
  | { kind: 'cancel'; id: string }
  | { kind: 'export' }
  | null;

export default function StaffRoster() {
  const editable = useCanMutate();
  const [week, setWeek] = useState(() => weekStart(todayBusinessKey()));
  const [reloadToken, setReloadToken] = useState(0);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loaded, setLoaded] = useState<{ key: string; error: string } | null>(null);
  const [query, setQuery] = useState('');
  const [staffFilter, setStaffFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<Attendance | 'all'>('all');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [cancelling, setCancelling] = useState(false);

  const end = addDays(week, 6);
  const requestKey = `${week}:${reloadToken}`;
  const loading = loaded?.key !== requestKey;
  const loadError = loading ? '' : (loaded?.error ?? '');

  useEffect(() => {
    let active = true;
    Promise.all([hrService.listStaff(), hrService.listShifts(week, end)])
      .then(([staffRows, shiftRows]) => {
        if (!active) return;
        setStaff(staffRows);
        setShifts(shiftRows);
        setLoaded({ key: requestKey, error: '' });
      })
      .catch((error: unknown) => {
        if (active)
          setLoaded({ key: requestKey, error: apiErrorMessage(error, 'Could not load the schedule.') });
      });
    return () => {
      active = false;
    };
  }, [week, end, requestKey]);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  const staffById = useMemo(() => new Map(staff.map((person) => [person.id, person])), [staff]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return shifts
      .filter((shift) => {
        const person = staffById.get(shift.staffId);
        const matches = `${person?.name ?? ''} ${person?.role ?? ''} ${shift.notes}`
          .toLowerCase()
          .includes(term);
        return (
          matches &&
          (staffFilter === 'all' || shift.staffId === staffFilter) &&
          (statusFilter === 'all' || shift.status === statusFilter)
        );
      })
      .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
  }, [shifts, staffById, query, staffFilter, statusFilter]);

  const { paginatedData: visible, pagination } = useClientPagination(filtered, {
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 50],
  });
  const { goToFirstPage } = pagination;

  const hasFilters = Boolean(query || staffFilter !== 'all' || statusFilter !== 'all');
  const insights = useMemo(() => {
    const working = filtered.filter((shift) => !['cancelled', 'leave'].includes(shift.status));
    return {
      hours: working.reduce((sum, shift) => sum + shiftMinutes(shift), 0) / 60,
      attended: filtered.filter((shift) => ['present', 'late'].includes(shift.status)).length,
      late: filtered.filter((shift) => shift.status === 'late').length,
      absent: filtered.filter((shift) => shift.status === 'absent').length,
      leave: filtered.filter((shift) => shift.status === 'leave').length,
      assigned: new Set(
        filtered.filter((shift) => shift.status !== 'cancelled').map((shift) => shift.staffId)
      ).size,
    };
  }, [filtered]);

  const selected =
    overlay && 'id' in overlay ? shifts.find((shift) => shift.id === overlay.id) : undefined;
  const selectedStaff = selected ? staffById.get(selected.staffId) : undefined;
  const activeStaff = staff.some((person) => person.active);
  const close = () => setOverlay(null);

  function changeWeek(next: string) {
    setWeek(next);
    goToFirstPage();
  }

  function upsertShift(saved: Shift) {
    setShifts((old) => {
      const rest = old.filter((item) => item.id !== saved.id);
      return saved.date >= week && saved.date <= end ? [...rest, saved] : rest;
    });
  }

  async function saveShift(draft: ShiftDraft): Promise<string | null> {
    const { id, ...input } = draft;
    try {
      const saved = id ? await hrService.updateShift(id, input) : await hrService.createShift(input);
      upsertShift(saved);
      close();
      toast.success(id ? 'Shift updated' : 'Shift saved');
      return null;
    } catch (error) {
      return apiErrorMessage(error, 'Could not save the shift.');
    }
  }

  async function saveStaff(draft: StaffDraft): Promise<string | null> {
    const input = { name: draft.name, role: draft.role, active: draft.active };
    try {
      const saved = draft.id
        ? await hrService.updateStaff(draft.id, input)
        : await hrService.createStaff(input);
      setStaff((old) =>
        [...old.filter((item) => item.id !== saved.id), saved].sort(
          (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)
        )
      );
      toast.success(draft.id ? 'Staff member updated' : 'Staff member added');
      return null;
    } catch (error) {
      return apiErrorMessage(error, 'Could not save the staff member.');
    }
  }

  async function cancelShift(shift: Shift) {
    setCancelling(true);
    try {
      upsertShift(await hrService.updateShift(shift.id, { status: 'cancelled' }));
      close();
      toast.success('Shift cancelled. History retained.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not cancel the shift.'));
    } finally {
      setCancelling(false);
    }
  }

  function newShift() {
    const today = todayBusinessKey();
    setOverlay({
      kind: 'edit',
      shift: {
        staffId: '',
        date: week <= today && end >= today ? today : week,
        start: '16:00',
        end: '22:00',
        overnight: false,
        breakMinutes: 0,
        status: 'scheduled',
        notes: '',
      },
    });
  }

  return (
    <div className="min-w-0 space-y-4 pb-20 sm:pb-6">
      <LegacyHrImportBanner onImported={reload} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Planned hours"
          value={`${insights.hours.toFixed(1)} h`}
          subtext="Excludes leave and cancelled"
          icon={Clock3}
          colorClass="text-violet-600"
          bgClass="bg-violet-50"
        />
        <StatCard
          title="Attended shifts"
          value={String(insights.attended)}
          subtext={`${insights.late} late`}
          icon={UserCheck}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-50"
        />
        <StatCard
          title="Absent / leave"
          value={`${insights.absent} / ${insights.leave}`}
          subtext="Absent shifts · leave entries"
          icon={AlertCircle}
          colorClass="text-rose-600"
          bgClass="bg-rose-50"
        />
        <StatCard
          title="Staff assigned"
          value={String(insights.assigned)}
          subtext={`${staff.filter((person) => person.active).length} active in directory`}
          icon={Users}
          colorClass="text-blue-600"
          bgClass="bg-blue-50"
        />
      </div>

      <section
        aria-label="Staff schedule register"
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="space-y-4 border-b border-slate-200 bg-slate-50/60 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Shift register</h2>
              <p className="mt-1 text-xs text-slate-500">
                Plan shifts and record attendance · {dateLabel(week)} – {dateLabel(end)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={reload}
                disabled={loading}
                aria-label="Refresh schedule"
                className={buttonClass}
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
              {editable && (
                <>
                  <button
                    type="button"
                    onClick={() => setOverlay({ kind: 'staff' })}
                    disabled={loading || !!loadError}
                    className={buttonClass}
                  >
                    <Users size={15} />
                    Manage staff
                  </button>
                  <button
                    type="button"
                    onClick={newShift}
                    disabled={loading || !!loadError || !activeStaff}
                    className={primaryClass}
                  >
                    <Plus size={16} />
                    Add Shift
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
            <div className="relative w-full xl:max-w-xs">
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-3.5 text-slate-400"
              />
              <input
                aria-label="Search staff or notes"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  goToFirstPage();
                }}
                placeholder="Search staff, role, or notes…"
                className={`${inputClass} pl-9`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Schedule week"
                className="flex items-center rounded-xl border border-slate-200 bg-white p-1"
              >
                <button
                  type="button"
                  aria-label="Previous week"
                  onClick={() => changeWeek(addDays(week, -7))}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-violet-400"
                >
                  <ChevronLeft size={16} />
                </button>
                <label className="flex items-center gap-2 px-1 text-xs font-semibold text-slate-700">
                  <CalendarDays size={15} aria-hidden="true" />
                  <span className="sr-only">Choose a date in the week</span>
                  <input
                    type="date"
                    aria-label="Choose a date in the week"
                    value={week}
                    onChange={(event) => {
                      if (event.target.value) changeWeek(weekStart(event.target.value));
                    }}
                    className="min-h-8 min-w-0 bg-white text-xs outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                  />
                </label>
                <button
                  type="button"
                  aria-label="Next week"
                  onClick={() => changeWeek(addDays(week, 7))}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-violet-400"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => changeWeek(weekStart(todayBusinessKey()))}
                className={buttonClass}
              >
                This week
              </button>
              <button
                type="button"
                onClick={() => setOverlay({ kind: 'export' })}
                disabled={!filtered.length}
                className={buttonClass}
              >
                <Download size={15} />
                Export CSV
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter staff"
              value={staffFilter}
              onChange={(event) => {
                setStaffFilter(event.target.value);
                goToFirstPage();
              }}
              className={`${selectAutoClass} max-w-full`}
            >
              <option value="all">All staff</option>
              {staff.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                  {!person.active ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter attendance"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as Attendance | 'all');
                goToFirstPage();
              }}
              className={`${selectAutoClass} capitalize`}
            >
              <option value="all">All statuses</option>
              {ATTENDANCE.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setStaffFilter('all');
                  setStatusFilter('all');
                  goToFirstPage();
                }}
                className="px-2 text-xs font-semibold text-violet-600 underline underline-offset-2"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
        {loading || loadError ? (
          <RegisterState loading={loading} error={loadError} onRetry={reload} />
        ) : !visible.length ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="rounded-2xl bg-violet-50 p-4 text-violet-400">
              <Users size={28} />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">
              {!staff.length ? 'Start with your team' : 'No shifts found'}
            </h3>
            <p className="max-w-xs text-xs leading-relaxed text-slate-500">
              {!staff.length
                ? 'Add staff members, then assign their shifts.'
                : hasFilters
                  ? 'Adjust your filters to see more shifts.'
                  : 'Choose another week or add a shift for this period.'}
            </p>
            {editable &&
              (!staff.length ? (
                <button
                  type="button"
                  onClick={() => setOverlay({ kind: 'staff' })}
                  className={primaryClass}
                >
                  <Plus size={15} />
                  Add staff
                </button>
              ) : (
                <button
                  type="button"
                  onClick={newShift}
                  disabled={!activeStaff}
                  className={buttonClass}
                >
                  <Plus size={15} />
                  Add Shift
                </button>
              ))}
          </div>
        ) : (
          <div className="max-h-[560px] overflow-auto [scrollbar-width:thin]">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  {['Date', 'Staff', 'Shift', 'Planned hours', 'Attendance', 'Actions'].map(
                    (title) => (
                      <th
                        scope="col"
                        key={title}
                        className={`px-4 py-3 ${title === 'Actions' ? 'text-right' : title === 'Planned hours' ? 'text-right' : ''}`}
                      >
                        {title}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((shift) => {
                  const person = staffById.get(shift.staffId);
                  const cancelled = shift.status === 'cancelled';
                  return (
                    <tr
                      key={shift.id}
                      className={`hover:bg-violet-50/30 ${cancelled ? 'text-slate-400' : ''}`}
                    >
                      <td className="whitespace-nowrap px-4 py-4">
                        <p className="font-semibold text-slate-700">{weekdayLabel(shift.date)}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{dateLabel(shift.date)}</p>
                      </td>
                      <td className="max-w-[200px] px-4 py-4">
                        <p className="truncate font-semibold text-slate-800">{person?.name}</p>
                        <p className="mt-1 truncate text-[11px] text-slate-400">
                          {person?.role || 'Staff'}
                          {person && !person.active ? ' · Inactive' : ''}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <p className={`font-medium ${cancelled ? 'line-through' : 'text-slate-700'}`}>
                          {shift.start} – {shift.end}
                          {shift.overnight && (
                            <span className="ml-1 text-[10px] text-violet-600">+1 day</span>
                          )}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {shift.breakMinutes} min break
                        </p>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-700">
                        {(shiftMinutes(shift) / 60).toFixed(2)} h
                      </td>
                      <td className="px-4 py-4">
                        <Status value={shift.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setOverlay({ kind: 'view', id: shift.id })}
                            className={buttonClass}
                          >
                            <Eye size={14} />
                            View
                          </button>
                          {editable && (
                            <button
                              type="button"
                              onClick={() => setOverlay({ kind: 'edit', shift })}
                              aria-label={`Edit shift for ${person?.name} on ${shift.date}`}
                              className={buttonClass}
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          {editable && !cancelled && (
                            <button
                              type="button"
                              onClick={() => setOverlay({ kind: 'cancel', id: shift.id })}
                              aria-label={`Cancel shift for ${person?.name} on ${shift.date}`}
                              className={`${buttonClass} text-rose-600`}
                            >
                              <Ban size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3">
          <p className="text-xs text-slate-500">
            <strong className="text-slate-700">{filtered.length}</strong> shifts ·{' '}
            {insights.hours.toFixed(2)} planned hours
          </p>
          {filtered.length > 0 && <Pagination pagination={pagination} />}
        </footer>
      </section>

      {overlay?.kind === 'staff' && editable && (
        <StaffManager staff={staff} onSave={saveStaff} onClose={close} />
      )}
      {overlay?.kind === 'edit' && editable && (
        <ShiftEditor
          key={overlay.shift.id ?? 'new'}
          initial={overlay.shift}
          staff={staff}
          onSave={saveShift}
          onClose={close}
        />
      )}
      {overlay?.kind === 'view' && selected && (
        <HrDrawer
          title="Shift details"
          subtitle={`${weekdayLabel(selected.date)}, ${dateLabel(selected.date)}`}
          onClose={close}
        >
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">{selectedStaff?.name}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedStaff?.code ? `${selectedStaff.code} · ` : ''}
                  {selectedStaff?.role || 'Staff'}
                </p>
              </div>
              <Status value={selected.status} />
            </div>
            <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
              {[
                ['Date', dateLabel(selected.date)],
                [
                  'Shift',
                  `${selected.start} – ${selected.end}${selected.overnight ? ' (next day)' : ''}`,
                ],
                ['Unpaid break', `${selected.breakMinutes} minutes`],
                ['Planned hours', `${(shiftMinutes(selected) / 60).toFixed(2)} h`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 px-4 py-3">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
            <div>
              <h4 className="mb-1 text-xs font-semibold text-slate-500">Notes</h4>
              <p className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                {selected.notes || 'No notes'}
              </p>
            </div>
          </div>
          {editable && (
            <footer className="border-t border-slate-200 p-4">
              <button
                type="button"
                onClick={() => setOverlay({ kind: 'edit', shift: selected })}
                className={primaryClass}
              >
                <Pencil size={15} />
                Edit shift & attendance
              </button>
            </footer>
          )}
        </HrDrawer>
      )}
      {overlay?.kind === 'cancel' && selected && editable && (
        <HrDrawer title="Cancel shift" onClose={close}>
          <div className="flex-1 space-y-4 p-5">
            <p className="text-sm text-slate-600">
              Cancel the shift for <strong>{selectedStaff?.name}</strong> on{' '}
              {dateLabel(selected.date)} ({selected.start} – {selected.end})? The record stays in
              history with Cancelled status.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={cancelling}
                onClick={() => cancelShift(selected)}
                className={dangerClass}
              >
                {cancelling && <Loader2 size={15} className="animate-spin" />}
                Confirm cancellation
              </button>
              <button type="button" onClick={close} className={buttonClass}>
                Keep shift
              </button>
            </div>
          </div>
        </HrDrawer>
      )}
      {overlay?.kind === 'export' && (
        <HrDrawer
          title="Export preview"
          subtitle={`${dateLabel(week)} – ${dateLabel(end)} · ${filtered.length} records`}
          onClose={close}
          wide
        >
          <div className="flex-1 overflow-auto p-5">
            <p className="mb-4 text-xs text-slate-500">
              CSV includes role, break, planned hours, attendance, and notes for the filtered
              shifts.
            </p>
            <table className="w-full min-w-[460px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  {['Date', 'Staff', 'Shift', 'Status'].map((label) => (
                    <th key={label} className="border-b border-slate-200 p-2">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((shift) => (
                  <tr key={shift.id}>
                    <td className="border-b border-slate-100 p-2">{shift.date}</td>
                    <td className="border-b border-slate-100 p-2">
                      {staffById.get(shift.staffId)?.name}
                    </td>
                    <td className="border-b border-slate-100 p-2">
                      {shift.start} – {shift.end}
                      {shift.overnight ? ' +1 day' : ''}
                    </td>
                    <td className="border-b border-slate-100 p-2 capitalize">{shift.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="flex justify-end border-t border-slate-200 p-4">
            <button
              type="button"
              disabled={!filtered.length}
              onClick={() =>
                download(
                  rosterCSV(filtered, staff),
                  `staff-schedule-${week}.csv`,
                  'text/csv;charset=utf-8'
                )
              }
              className={primaryClass}
            >
              <Download size={15} />
              Download CSV
            </button>
          </footer>
        </HrDrawer>
      )}
    </div>
  );
}
