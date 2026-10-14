import { Banner, Button, SensitiveInput, useKumoToastManager } from "@cloudflare/kumo";
import { type FormEvent, useState } from "react";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/client/http/api";
import { authService } from "@/lib/client/services/auth.service";

export const AccountPage = () => {
  const { user } = useAuth();
  const toast = useKumoToastManager();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authService.changePassword(current, next);
      setCurrent("");
      setNext("");
      toast.add({ title: "Password changed", variant: "success" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't change your password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-10 px-4 py-10">
      <h1 className="font-semibold text-3xl">Account</h1>
      <section>
        <h2 className="mb-1 text-sm font-medium">Email</h2>
        <p className="exo-fg-soft">{user?.email}</p>
      </section>
      <section>
        <h2 className="mb-3 text-sm font-medium">Appearance</h2>
        <ThemeSwitcher />
      </section>
      <section>
        <h2 className="mb-3 text-sm font-medium">Change password</h2>
        <form onSubmit={submit} className="space-y-3">
          <SensitiveInput
            label="Current password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrent(e.target.value)}
          />
          <SensitiveInput
            label="New password"
            autoComplete="new-password"
            required
            minLength={8}
            value={next}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNext(e.target.value)}
          />
          {error && <Banner variant="error" title={error} />}
          <Button type="submit" loading={busy}>
            Change password
          </Button>
        </form>
      </section>
    </div>
  );
};
