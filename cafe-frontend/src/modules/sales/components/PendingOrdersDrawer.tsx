/**
 * Pending Orders drawer — surfaces every unpaid ("Save Pending") order right on
 * the New Order page so staff can resume, complete, or cancel them in one or
 * two clicks instead of hunting through Order History.
 */
import { useMemo, useState } from 'react';
import {
  X,
  Search,
  Clock,
  Banknote,
  Trash2,
  PencilLine,
  Store,
  Coffee,
  Bike,
  User,
  Inbox,
} from 'lucide-react';
import type { Transaction } from '@/core/types';
import { formatCurrency, formatRelativeTime, formatTime } from '@/shared/utils';
import { orderLabel, NO_TABLE } from '../utils/orderUtils';

const CHANNEL_ICON: Record<string, typeof Store> = {
  in_store: Store,
  takeaway: Coffee,
  delivery: Bike,
};

const CHANNEL_LABEL: Record<string, string> = {
  in_store: 'Dine In',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
};

const PLATFORM_LABEL: Record<string, string> = {
  foodpanda: 'Foodpanda',
  foodi: 'Foodi',
};

/** "Delivery" alone doesn't say which platform — append it when the sale's
 * channel carries it (foodpanda/foodi), so staff can tell them apart at a glance. */
function channelLabelFor(tx: Transaction): string {
  const base = CHANNEL_LABEL[tx.posChannel ?? 'in_store'] ?? 'Dine In';
  if (tx.posChannel === 'delivery' && (tx.channel === 'foodpanda' || tx.channel === 'foodi')) {
    return `${base} · ${PLATFORM_LABEL[tx.channel]}`;
  }
  return base;
}

function itemsPreview(tx: Transaction): string {
  const lines = tx.receiptLines ?? [];
  if (lines.length === 0) return `${tx.quantity ?? 0} item(s)`;
  const names = lines.slice(0, 2).map((l) => `${l.qty}× ${l.name.replace(/ \(Gift\)$/, '')}`);
  const extra = lines.length - 2;
  return extra > 0 ? `${names.join(', ')} +${extra} more` : names.join(', ');
}

function PendingOrderCard({
  tx,
  canMutate,
  onResume,
  onPayNow,
  onDelete,
}: {
  tx: Transaction;
  canMutate: boolean;
  onResume: () => void;
  onPayNow: () => void;
  onDelete: () => void;
}) {
  const hasTable = tx.tableNumber && tx.tableNumber !== NO_TABLE;
  const ChannelIcon = CHANNEL_ICON[tx.posChannel ?? 'in_store'] ?? Store;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-slate-800">{orderLabel(tx)}</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-md">
              <Clock size={10} /> Pending
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {formatRelativeTime(tx.date)} · {formatTime(tx.date)}
          </p>
        </div>
        <span className="text-base font-extrabold text-slate-800 tabular-nums shrink-0">
          {formatCurrency(tx.amount)}
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 font-medium">
          <ChannelIcon size={11} /> {channelLabelFor(tx)}
        </span>
        {hasTable && (
          <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 font-medium">
            {tx.tableNumber}
          </span>
        )}
        {tx.customerName && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 font-medium truncate max-w-[140px]">
            <User size={11} /> {tx.customerName}
          </span>
        )}
      </div>

      <p className="text-xs text-slate-600 leading-snug">{itemsPreview(tx)}</p>

      {canMutate && (
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          <button
            type="button"
            onClick={onResume}
            className="flex items-center justify-center gap-1 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-[11px] font-bold hover:border-amber-300 hover:bg-amber-50 transition-all"
          >
            <PencilLine size={12} /> Edit
          </button>
          <button
            type="button"
            onClick={onPayNow}
            className="flex items-center justify-center gap-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all"
          >
            <Banknote size={12} /> Complete
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center justify-center gap-1 py-2 rounded-xl border border-red-200 text-red-500 text-[11px] font-bold hover:bg-red-50 transition-all"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function PendingOrdersDrawer({
  isOpen,
  onClose,
  orders,
  canMutate,
  onResume,
  onPayNow,
  onDelete,
}: {
  isOpen: boolean;
  onClose: () => void;
  orders: Transaction[];
  canMutate: boolean;
  onResume: (tx: Transaction) => void;
  onPayNow: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.trim().toLowerCase();
    return orders.filter(
      (t) =>
        orderLabel(t).toLowerCase().includes(q) ||
        (t.customerName ?? '').toLowerCase().includes(q) ||
        (t.tableNumber ?? '').toLowerCase().includes(q)
    );
  }, [orders, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[55] flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-md h-full bg-slate-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 px-5 pt-5 pb-4 text-white shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <Clock size={17} /> Pending Orders
              </h2>
              <p className="text-xs opacity-90 mt-0.5">
                {orders.length} order{orders.length !== 1 ? 's' : ''} waiting for payment
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {orders.length > 3 && (
          <div className="p-3 bg-white border-b border-slate-200 shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order, customer or table..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-2.5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Inbox size={34} className="text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-500">
                {orders.length === 0 ? 'No pending orders' : 'No orders match your search'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {orders.length === 0
                  ? 'Orders saved as "Pending" will show up here.'
                  : 'Try a different search term.'}
              </p>
            </div>
          ) : (
            filtered.map((tx) => (
              <PendingOrderCard
                key={tx.id}
                tx={tx}
                canMutate={canMutate}
                onResume={() => onResume(tx)}
                onPayNow={() => onPayNow(tx)}
                onDelete={() => onDelete(tx)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
