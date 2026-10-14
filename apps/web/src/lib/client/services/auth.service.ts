import type { PublicUser } from "@exo/shared";
import { api } from "../http/api";

export const authService = {
  me: () => api.get<{ user: PublicUser | null }>("/api/me").then((r) => r.user),
  login: (email: string, password: string) =>
    api.post<{ user: PublicUser }>("/api/auth/login", { email, password }).then((r) => r.user),
  signup: (email: string, password: string) =>
    api.post<{ user: PublicUser }>("/api/auth/signup", { email, password }).then((r) => r.user),
  logout: () => api.post<{ ok: true }>("/api/auth/logout"),
  changePassword: (current: string, next: string) => api.post<{ ok: true }>("/api/auth/password", { current, next }),
};
