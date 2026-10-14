import { Link } from "react-router";
import { Logo } from "./Logo";
import { ThemeSwitcher } from "./ThemeSwitcher";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { to: "/how-it-works", label: "How it works" },
      { to: "/why-gcode", label: "Why G-code" },
      { to: "/colors", label: "Colors" },
      { to: "/scenes", label: "Scenes" },
      { to: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Account",
    links: [
      { to: "/signup", label: "Create an account" },
      { to: "/login", label: "Sign in" },
      { to: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/legal/privacy", label: "Privacy" },
      { to: "/legal/terms", label: "Terms" },
      { to: "/legal/accessibility", label: "Accessibility" },
    ],
  },
];

const YEAR = new Date().getFullYear();

export const SiteFooter = () => (
  <footer className="border-t exo-border">
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)]">
      <div className="space-y-4">
        <Logo />
        <p className="max-w-xs text-sm exo-fg-soft">Product photos and videos rendered from sliced G-code, free.</p>
        <ThemeSwitcher />
      </div>
      {COLUMNS.map((c) => (
        <div key={c.title}>
          <h2 className="mb-3 text-sm font-medium">{c.title}</h2>
          <ul className="space-y-2 text-sm exo-fg-soft">
            {c.links.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <p className="mx-auto max-w-6xl px-4 pb-10 text-xs exo-fg-soft sm:px-6">© {YEAR} Exo</p>
  </footer>
);
