import { Button, DropdownMenu } from "@cloudflare/kumo";
import { FolderSimpleIcon, ImagesIcon, SignOutIcon, UserCircleIcon } from "@phosphor-icons/react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { useAuth } from "@/contexts/AuthContext";
import { RequireAuth } from "./RequireAuth";
import { Logo } from "./Logo";

const LINKS = [
  { to: "/app", label: "Projects", icon: FolderSimpleIcon, end: true },
  { to: "/app/gallery", label: "Gallery", icon: ImagesIcon, end: false },
];

export const AppShell = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <RequireAuth>
      <div className="flex min-h-dvh flex-col">
        <header className="border-b exo-border">
          <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4">
            <Logo />
            <nav className="flex items-center gap-1" aria-label="App">
              {LINKS.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm hover:bg-[var(--exo-line)] ${isActive ? "font-medium" : "exo-fg-soft"}`
                  }
                >
                  <Icon size={16} aria-hidden="true" />
                  <span className="hidden sm:inline">{label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="ml-auto">
              <DropdownMenu>
                <DropdownMenu.Trigger
                  render={
                    <Button variant="ghost" icon={<UserCircleIcon size={18} />}>
                      <span className="hidden max-w-48 truncate sm:inline">{user?.email}</span>
                    </Button>
                  }
                />
                <DropdownMenu.Content>
                  <DropdownMenu.Item onClick={() => navigate("/app/account")}>Account</DropdownMenu.Item>
                  <DropdownMenu.Item onClick={() => navigate("/")}>Website</DropdownMenu.Item>
                  <DropdownMenu.Item
                    onClick={async () => {
                      await logout();
                      navigate("/");
                    }}
                  >
                    <SignOutIcon size={14} /> Sign out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </RequireAuth>
  );
};
