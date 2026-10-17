import { useEffect, useRef, type ReactNode } from 'react';
import { AlertCircle, Loader2, RefreshCw, X } from 'lucide-react';
import { buttonClass } from './hrStyles';

/** Right-side drawer built on the native <dialog> (focus trap + Esc for free). */
export function HrDrawer({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={`fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-full border-0 bg-transparent p-0 text-slate-800 shadow-2xl backdrop:bg-slate-900/40 ${wide ? 'sm:w-[800px]' : 'sm:w-[480px]'}`}
    >
      <div className="flex h-full flex-col bg-white">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close drawer" className={buttonClass}>
            <X size={17} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
      {message}
    </p>
  );
}

/** Loading / failed-to-load placeholder for a register table. */
export function RegisterState({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div
        role="status"
        className="flex min-h-64 items-center justify-center gap-2 p-6 text-sm text-slate-500"
      >
        <Loader2 size={18} className="animate-spin text-violet-500" />
        Loading…
      </div>
    );
  }
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="rounded-2xl bg-rose-50 p-4 text-rose-400">
        <AlertCircle size={26} />
      </div>
      <p role="alert" className="max-w-sm text-sm text-slate-600">
        {error}
      </p>
      <button type="button" onClick={onRetry} className={buttonClass}>
        <RefreshCw size={14} />
        Try again
      </button>
    </div>
  );
}
