'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  api,
  refreshAccessToken,
  setAccessToken,
} from '@/lib/api';
import type { User } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Toast system                                                        */
/* ------------------------------------------------------------------ */
type ToastKind = 'info' | 'success' | 'error';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}
interface ToastCtx {
  toast: (message: string, kind?: ToastKind) => void;
}
const ToastContext = createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

function ToastViewport({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`glass-strong pointer-events-auto w-full max-w-sm animate-fade-up rounded-xl px-4 py-3 text-sm shadow-glass ${
            t.kind === 'error'
              ? 'border-red-400/30 text-red-200'
              : t.kind === 'success'
                ? 'border-emerald-400/30 text-emerald-200'
                : 'text-white/90'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Auth context                                                        */
/* ------------------------------------------------------------------ */
interface AuthCtx {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  setUser: () => {},
  refreshMe: async () => {},
  logout: async () => {},
});
export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const token = await refreshAccessToken();
      if (!active) return;
      if (token) {
        await refreshMe();
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [refreshMe]);

  const value = useMemo(
    () => ({ user, loading, setUser, refreshMe, logout }),
    [user, loading, refreshMe, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ------------------------------------------------------------------ */
/* Root providers                                                      */
/* ------------------------------------------------------------------ */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  return (
    <QueryClientProvider client={client}>
      <ToastContext.Provider value={{ toast }}>
        <AuthProvider>{children}</AuthProvider>
        <ToastViewport toasts={toasts} />
      </ToastContext.Provider>
    </QueryClientProvider>
  );
}
