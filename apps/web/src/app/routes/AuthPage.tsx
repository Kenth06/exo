import { Banner, Button, Input, SensitiveInput } from "@cloudflare/kumo";
import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { Logo } from "@/components/layout/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/client/http/api";

export const AuthPage = ({ mode }: { mode: "login" | "signup" }) => {
  const { user, login, signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await (mode === "login" ? login(email, password) : signup(email, password));
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const isLogin = mode === "login";
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo className="mb-8" />
        <h1 className="text-2xl font-semibold">{isLogin ? "Sign in" : "Create an account"}</h1>
        <p className="mt-2 exo-fg-soft">
          {isLogin ? "Your projects and renders are waiting." : "Free. Your projects and renders stay in your account."}
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <SensitiveInput
            label="Password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            minLength={8}
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            description={isLogin ? undefined : "At least 8 characters."}
          />
          {error && <Banner variant="error" title={error} />}
          <Button type="submit" variant="primary" className="w-full" loading={busy}>
            {isLogin ? "Sign in" : "Create account"}
          </Button>
        </form>
        <p className="mt-6 text-sm exo-fg-soft">
          {isLogin ? (
            <>
              New here?{" "}
              <Link to={`/signup?next=${encodeURIComponent(next)}`} className="underline">
                Create an account
              </Link>
            </>
          ) : (
            <>
              Have an account?{" "}
              <Link to={`/login?next=${encodeURIComponent(next)}`} className="underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
};
