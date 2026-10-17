import { useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { Check, CircleAlert, CircleCheck, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ManageListModalProps } from './Modal.types';

type Notice = { kind: 'ok' | 'err'; text: string };

function messageFrom(error: unknown, fallback: string): string {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function ManageListModal({
  isOpen,
  onClose,
  title,
  items,
  emptyText = 'No items yet.',
  onRename,
  onDelete,
}: ManageListModalProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const handleClose = () => {
    if (busy) return;
    setEditing(null);
    setDraft('');
    setNotice(null);
    onClose();
  };

  const startEdit = (value: string) => {
    if (busy) return;
    setEditing(value);
    setDraft(value);
    setNotice(null);
  };

  const saveEdit = async () => {
    if (!editing || busy) return;
    const next = draft.trim();
    if (!next) {
      setNotice({ kind: 'err', text: 'Enter a name before saving.' });
      return;
    }
    if (next.toLowerCase() === editing.toLowerCase()) {
      setEditing(null);
      setDraft('');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await onRename(editing, next);
      const text = `Renamed “${editing}” to “${next}”.`;
      setNotice({ kind: 'ok', text });
      toast.success(text, { duration: 4000 });
      setEditing(null);
      setDraft('');
    } catch (error) {
      const text = messageFrom(error, 'Could not rename. Try again.');
      setNotice({ kind: 'err', text });
      toast.error(text, { duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (value: string) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await onDelete(value);
      const text = `“${value}” was removed from the list. Past records keep this name.`;
      setNotice({ kind: 'ok', text });
      toast.success(text, { duration: 5000 });
    } catch (error) {
      const text = messageFrom(error, 'Could not delete. Try again.');
      setNotice({ kind: 'err', text });
      toast.error(text, { duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <p className="text-xs text-slate-500">Edit or remove saved options</p>
          </div>
          <button
            onClick={handleClose}
            disabled={busy}
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {notice && (
          <div
            role="status"
            className={`mb-4 flex items-start gap-2.5 rounded-xl border px-3 py-3 text-sm font-medium leading-snug ${
              notice.kind === 'ok'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                : 'border-rose-300 bg-rose-50 text-rose-900'
            }`}
          >
            {notice.kind === 'ok' ? (
              <CircleCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            ) : (
              <CircleAlert size={18} className="mt-0.5 shrink-0 text-rose-600" />
            )}
            <p>{notice.text}</p>
          </div>
        )}

        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <div className="max-h-[380px] overflow-y-auto">
            {sorted.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">{emptyText}</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {sorted.map((value) => {
                  const isEditing = editing?.toLowerCase() === value.toLowerCase();
                  return (
                    <li key={value} className="flex items-center gap-2 p-3 hover:bg-slate-50">
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <input
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void saveEdit();
                            }}
                            disabled={busy}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                            autoFocus
                          />
                        ) : (
                          <div className="text-sm font-semibold text-slate-700 truncate">{value}</div>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => void saveEdit()}
                            disabled={busy}
                            className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                            title="Save"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setEditing(null);
                              setDraft('');
                            }}
                            disabled={busy}
                            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                            title="Cancel"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEdit(value)}
                            disabled={busy}
                            className="inline-flex min-h-8 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                            title="Edit"
                          >
                            <Pencil size={14} aria-hidden="true" /> Edit
                          </button>
                          <button
                            onClick={() => void remove(value)}
                            disabled={busy}
                            className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-5">
          <button
            onClick={handleClose}
            disabled={busy}
            className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}
