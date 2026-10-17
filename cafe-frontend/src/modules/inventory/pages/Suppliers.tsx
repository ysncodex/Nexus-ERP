import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import {
  Truck,
  Plus,
  Pencil,
  Trash2,
  X,
  Phone,
  Mail,
  MapPin,
  StickyNote,
  Search,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { suppliersService, type Supplier } from '@/core/api/services';
import { useCanMutate } from '@/shared/hooks';
import { useERP } from '@/core/context/useERP';
import { notifyReadOnlyBlocked } from '@/shared/utils';
function clearFields(setters: {
  setName: (v: string) => void;
  setPhone: (v: string) => void;
  setEmail: (v: string) => void;
  setAddress: (v: string) => void;
  setNotes: (v: string) => void;
}) {
  setters.setName('');
  setters.setPhone('');
  setters.setEmail('');
  setters.setAddress('');
  setters.setNotes('');
}
export default function Suppliers() {
  const canMutate = useCanMutate();
  const { suppliers, refreshCatalogs } = useERP();
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resetForm = useCallback(() => {
    clearFields({ setName, setPhone, setEmail, setAddress, setNotes });
    setEditing(null);
    setFormOpen(false);
  }, []);
  const openCreate = () => {
    if (!canMutate) {
      notifyReadOnlyBlocked();
      return;
    }
    setEditing(null);
    clearFields({ setName, setPhone, setEmail, setAddress, setNotes });
    setFormOpen(true);
  };
  const openEdit = (row: Supplier) => {
    if (!canMutate) {
      notifyReadOnlyBlocked();
      return;
    }
    setEditing(row);
    setName(row.name);
    setPhone(row.phone ?? '');
    setEmail(row.email ?? '');
    setAddress(row.address ?? '');
    setNotes(row.notes ?? '');
    setFormOpen(true);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutate) return;
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedAddress = address.trim();
    if (!trimmedName) {
      toast.error('Supplier name is required');
      return;
    }
    if (!trimmedPhone) {
      toast.error('Contact number is required');
      return;
    }
    if (!trimmedAddress) {
      toast.error('Address is required');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: trimmedName,
        phone: trimmedPhone,
        address: trimmedAddress,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (editing) {
        await suppliersService.update(editing.id, payload);
        toast.success('Supplier updated');
      } else {
        await suppliersService.create(payload);
        toast.success('Supplier added');
      }
      await refreshCatalogs();
      resetForm();
    } catch {
      toast.error(editing ? 'Failed to update supplier' : 'Failed to add supplier');
    } finally {
      setLoading(false);
    }
  };
  const handleDelete = async (row: Supplier) => {
    if (!canMutate) return;
    if (!window.confirm(`Delete supplier "${row.name}"?`)) return;
    try {
      await suppliersService.delete(row.id);
      await refreshCatalogs();
      toast.success('Supplier deleted');
    } catch {
      toast.error('Failed to delete supplier');
    }
  };
  useEffect(() => {
    void refreshCatalogs();
  }, [refreshCatalogs]);
  const visibleSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return suppliers;
    return suppliers.filter((supplier) =>
      [supplier.name, supplier.phone, supplier.email, supplier.address, supplier.notes].some(
        (value) => value?.toLowerCase().includes(query)
      )
    );
  }, [suppliers, search]);

  useEffect(() => {
    if (!formOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [formOpen]);

  return (
    <div className="min-w-0 space-y-4">
      {formOpen && (
        <dialog
          ref={dialogRef}
          aria-labelledby="supplier-form-title"
          onCancel={(event) => {
            event.preventDefault();
            if (!loading) resetForm();
          }}
          className="fixed inset-y-0 left-auto right-0 m-0 h-[100dvh] max-h-none w-full max-w-xl border-0 bg-white p-0 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm"
        >
          <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-7">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                  <Truck size={20} aria-hidden="true" />
                </span>
                <div>
                  <h2 id="supplier-form-title" className="text-base font-bold text-slate-900">
                    {editing ? 'Edit Supplier' : 'Add Supplier'}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {editing
                      ? 'Update contact and purchase details.'
                      : 'Create a contact for your purchases.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetForm}
                disabled={loading}
                aria-label="Close supplier form"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7 [scrollbar-width:thin]">
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-slate-800">Supplier details</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Required fields are marked with an asterisk (*).
                </p>
              </div>
              <fieldset disabled={loading} className="grid min-w-0 sm:grid-cols-2 gap-5">
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-slate-700">Supplier name *</span>
                  <input
                    autoFocus
                    autoComplete="organization"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-shadow placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Phone number *</span>
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone or mobile"
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-shadow placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Optional"
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-shadow placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-slate-700">Address *</span>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-shadow placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                    required
                  />
                </label>
                <label className="block border-t border-slate-100 pt-5 sm:col-span-2">
                  <span className="text-xs font-semibold text-slate-700">
                    Notes <span className="font-normal text-slate-400">(optional)</span>
                  </span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional — delivery hours, account number, etc."
                    rows={4}
                    className="mt-2 min-h-24 w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  />
                </label>
              </fieldset>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-7 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={resetForm}
                disabled={loading}
                className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50 sm:flex-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 sm:flex-none"
              >
                {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {loading ? 'Saving…' : editing ? 'Save Changes' : 'Add Supplier'}
              </button>
            </div>
          </form>
        </dialog>
      )}
      <section
        aria-labelledby="supplier-directory-title"
        className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
      >
        <header className="flex flex-col gap-4 border-b border-slate-100 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50 text-cyan-700">
              <Truck size={21} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="supplier-directory-title"
                  className="text-base font-bold tracking-tight text-slate-900"
                >
                  Supplier directory
                </h2>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
                  {suppliers.length}
                </span>
              </div>
              <p className="mt-1 text-sm leading-5 text-erp-secondary">
                Contacts and details for your purchases.
              </p>
            </div>
          </div>
          {canMutate && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
            >
              <Plus size={17} aria-hidden="true" /> Add Supplier
            </button>
          )}
        </header>
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="relative w-full sm:max-w-sm">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search suppliers"
              placeholder="Search suppliers, contacts or addresses…"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-10 text-sm text-slate-800 outline-none transition-shadow placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500" role="status">
            {search.trim()
              ? `${visibleSuppliers.length} of ${suppliers.length} suppliers`
              : `${suppliers.length} supplier${suppliers.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <div
          aria-hidden="true"
          className={`hidden gap-5 border-b border-slate-100 px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 lg:grid ${canMutate ? 'grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)_160px]' : 'grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)]'}`}
        >
          <span>Supplier</span>
          <span>Contact</span>
          <span>Address</span>
          {canMutate && <span className="text-right">Actions</span>}
        </div>
        {visibleSuppliers.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
              <Truck size={25} aria-hidden="true" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">
              {search.trim() ? 'No suppliers found' : 'Your supplier directory starts here'}
            </h3>
            <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
              {search.trim()
                ? 'Try another name, phone number or address.'
                : 'Add your first supplier to keep purchase contacts in one place.'}
            </p>
            {search.trim() ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="mt-5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear search
              </button>
            ) : (
              canMutate && (
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700"
                >
                  <Plus size={16} /> Add Supplier
                </button>
              )
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibleSuppliers.map((row) => (
              <li key={row.id} className="px-4 py-4 transition-colors hover:bg-slate-50/60 sm:px-6">
                <div
                  className={`grid min-w-0 items-start gap-4 lg:items-center lg:gap-5 ${canMutate ? 'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)_160px]' : 'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)]'}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/70 bg-slate-50 text-xs font-bold text-slate-600"
                    >
                      {row.name
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part.charAt(0))
                        .join('')
                        .toUpperCase() || 'S'}
                    </span>
                    <h3 className="min-w-0 break-words text-sm font-semibold leading-5 text-slate-900">
                      {row.name}
                    </h3>
                  </div>
                  <div className="min-w-0 space-y-2 text-sm text-slate-600">
                    {row.phone && (
                      <p className="flex items-start gap-2">
                        <Phone
                          size={14}
                          aria-hidden="true"
                          className="mt-0.5 shrink-0 text-slate-400"
                        />
                        <span className="break-all tabular-nums">{row.phone}</span>
                      </p>
                    )}
                    {row.email && (
                      <p className="flex items-start gap-2">
                        <Mail
                          size={14}
                          aria-hidden="true"
                          className="mt-0.5 shrink-0 text-slate-400"
                        />
                        <span className="break-all text-xs leading-5">{row.email}</span>
                      </p>
                    )}
                    {!row.phone && !row.email && (
                      <span className="text-xs text-slate-400">No contact details</span>
                    )}
                  </div>
                  <p className="flex min-w-0 items-start gap-2 text-sm leading-5 text-slate-500">
                    <MapPin
                      size={14}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-slate-400"
                    />
                    <span className="whitespace-pre-wrap break-words">
                      {row.address || 'No address recorded'}
                    </span>
                  </p>
                  {canMutate && (
                    <div className="flex items-center gap-2 border-t border-slate-100 pt-3 lg:justify-end lg:border-0 lg:pt-0">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        aria-label={`Edit ${row.name}`}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(row)}
                        aria-label={`Delete ${row.name}`}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </div>
                {row.notes && (
                  <details className="group mt-3 lg:ml-[52px]">
                    <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded-md px-1 text-xs font-medium text-slate-500 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 [&::-webkit-details-marker]:hidden">
                      <StickyNote size={13} aria-hidden="true" /> View notes
                      <ChevronDown
                        size={13}
                        aria-hidden="true"
                        className="transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <p className="mt-2 max-w-3xl whitespace-pre-wrap break-words rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                      {row.notes}
                    </p>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
