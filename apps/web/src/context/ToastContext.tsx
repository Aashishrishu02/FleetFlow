import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  toast: (title: string, message?: string, type?: ToastType) => void;
  addToast: (typeOrTitle: ToastType | string, messageOrType?: string | ToastType, maybeType?: ToastType) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToastRaw = useCallback((title: string, message?: string, type: ToastType = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const addToastFlexible = useCallback((
    typeOrTitle: ToastType | string,
    messageOrType?: string | ToastType,
    maybeType?: ToastType,
  ) => {
    const isFirstType = ['success', 'error', 'info', 'warning'].includes(typeOrTitle as string);
    if (isFirstType) {
      // Called as: addToast('success', 'Message here')
      const type = typeOrTitle as ToastType;
      const title = (messageOrType as string) || (type.toUpperCase());
      addToastRaw(title, undefined, type);
    } else {
      // Called as: addToast('Title', 'Message', 'success')
      const title = typeOrTitle as string;
      const message = typeof messageOrType === 'string' ? messageOrType : undefined;
      const type = maybeType || (typeof messageOrType === 'string' && ['success', 'error', 'info', 'warning'].includes(messageOrType) ? (messageOrType as ToastType) : 'info');
      addToastRaw(title, message, type);
    }
  }, [addToastRaw]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback((title: string, message?: string) => addToastRaw(title, message, 'success'), [addToastRaw]);
  const error = useCallback((title: string, message?: string) => addToastRaw(title, message, 'error'), [addToastRaw]);
  const info = useCallback((title: string, message?: string) => addToastRaw(title, message, 'info'), [addToastRaw]);
  const warning = useCallback((title: string, message?: string) => addToastRaw(title, message, 'warning'), [addToastRaw]);

  return (
    <ToastContext.Provider value={{ toast: addToastRaw, addToast: addToastFlexible, success, error, info, warning }}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          const borderClass =
            t.type === 'success'
              ? 'border-emerald-500 bg-white shadow-lg text-slate-800'
              : t.type === 'error'
              ? 'border-rose-500 bg-white shadow-lg text-slate-800'
              : t.type === 'warning'
              ? 'border-amber-500 bg-white shadow-lg text-slate-800'
              : 'border-blue-500 bg-white shadow-lg text-slate-800';

          const iconColor =
            t.type === 'success'
              ? 'text-emerald-500'
              : t.type === 'error'
              ? 'text-rose-500'
              : t.type === 'warning'
              ? 'text-amber-500'
              : 'text-blue-500';

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border-l-4 border shadow-sm transition-all animate-fadeIn ${borderClass}`}
            >
              <div className={`mt-0.5 text-base font-bold shrink-0 ${iconColor}`}>
                {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : t.type === 'warning' ? '⚠' : 'ℹ'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 leading-tight">{t.title}</div>
                {t.message && (
                  <div className="text-[11px] text-slate-600 mt-0.5 leading-snug break-words">
                    {t.message}
                  </div>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-slate-600 text-sm leading-none p-0.5 ml-1 shrink-0"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      toast: (t: string, m?: string) => console.log(`[Toast] ${t}: ${m || ''}`),
      addToast: (t: string, m?: string) => console.log(`[Toast] ${t}: ${m || ''}`),
      success: (t: string, m?: string) => console.log(`[Toast SUCCESS] ${t}: ${m || ''}`),
      error: (t: string, m?: string) => console.error(`[Toast ERROR] ${t}: ${m || ''}`),
      info: (t: string, m?: string) => console.log(`[Toast INFO] ${t}: ${m || ''}`),
      warning: (t: string, m?: string) => console.warn(`[Toast WARN] ${t}: ${m || ''}`),
    };
  }
  return context;
};
