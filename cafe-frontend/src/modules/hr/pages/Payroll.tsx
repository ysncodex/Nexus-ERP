import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Pencil,
  Check,
  RefreshCw,
  Loader2,
  Wallet,
  CircleDollarSign,
  FileClock,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { hrService } from '@/core/api/services';
import { useERPActions } from '@/core/context/useERPActions';
import { useCanMutate, useClientPagination } from '@/shared/hooks';
import { Pagination, StatCard } from '@/shared/components/ui';
import { todayBusinessKey } from '@/shared/utils/businessDate';
import {
  MONEY_FIELDS,
  type MoneyField,
  type PaymentMethod,
  type PayrollDraftInput,
  type PayrollPaymentInput,
  type PayrollRecord,
  type PayrollStatus,
  type StaffMember,
} from '../types/hr.types';
import {
  METHOD_LABELS,
  due,
  gross,
  monthLabel,
  moveMonth,
  net,
  paid,
  payrollCSV,
  payrollStatus,
  taka,
  toPaisa,
  validMonth,
} from '../utils/payroll';
import { dateLabel } from '../utils/roster';
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

const labels: Record<MoneyField, string> = {
  basic: 'Basic salary',
  allowance: 'Allowance',
  bonus: 'Bonus',
  overtime: 'Overtime amount',
  deductions: 'Deductions',
};
const statusNames: Record<PayrollStatus, string> = {
  draft: 'Draft',
  unpaid: 'Unpaid',
  partial: 'Part-paid',
  paid: 'Paid',
  void: 'Void',
};
const statusColors: Record<PayrollStatus, string> = {
  draft: 'border-slate-200 bg-slate-50 text-slate-600',
  unpaid: 'border-amber-200 bg-amber-50 text-amber-700',
  partial: 'border-blue-200 bg-blue-50 text-blue-700',
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  void: 'border-rose-200 bg-rose-50 text-rose-600',
};

function Badge({ record }: { record: PayrollRecord }) {
  const value = payrollStatus(record);
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-semibold ${statusColors[value]}`}
    >
      {statusNames[value]}
    </span>
  );
}

type PayrollDraft = PayrollDraftInput & { id?: string; staffName?: string };

function Editor({
  record,
  staff,
  onSave,
  onClose,
}: {
  record: PayrollDraft;
  staff: StaffMember[];
  onSave: (record: PayrollDraft) => Promise<string | null>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(record);
  const [amounts, setAmounts] = useState<Record<MoneyField, string>>(
    () =>
      Object.fromEntries(
        MONEY_FIELDS.map((key) => [key, (record[key] / 100).toFixed(2)])
      ) as Record<MoneyField, string>
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const values = Object.fromEntries(
    MONEY_FIELDS.map((key) => [key, toPaisa(amounts[key]) ?? 0])
  ) as Record<MoneyField, number>;
  const options = staff.filter((person) => person.active || person.id === record.staffId);
  return (
    <HrDrawer
      title={record.id ? 'Edit payroll draft' : 'New payroll draft'}
      subtitle="Amounts lock when the payroll is approved"
      onClose={onClose}
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!draft.staffId) {
            setError('Choose a staff member.');
            return;
          }
          if (!validMonth(draft.month)) {
            setError('Choose a valid payroll month.');
            return;
          }
          if (MONEY_FIELDS.some((key) => toPaisa(amounts[key]) === null)) {
            setError('Enter valid non-negative amounts with at most two decimal places.');
            return;
          }
          if (net(values) <= 0) {
            setError('Net pay must be greater than zero. Check salary and deductions.');
            return;
          }
          setSaving(true);
          const failure = await onSave({ ...draft, ...values, notes: draft.notes.trim() });
          setSaving(false);
          setError(failure ?? '');
        }}
      >
        <fieldset disabled={saving} className="flex-1 space-y-4 overflow-y-auto p-5">
          <Field label="Staff member">
            <select
              aria-label="Staff member"
              autoFocus
              required
              value={draft.staffId}
              onChange={(event) => setDraft({ ...draft, staffId: event.target.value })}
              className={inputClass}
            >
              <option value="">Choose staff</option>
              {options.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                  {person.role ? ` · ${person.role}` : ''}
                  {person.active ? '' : ' (inactive)'}
                </option>
              ))}
              {record.staffId && !options.some((person) => person.id === record.staffId) && (
                <option value={record.staffId}>{record.staffName ?? 'Staff'} (historical)</option>
              )}
            </select>
          </Field>
          <Field label="Payroll month">
            <input
              type="month"
              required
              value={draft.month}
              onChange={(event) => setDraft({ ...draft, month: event.target.value })}
              className={inputClass}
            />
          </Field>
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            All amounts are in BDT. Enter the agreed salary and adjustments; attendance, overtime
            rates, tax, and leave deductions are not calculated automatically.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {MONEY_FIELDS.map((key) => (
              <Field key={key} label={`${labels[key]} (৳)`}>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  maxLength={11}
                  value={amounts[key]}
                  onChange={(event) => setAmounts({ ...amounts, [key]: event.target.value })}
                  className={`${inputClass} text-right tabular-nums`}
                />
              </Field>
            ))}
          </div>
          <div className="rounded-xl border border-violet-100 bg-violet-50 p-4">
            <div className="flex justify-between text-xs text-violet-700">
              <span>Gross pay</span>
              <span className="tabular-nums">{taka(gross(values))}</span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-violet-700">
              <span>Deductions</span>
              <span className="tabular-nums">− {taka(values.deductions)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-violet-200 pt-2 font-bold text-violet-900">
              <span>Net pay</span>
              <span className="tabular-nums">{taka(net(values))}</span>
            </div>
          </div>
          <Field label="Notes / adjustment explanation">
            <textarea
              rows={3}
              maxLength={500}
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              className={inputClass}
            />
          </Field>
          <FormError message={error} />
        </fieldset>
        <footer className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button type="button" onClick={onClose} className={buttonClass}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={primaryClass}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            Save draft
          </button>
        </footer>
      </form>
    </HrDrawer>
  );
}

function PaymentEditor({
  record,
  onSave,
  onClose,
}: {
  record: PayrollRecord;
  onSave: (payment: PayrollPaymentInput) => Promise<string | null>;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState((due(record) / 100).toFixed(2));
  const [date, setDate] = useState(todayBusinessKey);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Same id for every retry from this drawer, so the server posts the expense only once.
  const [requestId] = useState(() => crypto.randomUUID());
  const today = todayBusinessKey();
  return (
    <HrDrawer
      title="Pay salary"
      subtitle={`${record.staffName} · ${monthLabel(record.month)}`}
      onClose={onClose}
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={async (event) => {
          event.preventDefault();
          const value = toPaisa(amount);
          if (value === null || value <= 0) {
            setError('Enter a payment amount greater than zero with at most two decimal places.');
            return;
          }
          if (value > due(record)) {
            setError(`Payment cannot exceed the outstanding amount (${taka(due(record))}).`);
            return;
          }
          if (!date || date > today) {
            setError('Choose a valid payment date that is not in the future.');
            return;
          }
          setSaving(true);
          const failure = await onSave({
            amount: value,
            date,
            method,
            reference: reference.trim(),
            requestId,
          });
          setSaving(false);
          setError(failure ?? '');
        }}
      >
        <fieldset disabled={saving} className="flex-1 space-y-5 overflow-y-auto p-5">
          <dl className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 p-3 text-center text-xs">
            <div>
              <dt className="text-slate-500">Net pay</dt>
              <dd className="mt-1 font-semibold tabular-nums">{taka(net(record))}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Paid</dt>
              <dd className="mt-1 font-semibold tabular-nums">{taka(paid(record))}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Outstanding</dt>
              <dd className="mt-1 font-bold tabular-nums text-violet-700">{taka(due(record))}</dd>
            </div>
          </dl>
          <Field label="Payment amount (৳)">
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={`${inputClass} text-right tabular-nums`}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment date">
              <input
                type="date"
                required
                max={today}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Paid from">
              <select
                aria-label="Paid from"
                value={method}
                onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                className={inputClass}
              >
                {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((key) => (
                  <option key={key} value={key}>
                    {METHOD_LABELS[key]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Reference / receipt number (optional)">
            <input
              maxLength={120}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              className={inputClass}
            />
          </Field>
          <p className="rounded-lg border border-violet-100 bg-violet-50 p-3 text-xs text-violet-900">
            Records a <strong>Fixed Expense (Salaries)</strong> paid from{' '}
            <strong>{METHOD_LABELS[method]}</strong>. It reduces that account balance and appears
            in Fixed Expenses, Daily Summary, and the P&amp;L. Reverse it from Payroll if it was a
            mistake.
          </p>
          <FormError message={error} />
        </fieldset>
        <footer className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button type="button" onClick={onClose} className={buttonClass}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={primaryClass}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            Confirm payment
          </button>
        </footer>
      </form>
    </HrDrawer>
  );
}

type Overlay =
  | { kind: 'edit'; record: PayrollDraft }
  | { kind: 'view' | 'payment' | 'void' | 'approve'; id: string }
  | { kind: 'reverse'; id: string; paymentId: string }
  | { kind: 'export' }
  | null;

export default function Payroll() {
  const editable = useCanMutate();
  const { refreshTransactions, refreshCatalogs } = useERPActions();
  const [month, setMonth] = useState(() => todayBusinessKey().slice(0, 7));
  const [reloadToken, setReloadToken] = useState(0);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loaded, setLoaded] = useState<{ key: string; error: string } | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PayrollStatus | 'all'>('all');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const requestKey = `${month}:${reloadToken}`;
  const loading = loaded?.key !== requestKey;
  const loadError = loading ? '' : (loaded?.error ?? '');

  useEffect(() => {
    let active = true;
    Promise.all([hrService.listStaff(), hrService.listPayroll(month)])
      .then(([staffRows, payrollRows]) => {
        if (!active) return;
        setStaff(staffRows);
        setRecords(payrollRows);
        setLoaded({ key: requestKey, error: '' });
      })
      .catch((error: unknown) => {
        if (active)
          setLoaded({ key: requestKey, error: apiErrorMessage(error, 'Could not load payroll.') });
      });
    return () => {
      active = false;
    };
  }, [month, requestKey]);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return records
      .filter(
        (record) =>
          (filter === 'all' || payrollStatus(record) === filter) &&
          `${record.staffName} ${record.role} ${record.notes} ${record.code ?? ''}`
            .toLowerCase()
            .includes(term)
      )
      .sort((a, b) => a.staffName.localeCompare(b.staffName));
  }, [records, filter, query]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, record) => {
          if (record.stage === 'void') return sum;
          if (record.stage === 'draft') {
            sum.drafts += net(record);
            sum.draftCount += 1;
          } else {
            sum.net += net(record);
            sum.paid += paid(record);
            sum.due += due(record);
            sum.approvedCount += 1;
          }
          return sum;
        },
        { net: 0, paid: 0, due: 0, drafts: 0, draftCount: 0, approvedCount: 0 }
      ),
    [rows]
  );

  const { paginatedData: visible, pagination } = useClientPagination(rows, {
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 50],
  });
  const { goToFirstPage } = pagination;

  const selected =
    overlay && 'id' in overlay ? records.find((record) => record.id === overlay.id) : undefined;
  const reversing =
    overlay?.kind === 'reverse' && selected
      ? selected.payments.find((payment) => payment.id === overlay.paymentId)
      : undefined;
  const activeStaff = staff.some((person) => person.active);

  const close = () => {
    setOverlay(null);
    setActionError('');
  };

  function changeMonth(next: string) {
    setMonth(next);
    goToFirstPage();
  }

  function replaceRecord(saved: PayrollRecord) {
    setRecords((old) => {
      const rest = old.filter((item) => item.id !== saved.id);
      return saved.month === month ? [...rest, saved] : rest;
    });
  }

  /** Ledger changed (Fixed Expense added/removed): refresh dashboard totals and balances. */
  function syncLedger() {
    void refreshTransactions({ silent: true });
    void refreshCatalogs();
  }

  async function saveDraft(draft: PayrollDraft): Promise<string | null> {
    const input: PayrollDraftInput = {
      staffId: draft.staffId,
      month: draft.month,
      notes: draft.notes,
      basic: draft.basic,
      allowance: draft.allowance,
      bonus: draft.bonus,
      overtime: draft.overtime,
      deductions: draft.deductions,
    };
    try {
      const saved = draft.id
        ? await hrService.updatePayroll(draft.id, input)
        : await hrService.createPayroll(input);
      replaceRecord(saved);
      close();
      toast.success(
        saved.month === month
          ? 'Payroll draft saved'
          : `Payroll draft saved under ${monthLabel(saved.month)}`
      );
      return null;
    } catch (error) {
      return apiErrorMessage(error, 'Could not save the payroll draft.');
    }
  }

  async function recordPayment(payment: PayrollPaymentInput): Promise<string | null> {
    if (!selected) return 'Payroll record was not found.';
    try {
      replaceRecord(await hrService.recordPayment(selected.id, payment));
      setOverlay({ kind: 'view', id: selected.id });
      toast.success(
        `Salary paid · ${taka(payment.amount)} recorded as a Fixed Expense from ${METHOD_LABELS[payment.method]}`
      );
      syncLedger();
      return null;
    } catch (error) {
      return apiErrorMessage(error, 'Could not record the payment.');
    }
  }

  async function runAction(
    action: () => Promise<PayrollRecord>,
    success: string,
    options: { ledger?: boolean; next?: Overlay } = {}
  ) {
    setBusy(true);
    setActionError('');
    try {
      replaceRecord(await action());
      setOverlay(options.next ?? null);
      toast.success(success);
      if (options.ledger) syncLedger();
    } catch (error) {
      setActionError(apiErrorMessage(error, 'The action could not be completed.'));
    } finally {
      setBusy(false);
    }
  }

  function newDraft() {
    setOverlay({
      kind: 'edit',
      record: {
        staffId: '',
        month,
        basic: 0,
        allowance: 0,
        bonus: 0,
        overtime: 0,
        deductions: 0,
        notes: '',
      },
    });
  }

  return (
    <div className="min-w-0 space-y-4 pb-20 sm:pb-6">
      <LegacyHrImportBanner onImported={reload} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Approved net"
          value={taka(totals.net)}
          subtext={`${totals.approvedCount} approved · ${monthLabel(month)}`}
          icon={CircleDollarSign}
          colorClass="text-violet-600"
          bgClass="bg-violet-50"
        />
        <StatCard
          title="Paid"
          value={taka(totals.paid)}
          subtext="Posted as Fixed Expenses (Salaries)"
          icon={Wallet}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-50"
        />
        <StatCard
          title="Outstanding"
          value={taka(totals.due)}
          subtext="Approved but not yet paid"
          icon={Banknote}
          colorClass="text-amber-600"
          bgClass="bg-amber-50"
        />
        <StatCard
          title="Drafts"
          value={taka(totals.drafts)}
          subtext={`${totals.draftCount} awaiting approval`}
          icon={FileClock}
          colorClass="text-slate-600"
          bgClass="bg-slate-100"
        />
      </div>

      <section
        aria-label="Payroll register"
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="space-y-4 border-b border-slate-200 bg-slate-50/60 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Salary register</h2>
              <p className="mt-1 text-xs text-slate-500">
                Prepare, approve, and pay salaries · {monthLabel(month)} · BDT
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={reload}
                disabled={loading}
                aria-label="Refresh payroll"
                className={buttonClass}
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
              {editable && (
                <button
                  type="button"
                  onClick={newDraft}
                  disabled={loading || !!loadError || !activeStaff}
                  title={!activeStaff ? 'Add active staff on Staff Schedule first' : undefined}
                  className={primaryClass}
                >
                  <Plus size={16} />
                  New Payroll
                </button>
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
                aria-label="Search payroll"
                placeholder="Search staff, role, ID, or notes…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  goToFirstPage();
                }}
                className={`${inputClass} pl-9`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Payroll month"
                className="flex items-center rounded-xl border border-slate-200 bg-white p-1"
              >
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => changeMonth(moveMonth(month, -1))}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-violet-400"
                >
                  <ChevronLeft size={16} />
                </button>
                <input
                  type="month"
                  aria-label="Choose payroll month"
                  value={month}
                  onChange={(event) => {
                    if (validMonth(event.target.value)) changeMonth(event.target.value);
                  }}
                  className="min-h-8 min-w-0 max-w-[170px] rounded bg-white px-1 text-xs font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                />
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => changeMonth(moveMonth(month, 1))}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-violet-400"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <button
                type="button"
                disabled={!rows.length}
                onClick={() => setOverlay({ kind: 'export' })}
                className={buttonClass}
              >
                <Download size={15} />
                Export CSV
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter payroll status"
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value as PayrollStatus | 'all');
                goToFirstPage();
              }}
              className={selectAutoClass}
            >
              <option value="all">All statuses</option>
              {Object.entries(statusNames).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            {(query || filter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setFilter('all');
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
              <Banknote size={28} />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">
              {!staff.length ? 'Add your team first' : 'No payroll records found'}
            </h3>
            <p className="max-w-sm text-xs leading-relaxed text-slate-500">
              {!staff.length
                ? 'Add staff on Staff Schedule, then return here to prepare payroll.'
                : 'Choose another month, clear filters, or create a payroll draft.'}
            </p>
            {editable && activeStaff && (
              <button type="button" onClick={newDraft} className={buttonClass}>
                <Plus size={15} />
                New Payroll
              </button>
            )}
          </div>
        ) : (
          <div className="max-h-[560px] overflow-auto [scrollbar-width:thin]">
            <table className="w-full min-w-[840px] text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  {['Staff', 'Gross', 'Deductions', 'Net pay', 'Paid', 'Due', 'Status', 'Actions'].map(
                    (label, index) => (
                      <th
                        key={label}
                        scope="col"
                        className={`px-4 py-3 ${index > 0 && index < 6 ? 'text-right' : ''} ${label === 'Actions' ? 'text-right' : ''}`}
                      >
                        {label}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((record) => {
                  const isVoid = record.stage === 'void';
                  return (
                    <tr
                      key={record.id}
                      className={`hover:bg-violet-50/30 ${isVoid ? 'text-slate-400' : ''}`}
                    >
                      <td className="max-w-[220px] px-4 py-4">
                        <p className="truncate font-semibold text-slate-800">{record.staffName}</p>
                        <p className="mt-1 truncate text-[11px] text-slate-400">
                          {record.code ? `${record.code} · ` : ''}
                          {record.role || 'Staff'}
                        </p>
                      </td>
                      {[gross(record), record.deductions, net(record), paid(record), due(record)].map(
                        (amount, index) => (
                          <td
                            key={index}
                            className={`whitespace-nowrap px-4 py-4 text-right tabular-nums ${
                              isVoid
                                ? 'line-through'
                                : index === 2
                                  ? 'font-bold text-violet-700'
                                  : index === 4 && amount > 0
                                    ? 'font-semibold text-amber-700'
                                    : 'text-slate-600'
                            }`}
                          >
                            {taka(amount)}
                          </td>
                        )
                      )}
                      <td className="px-4 py-4">
                        <Badge record={record} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {editable && record.stage === 'approved' && due(record) > 0 && (
                            <button
                              type="button"
                              onClick={() => setOverlay({ kind: 'payment', id: record.id })}
                              className={`${buttonClass} border-violet-200 text-violet-700 hover:bg-violet-50`}
                            >
                              <Banknote size={14} />
                              Pay
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setOverlay({ kind: 'view', id: record.id })}
                            className={buttonClass}
                          >
                            <Eye size={14} />
                            View
                          </button>
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
          <span className="text-xs text-slate-500">
            {rows.length} records · Outstanding{' '}
            <strong className="text-violet-700">{taka(totals.due)}</strong>
          </span>
          {rows.length > 0 && <Pagination pagination={pagination} />}
        </footer>
      </section>

      {overlay?.kind === 'edit' && editable && (
        <Editor
          key={overlay.record.id ?? 'new'}
          record={overlay.record}
          staff={staff}
          onSave={saveDraft}
          onClose={close}
        />
      )}
      {overlay?.kind === 'payment' && selected && editable && (
        <PaymentEditor record={selected} onSave={recordPayment} onClose={close} />
      )}
      {overlay?.kind === 'view' && selected && (
        <HrDrawer
          title="Payroll details"
          subtitle={`${selected.code ?? 'Payroll'} · ${monthLabel(selected.month)}`}
          onClose={close}
        >
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">{selected.staffName}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {selected.role || 'Staff'} · {monthLabel(selected.month)}
                </p>
              </div>
              <Badge record={selected} />
            </div>
            <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
              {MONEY_FIELDS.map((key) => (
                <div key={key} className="flex justify-between gap-3 px-4 py-2.5">
                  <dt className="text-slate-500">{labels[key]}</dt>
                  <dd className="font-medium tabular-nums">
                    {key === 'deductions' && selected[key] > 0 ? '− ' : ''}
                    {taka(selected[key])}
                  </dd>
                </div>
              ))}
              <div className="flex justify-between bg-violet-50/60 px-4 py-3 font-bold text-violet-700">
                <dt>Net pay</dt>
                <dd className="tabular-nums">{taka(net(selected))}</dd>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <dt className="text-slate-500">Paid</dt>
                <dd className="font-medium tabular-nums">{taka(paid(selected))}</dd>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <dt className="text-slate-500">Outstanding</dt>
                <dd className="font-semibold tabular-nums text-amber-700">{taka(due(selected))}</dd>
              </div>
            </dl>
            <p className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              {selected.notes || 'No adjustment notes.'}
            </p>
            <div>
              <h4 className="mb-3 text-sm font-bold">Payment history</h4>
              {!selected.payments.length ? (
                <p className="text-xs text-slate-500">No payments recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {selected.payments.map((payment) => (
                    <li key={payment.id} className="rounded-xl border border-slate-200 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-700">
                          {dateLabel(payment.date)} · {METHOD_LABELS[payment.method]}
                        </span>
                        <strong className="tabular-nums">{taka(payment.amount)}</strong>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="min-w-0 break-words text-slate-500">
                          {payment.reference || 'No reference'} ·{' '}
                          {payment.postedToLedger ? (
                            <span className="text-emerald-600">Fixed Expense posted</span>
                          ) : (
                            <span className="text-slate-400">Imported · not in ledger</span>
                          )}
                        </p>
                        {editable && (
                          <button
                            type="button"
                            onClick={() =>
                              setOverlay({ kind: 'reverse', id: selected.id, paymentId: payment.id })
                            }
                            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 font-semibold text-rose-600 hover:bg-rose-50"
                          >
                            <Undo2 size={13} />
                            Reverse
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {editable && selected.stage !== 'void' && (
            <footer className="flex flex-wrap gap-2 border-t border-slate-200 p-4">
              {selected.stage === 'draft' && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setOverlay({
                        kind: 'edit',
                        record: {
                          id: selected.id,
                          staffId: selected.staffId,
                          staffName: selected.staffName,
                          month: selected.month,
                          notes: selected.notes,
                          basic: selected.basic,
                          allowance: selected.allowance,
                          bonus: selected.bonus,
                          overtime: selected.overtime,
                          deductions: selected.deductions,
                        },
                      })
                    }
                    className={buttonClass}
                  >
                    <Pencil size={14} />
                    Edit draft
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverlay({ kind: 'approve', id: selected.id })}
                    className={primaryClass}
                  >
                    <Check size={15} />
                    Approve
                  </button>
                </>
              )}
              {selected.stage === 'approved' && due(selected) > 0 && (
                <button
                  type="button"
                  onClick={() => setOverlay({ kind: 'payment', id: selected.id })}
                  className={primaryClass}
                >
                  <Banknote size={15} />
                  Pay salary
                </button>
              )}
              {!selected.payments.length && (
                <button
                  type="button"
                  onClick={() => setOverlay({ kind: 'void', id: selected.id })}
                  className={`${buttonClass} text-rose-600`}
                >
                  Void record
                </button>
              )}
            </footer>
          )}
        </HrDrawer>
      )}
      {(overlay?.kind === 'approve' || overlay?.kind === 'void') && selected && editable && (
        <HrDrawer
          title={overlay.kind === 'approve' ? 'Approve payroll' : 'Void payroll'}
          onClose={close}
        >
          <div className="flex-1 space-y-4 p-5">
            <p className="text-sm font-semibold text-slate-700">
              {selected.staffName} · {monthLabel(selected.month)} · {taka(net(selected))}
            </p>
            <p className="text-sm text-slate-600">
              {overlay.kind === 'approve'
                ? 'Confirm the salary and adjustments. Approval locks the amounts and enables salary payments. Nothing is paid yet.'
                : 'This record stays in history as Void and is excluded from totals. You can create a replacement draft for the same month.'}
            </p>
            <FormError message={actionError} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  overlay.kind === 'approve'
                    ? runAction(
                        () => hrService.approvePayroll(selected.id),
                        'Payroll approved. Salary can now be paid.',
                        { next: { kind: 'view', id: selected.id } }
                      )
                    : runAction(
                        () => hrService.voidPayroll(selected.id),
                        'Payroll voided. History retained.'
                      )
                }
                className={overlay.kind === 'approve' ? primaryClass : dangerClass}
              >
                {busy && <Loader2 size={15} className="animate-spin" />}
                {overlay.kind === 'approve' ? 'Confirm approval' : 'Confirm void'}
              </button>
              <button type="button" onClick={close} className={buttonClass}>
                Cancel
              </button>
            </div>
          </div>
        </HrDrawer>
      )}
      {overlay?.kind === 'reverse' && selected && reversing && editable && (
        <HrDrawer title="Reverse salary payment" onClose={close}>
          <div className="flex-1 space-y-4 p-5">
            <p className="text-sm font-semibold text-slate-700">
              {selected.staffName} · {taka(reversing.amount)} · {dateLabel(reversing.date)} ·{' '}
              {METHOD_LABELS[reversing.method]}
            </p>
            <p className="text-sm text-slate-600">
              {reversing.postedToLedger
                ? `This removes the payment and its Fixed Expense (Salaries) entry. The ${METHOD_LABELS[reversing.method]} balance goes back up by ${taka(reversing.amount)}.`
                : 'This removes the imported payment record. It was never posted to the ledger, so balances do not change.'}
            </p>
            <FormError message={actionError} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  runAction(
                    () => hrService.reversePayment(selected.id, reversing.id),
                    'Payment reversed.',
                    { ledger: reversing.postedToLedger, next: { kind: 'view', id: selected.id } }
                  )
                }
                className={dangerClass}
              >
                {busy && <Loader2 size={15} className="animate-spin" />}
                Confirm reversal
              </button>
              <button
                type="button"
                onClick={() => setOverlay({ kind: 'view', id: selected.id })}
                className={buttonClass}
              >
                Keep payment
              </button>
            </div>
          </div>
        </HrDrawer>
      )}
      {overlay?.kind === 'export' && (
        <HrDrawer
          title="Payroll export preview"
          subtitle={`${monthLabel(month)} · ${rows.length} records · BDT`}
          onClose={close}
          wide
        >
          <div className="flex-1 overflow-auto p-5">
            <table className="w-full min-w-[450px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  {['Staff', 'Net pay', 'Paid', 'Status'].map((label) => (
                    <th key={label} className="border-b border-slate-200 p-2">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((record) => (
                  <tr key={record.id}>
                    <td className="border-b border-slate-100 p-2">{record.staffName}</td>
                    <td className="border-b border-slate-100 p-2 tabular-nums">{taka(net(record))}</td>
                    <td className="border-b border-slate-100 p-2 tabular-nums">{taka(paid(record))}</td>
                    <td className="border-b border-slate-100 p-2">
                      {statusNames[payrollStatus(record)]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-xs text-slate-500">
              CSV includes payroll ID, salary components, deductions, gross/net pay, paid/due
              amounts, status and notes. Void rows keep their original amounts and show zero due.
            </p>
          </div>
          <footer className="flex justify-end border-t border-slate-200 p-4">
            <button
              type="button"
              onClick={() => download(payrollCSV(rows), `payroll-${month}.csv`, 'text/csv;charset=utf-8')}
              disabled={!rows.length}
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
