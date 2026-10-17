import { Toaster } from 'sonner';

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      expand
      richColors
      closeButton
      duration={4000}
      offset={16}
      style={{ zIndex: 200 }}
      toastOptions={{
        style: {
          background: 'white',
          color: '#1e293b',
          border: '1px solid #e2e8f0',
          fontSize: '14px',
        },
        className: 'toast-custom',
      }}
    />
  );
}
