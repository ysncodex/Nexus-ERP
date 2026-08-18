/**
 * Pending Payment Modal — collects payment for an already-placed pending order.
 *
 * Shared between Order History ("Receive Payment") and the New Order page's
 * Pending Orders drawer ("Complete") so both entry points behave identically.
 */
import { useState, useMemo } from 'react';
import {
  X,
  Printer,
  Loader2,
  Banknote,
  Smartphone,
  Landmark,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Transaction, PaymentMethod } from '@/core/types';
import { transactionToOrder, orderLabel } from '../utils/orderUtils';
import { printOrderAsync } from '../utils/posPrintService';
import { PaymentPanel } from './PaymentPanel';
import type { NewOrderData } from '../types/menuItem.types';

const METHOD_CONFIG: Record<PaymentMethod, { label: string; icon: LucideIcon; color: string }> = {
  cash: { label: 'Cash', icon: Banknote, color: 'text-emerald-600' },
  bkash: { label: 'bKash', icon: Smartphone, color: 'text-pink-600' },
  bank: { label: 'Card / Bank', icon: Landmark, color: 'text-blue-600' },
};

export function PendingPaymentModal({
  tx,
  onClose,
  onComplete,
}: {
  tx: Transaction;
  onClose: () => void;
  onComplete: (
    updated: Transaction,
    payment: { method: PaymentMethod; customerPaid: number; changeAmount: number }
  ) => void;
}) {
  const baseOrder = useMemo(() => transactionToOrder(tx), [tx]);
  const [customerPaidStr, setCustomerPaidStr] = useState(() =>
    String(tx.customerPaid ?? tx.amount)
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(tx.method ?? 'cash');
  const [printing, setPrinting] = useState(false);

  if (!baseOrder) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
          <p className="text-sm text-slate-600 mb-4">
            This order cannot be opened for payment — line items are missing.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const paid = parseFloat(customerPaidStr) || 0;
  const change = Math.max(0, paid - tx.amount);
  const paymentOk = paid >= tx.amount;

  const finalize = async (withPrint: boolean) => {
    if (!paymentOk) {
      toast.error(`Customer must pay at least ৳${tx.amount}`);
      return;
    }
    const enriched: NewOrderData = {
      ...baseOrder,
      paymentMethod,
      customerPaid: paid,
      changeAmount: change,
    };
    if (withPrint) {
      setPrinting(true);
      try {
        const ok = await printOrderAsync(enriched, 'customer');
        if (!ok) {
          toast.error('Pop-up blocked — allow pop-ups and retry');
          return;
        }
      } finally {
        setPrinting(false);
      }
    }
    onComplete(
      { ...tx, receiptStatus: 'completed', method: paymentMethod },
      { method: paymentMethod, customerPaid: paid, changeAmount: change }
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 px-5 pt-5 pb-4 text-white shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold">Receive Payment</h2>
              <p className="text-xs opacity-90 mt-0.5">
                {orderLabel(tx)} · ৳{tx.amount}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-2">
              Payment Method
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {(['cash', 'bank', 'bkash'] as PaymentMethod[]).map((m) => {
                const cfg = METHOD_CONFIG[m];
                const Icon = cfg.icon;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2.5 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                      paymentMethod === m
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={14} className={cfg.color} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <PaymentPanel
            billTotal={tx.amount}
            paymentMethod={paymentMethod}
            customerPaidStr={customerPaidStr}
            onPaidChange={setCustomerPaidStr}
            discountAmount={tx.discountAmount}
          />
        </div>
        <div className="p-4 border-t border-slate-100 space-y-2 shrink-0">
          <button
            type="button"
            disabled={printing || !paymentOk}
            onClick={() => void finalize(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm disabled:opacity-50"
          >
            {printing ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
            Print Receipt & Complete
          </button>
          <button
            type="button"
            disabled={printing || !paymentOk}
            onClick={() => void finalize(false)}
            className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-sm disabled:opacity-50"
          >
            Complete Without Print
          </button>
        </div>
      </div>
    </div>
  );
}
