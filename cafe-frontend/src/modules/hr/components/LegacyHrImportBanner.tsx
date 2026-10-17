import { useEffect, useState } from 'react';
import { DatabaseZap, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { hrService } from '@/core/api/services';
import { todayBusinessKey } from '@/shared/utils/businessDate';
import { apiErrorMessage } from '../utils/apiError';
import { download } from '../utils/download';
import { clearLegacyHr, readLegacyHr } from '../utils/legacyHrStorage';

/**
 * Offers a one-time move of Staff Schedule / Payroll data that older versions
 * kept only in this browser. Hidden when there is nothing to move.
 */
export function LegacyHrImportBanner({ onImported }: { onImported: () => void }) {
  const [legacy, setLegacy] = useState(readLegacyHr);
  const [canImport, setCanImport] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (legacy.kind === 'none') return;
    let active = true;
    hrService
      .getStatus()
      .then((status) => {
        if (active) setCanImport(status.canImport);
      })
      // The page shows its own load error; keep the banner hidden until the API answers.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [legacy.kind]);

  if (legacy.kind === 'none' || canImport === null) return null;

  const backup = () =>
    download(legacy.raw, `hr-browser-backup-${todayBusinessKey()}.json`, 'application/json');

  async function importNow() {
    if (legacy.kind !== 'ready') return;
    setBusy(true);
    try {
      const result = await hrService.importLegacy(legacy.payload);
      clearLegacyHr();
      setLegacy({ kind: 'none' });
      toast.success(
        `Moved ${result.staff} staff, ${result.shifts} shifts and ${result.payroll} payroll records to the database.`
      );
      onImported();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Import failed. Nothing was changed.'));
    } finally {
      setBusy(false);
    }
  }

  function discard() {
    if (
      !window.confirm(
        'Remove the old browser copy of Staff Schedule and Payroll? Download a backup first if you may need it.'
      )
    )
      return;
    clearLegacyHr();
    setLegacy({ kind: 'none' });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <DatabaseZap size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <div>
          {legacy.kind === 'error' ? (
            <p>
              <strong>Old browser data could not be read.</strong> {legacy.message} Download a
              backup before clearing it.
            </p>
          ) : canImport ? (
            <>
              <p>
                <strong>Data saved only in this browser was found</strong> ·{' '}
                {legacy.counts.staff} staff, {legacy.counts.shifts} shifts,{' '}
                {legacy.counts.payroll} payroll records.
              </p>
              <p className="mt-0.5 text-amber-800">
                Move it to the database so it is backed up and shared across devices. Imported
                payments are kept as history and are not posted to Fixed Expenses again.
              </p>
            </>
          ) : (
            <p>
              <strong>An old browser copy was found</strong>, but the database already has staff or
              payroll records, so it was not imported.
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          onClick={backup}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 font-semibold hover:bg-amber-100"
        >
          <Download size={14} />
          Backup
        </button>
        {legacy.kind === 'ready' && canImport ? (
          <button
            type="button"
            onClick={importNow}
            disabled={busy}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-amber-600 px-3 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Move to database
          </button>
        ) : (
          <button
            type="button"
            onClick={discard}
            className="inline-flex min-h-9 items-center rounded-lg px-3 font-semibold underline underline-offset-2 hover:bg-amber-100"
          >
            Clear browser copy
          </button>
        )}
      </div>
    </div>
  );
}
