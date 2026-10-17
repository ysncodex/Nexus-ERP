/**
 * Receipt builder — single source of truth for the on-screen receipt preview
 * and the printed output, so both look identical.
 *
 * The same HTML + CSS is used for:
 * • on-screen preview  (injected via dangerouslySetInnerHTML + <style>)
 * • printing           (written into a popup window)
 *
 * CSS uses plain class names (rcpt-*) — NOT Tailwind — so it survives the
 * jump into a fresh print window where Tailwind isn't loaded.
 */

import type { NewOrderData } from '../types/menuItem.types';
import { formatBusinessDateLabel, formatBusinessTime } from '@/shared/utils/businessDate';

// ─── Business identity ──────────────────────────────────────────────────────

export const RECEIPT_BRAND = {
  name: 'Beans & Butter Cafe',
  tagline: 'Staff Quarter, Demra, Dhaka',
  address: 'Shop No. 227, 2nd Floor, M.A. Gofur Market, Staff Quarter, Demra, Dhaka - 1361',
  phone: '+880 1343-437706',
  footerThanks: 'Thank you - see you again!',
  wifi: 'Wi-Fi: Beans & Butter | Bubblemilktea',
} as const;

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank: 'Card / Bank',
  bkash: 'bKash',
};

const CHANNEL_LABELS: Record<string, string> = {
  in_store: 'Dine In',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
};

const DELIVERY_PLATFORM_LABELS: Record<string, string> = {
  foodpanda: 'Foodpanda',
  foodi: 'Foodi',
};

/** "Delivery" alone doesn't say which platform — append it when known, so
 * kitchen staff can tell Foodpanda/Foodi orders apart on the printed chit. */
function channelDisplayLabel(order: NewOrderData): string {
  const base = CHANNEL_LABELS[order.channel] ?? order.channel;
  if (order.channel === 'delivery' && order.deliveryPlatform) {
    return `${base} (${DELIVERY_PLATFORM_LABELS[order.deliveryPlatform]})`;
  }
  return base;
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

export function money(n: number): string {
  return `Tk ${Math.round(n).toLocaleString('en-US')}`;
}

export function receiptTime(iso: string): string {
  return formatBusinessTime(iso);
}

export function receiptDate(iso: string): string {
  return formatBusinessDateLabel(iso);
}

function esc(value: string | number): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function hasTable(order: NewOrderData): boolean {
  return Boolean(order.tableNumber && order.tableNumber !== '— None —');
}

function discountLabel(order: NewOrderData): string {
  if (order.discountType === 'percent' && order.discountValue) {
    return `Discount (${order.discountValue}%)`;
  }
  return 'Discount';
}

// ─── Shared CSS ─────────────────────────────────────────────────────────────

export const RECEIPT_CSS = `
.rcpt, .chit { font-family: "Segoe UI", Arial, Helvetica, sans-serif; color: #000; width: 100%; }
.rcpt { font-size: 12px; line-height: 1.35; }
.rcpt *, .chit * { box-sizing: border-box; }
.rcpt-center { text-align: center; }
.rcpt-name { font-size: 17px; font-weight: 800; letter-spacing: 0.2px; line-height: 1.15; }
.rcpt-kicker { margin-top: 6px; font-size: 11px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; }
.rcpt-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.1px; margin: 0 0 4px; }
.rcpt-tag { font-size: 10px; font-weight: 600; line-height: 1.35; margin-top: 1px; }
.rcpt-muted { color: #000; }
.rcpt-sm { font-size: 12px; }
.rcpt-xs { font-size: 10px; font-weight: 600; }
.rcpt-thanks { font-size: 12px; font-weight: 800; margin-bottom: 2px; }
.rcpt-hr { border: none; border-top: 1px solid #000; margin: 7px 0; }
.rcpt-hr-solid { border: none; border-top: 2px solid #000; margin: 7px 0; }
.rcpt-row { display: table; width: 100%; table-layout: fixed; padding: 1px 0; }
.rcpt-row + .rcpt-row { margin-top: 1px; }
.rcpt-row > span { display: table-cell; vertical-align: top; }
.rcpt-row > span:last-child { text-align: right; white-space: nowrap; font-weight: 700; font-variant-numeric: tabular-nums; }
.rcpt-label { color: #000; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; font-size: 10px; }
.rcpt-strong { font-weight: 800; }
.rcpt-badge { display: inline-block; border: 2px solid #000; font-weight: 800; font-size: 14px; padding: 2px 8px; letter-spacing: 0.6px; }
.rcpt-items { margin: 2px 0 4px; }
.rcpt-item { margin-bottom: 6px; padding-bottom: 5px; border-bottom: 1px dashed #000; }
.rcpt-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.rcpt-item-top { display: table; width: 100%; table-layout: fixed; }
.rcpt-item-top > span { display: table-cell; vertical-align: top; }
.rcpt-item-top > span:last-child { text-align: right; white-space: nowrap; }
.rcpt-item-name { font-size: 13px; font-weight: 700; line-height: 1.25; word-break: break-word; padding-right: 6px; }
.rcpt-item-total { font-size: 13px; font-weight: 800; white-space: nowrap; font-variant-numeric: tabular-nums; }
.rcpt-item-sub { font-size: 10px; font-weight: 600; margin-top: 1px; }
.rcpt-pl-3 { padding-left: 10px; }
.rcpt-addon-row { margin-top: 3px; }
.rcpt-total-row { display: table; width: 100%; table-layout: fixed; font-weight: 800; font-size: 16px; letter-spacing: 0.3px; }
.rcpt-total-row > span { display: table-cell; vertical-align: middle; }
.rcpt-total-row > span:last-child { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.rcpt-section { margin: 6px 0; }
.rcpt-meta-block { margin-bottom: 2px; }
.rcpt-gift { font-size: 10px; font-weight: 800; letter-spacing: 0.3px; }
.rcpt-free { font-weight: 800; }
.rcpt-pay-block { margin-top: 2px; }

.chit { font-size: 13px; line-height: 1.25; }
.chit-brand { text-align: center; font-size: 11px; font-weight: 700; letter-spacing: 0.4px; }
.chit-title { text-align: center; font-size: 22px; font-weight: 800; letter-spacing: 2px; line-height: 1.05; margin-top: 1px; }
.chit-type { text-align: center; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; margin-top: 3px; }
.chit-table { text-align: center; margin-top: 6px; }
.chit-meta { display: table; width: 100%; table-layout: fixed; font-weight: 800; font-size: 13px; }
.chit-meta > span { display: table-cell; vertical-align: top; }
.chit-meta > span:last-child { text-align: right; white-space: nowrap; font-weight: 700; }
.chit-name { font-weight: 800; margin-top: 4px; font-size: 13px; }
.chit-items { margin: 6px 0; }
.chit-item { display: table; width: 100%; table-layout: fixed; margin-bottom: 8px; }
.chit-item-addon { margin-top: -4px; margin-bottom: 8px; }
.chit-qty, .chit-item-name { display: table-cell; vertical-align: top; }
.chit-qty { font-size: 18px; font-weight: 800; line-height: 1.05; width: 38px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.chit-item-name { font-size: 15px; font-weight: 700; line-height: 1.2; word-break: break-word; }
.chit-addon-name { padding-left: 2px; font-size: 13px; font-weight: 700; }
`.trim();

export const RECEIPT_THERMAL_PRINT_CSS = `
html, body, .rcpt, .chit, .rcpt *, .chit * { color: #000 !important; -webkit-font-smoothing: none !important; text-rendering: geometricPrecision; }
.rcpt, .chit { font-family: "Segoe UI", Arial, Helvetica, sans-serif !important; }
.rcpt { font-size: 12px !important; line-height: 1.3 !important; }
.rcpt-name { font-size: 18px !important; font-weight: 800 !important; }
.rcpt-kicker { font-size: 11px !important; font-weight: 800 !important; }
.rcpt-title { font-size: 11px !important; font-weight: 800 !important; }
.rcpt-tag, .rcpt-xs, .rcpt-item-sub { font-size: 10px !important; font-weight: 600 !important; color: #000 !important; }
.rcpt-label { font-size: 10px !important; font-weight: 700 !important; color: #000 !important; }
.rcpt-item-name { font-size: 13px !important; font-weight: 700 !important; }
.rcpt-item-total { font-size: 13px !important; font-weight: 800 !important; }
.rcpt-thanks { font-size: 12px !important; font-weight: 800 !important; }
.rcpt-total-row { font-size: 16px !important; font-weight: 800 !important; }
.rcpt-hr { border-top: 1px solid #000 !important; }
.rcpt-hr-solid { border-top: 2px solid #000 !important; }
.rcpt-badge { border: 2px solid #000 !important; font-weight: 800 !important; }
.chit-title { font-size: 24px !important; font-weight: 800 !important; }
.chit-type { font-size: 14px !important; font-weight: 800 !important; }
.chit-meta, .chit-name { font-size: 13px !important; font-weight: 800 !important; }
.chit-qty { font-size: 20px !important; font-weight: 800 !important; }
.chit-item-name { font-size: 16px !important; font-weight: 700 !important; }
.chit-addon-name { font-size: 14px !important; font-weight: 700 !important; }
`.trim();

// ─── Customer receipt HTML ──────────────────────────────────────────────────

export function buildCustomerReceiptHTML(order: NewOrderData): string {
  const itemsHTML = order.items
    .map((oi) => {
      // 1. Separate the base calculation
      const baseLineTotal = oi.isGift ? 0 : oi.menuItem.price * oi.quantity;
      const giftTag = oi.isGift ? ' <span class="rcpt-gift">[GIFT]</span>' : '';

      let html = `
      <div class="rcpt-item">
        <div class="rcpt-item-top">
          <span class="rcpt-item-name">${esc(oi.menuItem.name)}${giftTag}</span>
          <span class="rcpt-item-total ${oi.isGift ? 'rcpt-free' : ''}">${oi.isGift ? 'FREE' : esc(money(baseLineTotal))}</span>
        </div>
        <div class="rcpt-item-sub">${oi.quantity} x ${oi.isGift ? esc(money(oi.menuItem.price)) + ' (complimentary)' : esc(money(oi.menuItem.price))}</div>`;

      // 2. Map and print out each add-on as its own distinct row for clear math
      if (oi.addons && oi.addons.length > 0) {
        oi.addons.forEach((a) => {
          const addonLineTotal = oi.isGift ? 0 : a.price * oi.quantity;
          html += `
          <div class="rcpt-addon-row">
            <div class="rcpt-item-top">
              <span class="rcpt-item-name rcpt-pl-3">+ ${esc(a.name)}</span>
              <span class="rcpt-item-total">${oi.isGift ? 'FREE' : esc(money(addonLineTotal))}</span>
            </div>
            <div class="rcpt-item-sub rcpt-pl-3">${oi.quantity} x ${oi.isGift ? esc(money(a.price)) + ' (complimentary)' : esc(money(a.price))}</div>
          </div>`;
        });
      }

      html += `</div>`;
      return html;
    })
    .join('');

  const metaRows: string[] = [
    `<div class="rcpt-row"><span class="rcpt-label">Order #</span><span class="rcpt-strong">${esc(order.orderNumber)}</span></div>`,
    `<div class="rcpt-row"><span class="rcpt-label">Type</span><span>${esc(channelDisplayLabel(order))}</span></div>`,
  ];
  if (hasTable(order)) {
    metaRows.push(
      `<div class="rcpt-row"><span class="rcpt-label">Table</span><span class="rcpt-strong">${esc(order.tableNumber)}</span></div>`
    );
  }
  metaRows.push(
    `<div class="rcpt-row"><span class="rcpt-label">Date</span><span>${esc(receiptDate(order.createdAt))}</span></div>`,
    `<div class="rcpt-row"><span class="rcpt-label">Time</span><span>${esc(receiptTime(order.createdAt))}</span></div>`
  );
  if (order.customerName) {
    metaRows.push(
      `<div class="rcpt-row"><span class="rcpt-label">Customer</span><span>${esc(order.customerName)}</span></div>`
    );
  }

  const totalRows: string[] = [
    `<div class="rcpt-row"><span class="rcpt-label">Subtotal</span><span>${esc(money(order.subtotal))}</span></div>`,
  ];
  if (order.giftItemCount && order.giftItemCount > 0) {
    totalRows.push(
      `<div class="rcpt-row"><span class="rcpt-label">Gift Items</span><span>${order.giftItemCount} (value ${esc(money(order.giftTotalValue ?? 0))})</span></div>`
    );
  }
  if (order.discount > 0) {
    totalRows.push(
      `<div class="rcpt-row"><span class="rcpt-label">${esc(discountLabel(order))}</span><span>- ${esc(money(order.discount))}</span></div>`
    );
  }
  if (order.tax && order.tax > 0) {
    totalRows.push(
      `<div class="rcpt-row"><span class="rcpt-label">Tax / VAT</span><span>${esc(money(order.tax))}</span></div>`
    );
  }

  const payRows: string[] = [
    `<div class="rcpt-row"><span class="rcpt-label">Payment</span><span class="rcpt-strong">${esc(PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod)}</span></div>`,
  ];
  if (order.customerPaid > 0) {
    payRows.push(
      `<div class="rcpt-row"><span class="rcpt-label">Paid</span><span>${esc(money(order.customerPaid))}</span></div>`
    );
  }
  if (order.changeAmount > 0) {
    payRows.push(
      `<div class="rcpt-row rcpt-strong"><span>Change</span><span>${esc(money(order.changeAmount))}</span></div>`
    );
  }

  return `
<div class="rcpt">
  <div class="rcpt-center rcpt-section">
    <div class="rcpt-name">${esc(RECEIPT_BRAND.name)}</div>
    <div class="rcpt-tag">${esc(RECEIPT_BRAND.tagline)}</div>
    <div class="rcpt-tag">${esc(RECEIPT_BRAND.address)}</div>
    <div class="rcpt-tag">${esc(RECEIPT_BRAND.phone)}</div>
    <div class="rcpt-kicker">Customer Receipt</div>
  </div>
  <hr class="rcpt-hr-solid" />
  <div class="rcpt-section rcpt-meta-block">${metaRows.join('')}</div>
  <hr class="rcpt-hr" />
  <div class="rcpt-title">Items</div>
  <div class="rcpt-items">${itemsHTML}</div>
  <hr class="rcpt-hr" />
  <div class="rcpt-title">Summary</div>
  <div class="rcpt-section">${totalRows.join('')}</div>
  <hr class="rcpt-hr-solid" />
  <div class="rcpt-total-row"><span>TOTAL</span><span>${esc(money(order.total))}</span></div>
  <hr class="rcpt-hr" />
  <div class="rcpt-section rcpt-pay-block">${payRows.join('')}</div>
  <hr class="rcpt-hr" />
  <div class="rcpt-center rcpt-muted rcpt-section">
    <div class="rcpt-thanks">${esc(RECEIPT_BRAND.footerThanks)}</div>
    <div class="rcpt-xs">${esc(RECEIPT_BRAND.wifi)}</div>
    <div class="rcpt-xs">* * *</div>
  </div>
</div>`.trim();
}

// ─── Kitchen chit HTML ──────────────────────────────────────────────────────

export function buildKitchenChitHTML(order: NewOrderData): string {
  const itemsHTML = order.items
    .map((oi) => {
      const giftTag = oi.isGift ? ' <span class="rcpt-gift">[GIFT]</span>' : '';
      let html = `
      <div class="chit-item">
        <span class="chit-qty">${oi.quantity}x</span>
        <span class="chit-item-name">${esc(oi.menuItem.name)}${giftTag}</span>
      </div>`;

      // Display separated for the kitchen so they are visibly parsed
      if (oi.addons && oi.addons.length > 0) {
        oi.addons.forEach((a) => {
          html += `
          <div class="chit-item chit-item-addon">
            <span class="chit-qty"></span>
            <span class="chit-item-name chit-addon-name">+ ${esc(a.name)}</span>
          </div>`;
        });
      }
      return html;
    })
    .join('');

  const tableHTML = hasTable(order)
    ? `<div class="chit-table"><span class="rcpt-badge">${esc(order.tableNumber.toUpperCase())}</span></div>`
    : '';
  const nameHTML = order.customerName
    ? `<div class="chit-name">Name: ${esc(order.customerName)}</div>`
    : '';

  return `
<div class="chit">
  <div class="chit-brand">${esc(RECEIPT_BRAND.name)}</div>
  <div class="chit-title">KITCHEN</div>
  <div class="chit-type">${esc(channelDisplayLabel(order))}</div>
  ${tableHTML}
  <hr class="rcpt-hr-solid" />
  <div class="chit-meta">
    <span>#${esc(order.orderNumber.split('-').pop() ?? '')}</span>
    <span>${esc(receiptTime(order.createdAt))}</span>
  </div>
  ${nameHTML}
  <hr class="rcpt-hr" />
  <div class="chit-items">${itemsHTML}</div>
  <hr class="rcpt-hr-solid" />
  <div class="rcpt-center rcpt-muted rcpt-xs">${esc(receiptDate(order.createdAt))} - ${esc(receiptTime(order.createdAt))}</div>
</div>`.trim();
}
