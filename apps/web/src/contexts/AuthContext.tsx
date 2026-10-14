import type { PublicUser } from "@exo/shared";
import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useState } from "react";
import { authService } from "@/lib/client/services/auth.service";

interface AuthValue {
  user: PublicUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    authService
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => setUser(await authService.login(email, password)),
    [],
  );
  const signup = useCallback(
    async (email: string, password: string) => setUser(await authService.signup(email, password)),
    [],
  );
  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, login, signup, logout }), [user, ready, login, signup, logout]);
  return <AuthContext value={value}>{children}</AuthContext>;
};

export const useAuth = () => {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
};
