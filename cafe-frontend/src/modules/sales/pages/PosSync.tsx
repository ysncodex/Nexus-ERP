/**
 * POS Sync — focused views for uploaded sales, offline receipts, delivery
 * connections, upload errors, and setup guidance.
 */

import { useState, useMemo, useCallback } from 'react';

import { useNavigate } from 'react-router-dom';

import { toast } from 'sonner';

import { useERP } from '@/core/context/useERP';

import { EditTransactionModal, ManagerPasswordModal } from '@/shared/components/ui';

import { useClientPagination, useCanMutate } from '@/shared/hooks';

import type { Transaction, SalesChannel } from '@/core/types';

import type {
  PendingOfflineInvoice,
  SyncFailureLogEntry,
} from '@/modules/sales/utils/posSyncHub.storage';

import { ingestPendingInvoice } from '@/modules/sales/utils/posOfflineQueue';

import { formatSyncPeriodLabel } from '@/modules/sales/utils/posSync.constants';

import { usePosSyncHub } from '@/modules/sales/hooks/usePosSyncHub';

import {
  PosSyncConnectionBar,
  PosSyncErrorLog,
  PosSyncIntegrations,
  PosSyncOfflineQueue,
  PosSyncQuickGuide,
  PosSyncTransactionLog,
} from '@/modules/sales/components/posSync/PosSyncPanels';

type ManagerAction =
  | { kind: 'retry_sync_error'; data: SyncFailureLogEntry }
  | { kind: 'resolve_sync_error'; data: { id: string } }
  | { kind: 'delete_tx'; data: Transaction }
  | { kind: 'authorize_edit_tx'; data: Transaction };

const POS_SYNC_VIEWS = [
  { id: 'sales', label: 'Uploaded sales' },
  { id: 'offline', label: 'Offline queue' },
  { id: 'integrations', label: 'Delivery apps' },
  { id: 'errors', label: 'Upload errors' },
  { id: 'guide', label: 'Quick guide' },
] as const;

type PosSyncView = (typeof POS_SYNC_VIEWS)[number]['id'];

export default function PosSync() {
  const canMutate = useCanMutate();
  const navigate = useNavigate();

  const {
    filteredTransactions,
    deleteTransaction,
    updateTransaction,
    itemNames,
    suppliers,
    customDateRange,
    setCustomDateRange,
    dateRange,
  } = useERP();

  const periodLabel = useMemo(
    () => formatSyncPeriodLabel(customDateRange, dateRange),
    [customDateRange, dateRange]
  );

  const ingestPendingSale = useCallback(
    (row: PendingOfflineInvoice) => ingestPendingInvoice(row),
    []
  );

  const {
    hub,
    isOnline,
    isFlushingPending,
    flushProgress,
    flushPendingQueue,
    requestPartnerConnection,
    retrySyncError,
    resolveSyncError,
    lastSyncPhrase,
    unresolvedErrors,
  } = usePosSyncHub(ingestPendingSale);

  const handleAddOfflineReceipt = useCallback(() => {
    toast.message('Open New Order to ring a sale. It saves here automatically when offline.');
    navigate('/dashboard/new-order');
  }, [navigate]);

  /* ─── Posted sales table filters ─────────────────────────────────────── */

  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<SalesChannel | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'sale' | 'sale_adjustment'>('all');
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);
  const [activeView, setActiveView] = useState<PosSyncView>('sales');

  const dayTransactions = useMemo(
    () => filteredTransactions.filter((t) => t.type === 'sale' || t.type === 'sale_adjustment'),
    [filteredTransactions]
  );

  const filteredTxnRows = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return dayTransactions.filter((t) => {
      const okSearch =
        !q ||
        (t.description?.toLowerCase().includes(q) ?? false) ||
        String(t.amount).includes(q) ||
        t.id.toLowerCase().includes(q);
      const okCh = channelFilter === 'all' || t.channel === channelFilter;
      const okTy = typeFilter === 'all' || t.type === typeFilter;
      return okSearch && okCh && okTy;
    });
  }, [dayTransactions, searchQuery, channelFilter, typeFilter]);

  const { paginatedData, pagination } = useClientPagination(filteredTxnRows, {
    initialPageSize: 10,
  });

  const resetTxnFilters = useCallback(() => {
    setSearchQuery('');
    setChannelFilter('all');
    setTypeFilter('all');
  }, []);

  const handleEditSave = useCallback(
    (updated: Transaction) => {
      updateTransaction(updated);
      toast.success('Sale updated.');
      setEditTarget(null);
    },
    [updateTransaction]
  );

  /* ─── Manager password gate ──────────────────────────────────────────── */

  const [pendingPw, setPendingPw] = useState<ManagerAction | null>(null);
  const [showPwModal, setShowPwModal] = useState(false);

  const openPassword = useCallback((action: ManagerAction) => {
    setPendingPw(action);
    setShowPwModal(true);
  }, []);

  const passwordTitle = useMemo(() => {
    if (!pendingPw) return 'Manager approval required';
    switch (pendingPw.kind) {
      case 'retry_sync_error':
        return 'Retry upload';
      case 'resolve_sync_error':
        return 'Mark issue resolved';
      case 'delete_tx':
        return 'Delete sale';
      case 'authorize_edit_tx':
        return 'Edit sale';
      default:
        return 'Manager approval required';
    }
  }, [pendingPw]);

  const handlePasswordConfirm = useCallback(() => {
    if (!pendingPw) return;

    switch (pendingPw.kind) {
      case 'retry_sync_error':
        retrySyncError(pendingPw.data);
        break;
      case 'resolve_sync_error':
        resolveSyncError(pendingPw.data.id);
        break;
      case 'delete_tx':
        void deleteTransaction(pendingPw.data.id)
          .then(() => {
            toast.success('Sale deleted.');
          })
          .catch(() => {
            toast.error('Failed to delete sale.');
          });
        break;
      case 'authorize_edit_tx':
        setEditTarget(pendingPw.data);
        break;
      default:
        break;
    }

    setPendingPw(null);
    setShowPwModal(false);
  }, [pendingPw, deleteTransaction, retrySyncError, resolveSyncError]);

  const viewCount = (view: PosSyncView) => {
    if (view === 'sales') return dayTransactions.length;
    if (view === 'offline') return hub.pendingQueue.length;
    if (view === 'errors') return unresolvedErrors.length;
    return null;
  };

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      <ManagerPasswordModal
        isOpen={showPwModal}
        onClose={() => {
          setShowPwModal(false);
          setPendingPw(null);
        }}
        onConfirm={handlePasswordConfirm}
        title={passwordTitle}
        requiredRole="owner"
      />

      <EditTransactionModal
        isOpen={editTarget !== null}
        onClose={() => setEditTarget(null)}
        transaction={editTarget!}
        onSave={handleEditSave}
        itemNames={itemNames}
        suppliers={suppliers.map((s) => s.name)}
      />

      {/* Shared online state and sync action remain visible in every view. */}
      <PosSyncConnectionBar
        isOnline={isOnline}
        pendingCount={hub.pendingQueue.length}
        lastSyncPhrase={lastSyncPhrase}
        isFlushingPending={isFlushingPending}
        onSync={() => void flushPendingQueue()}
        readOnly={!canMutate}
      />

      <nav
        aria-label="Sales Sync views"
        className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 sm:grid-cols-3 lg:grid-cols-5"
      >
        {POS_SYNC_VIEWS.map((view) => {
          const count = viewCount(view.id);
          const isActive = activeView === view.id;

          return (
            <button
              key={view.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActiveView(view.id)}
              className={`inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 sm:text-sm ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="truncate">{view.label}</span>
              {count !== null && (
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <section
        aria-label={POS_SYNC_VIEWS.find((view) => view.id === activeView)?.label}
        className="min-w-0"
      >
        {activeView === 'guide' && <PosSyncQuickGuide />}

        {activeView === 'offline' && (
          <PosSyncOfflineQueue
            pendingCount={hub.pendingQueue.length}
            isOnline={isOnline}
            isFlushingPending={isFlushingPending}
            flushProgress={flushProgress}
            onAddOfflineReceipt={handleAddOfflineReceipt}
            readOnly={!canMutate}
          />
        )}

        {activeView === 'integrations' && (
          <PosSyncIntegrations
            isOnline={isOnline}
            integrationLogs={hub.integrationLogs}
            onConnectPartner={requestPartnerConnection}
            readOnly={!canMutate}
          />
        )}

        {activeView === 'sales' && (
          <PosSyncTransactionLog
            periodLabel={periodLabel}
            searchQuery={searchQuery}
            channelFilter={channelFilter}
            typeFilter={typeFilter}
            onSearchChange={setSearchQuery}
            onChannelChange={setChannelFilter}
            onTypeChange={setTypeFilter}
            onResetFilters={resetTxnFilters}
            onDateRangeChange={setCustomDateRange}
            customDateRange={customDateRange}
            dayTransactionCount={dayTransactions.length}
            filteredCount={filteredTxnRows.length}
            rows={paginatedData}
            pagination={pagination}
            onEdit={(tx) => openPassword({ kind: 'authorize_edit_tx', data: tx })}
            onDelete={(tx) => openPassword({ kind: 'delete_tx', data: tx })}
            readOnly={!canMutate}
          />
        )}

        {activeView === 'errors' && (
          <PosSyncErrorLog
            errors={hub.errors}
            openCount={unresolvedErrors.length}
            isOnline={isOnline}
            onRetry={(entry) => openPassword({ kind: 'retry_sync_error', data: entry })}
            onResolve={(id) => openPassword({ kind: 'resolve_sync_error', data: { id } })}
            readOnly={!canMutate}
          />
        )}
      </section>
    </div>
  );
}
