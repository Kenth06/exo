import { Button, DropdownMenu } from "@cloudflare/kumo";
import { ListIcon } from "@phosphor-icons/react";
import { Link, NavLink, useNavigate } from "react-router";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "./Logo";

export const NAV = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/why-gcode", label: "Why G-code" },
  { to: "/colors", label: "Colors" },
  { to: "/scenes", label: "Scenes" },
  { to: "/faq", label: "FAQ" },
];

export const SiteHeader = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 border-b exo-border exo-bg">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-[var(--exo-line)] ${isActive ? "font-medium" : "exo-fg-soft"}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <Button variant="primary" onClick={() => navigate("/app")}>
              Open app
            </Button>
          ) : (
            <>
              <Link to="/login" className="hidden text-sm sm:inline">
                Sign in
              </Link>
              <Button variant="primary" onClick={() => navigate("/signup")}>
                Open the editor
              </Button>
            </>
          )}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenu.Trigger
                render={<Button variant="ghost" shape="square" icon={<ListIcon />} aria-label="Menu" />}
              />
              <DropdownMenu.Content>
                {NAV.map((n) => (
                  <DropdownMenu.Item key={n.to} onClick={() => navigate(n.to)}>
                    {n.label}
                  </DropdownMenu.Item>
                ))}
                {!user && <DropdownMenu.Item onClick={() => navigate("/login")}>Sign in</DropdownMenu.Item>}
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};
