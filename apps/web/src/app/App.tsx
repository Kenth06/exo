import { createBrowserRouter, RouterProvider } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { HomePage } from "./routes/HomePage";
import { NotFoundPage } from "./routes/NotFoundPage";

// Marketing pages stay in the main bundle; the app screens (and the editor) load on demand.
const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: "how-it-works",
        lazy: async () => ({ Component: (await import("./routes/HowItWorksPage")).HowItWorksPage }),
      },
      { path: "why-gcode", lazy: async () => ({ Component: (await import("./routes/WhyGcodePage")).WhyGcodePage }) },
      { path: "colors", lazy: async () => ({ Component: (await import("./routes/ColorsPage")).ColorsPage }) },
      { path: "scenes", lazy: async () => ({ Component: (await import("./routes/ScenesPage")).ScenesPage }) },
      { path: "faq", lazy: async () => ({ Component: (await import("./routes/FaqPage")).FaqPage }) },
      { path: "contact", lazy: async () => ({ Component: (await import("./routes/ContactPage")).ContactPage }) },
      { path: "legal/:doc", lazy: async () => ({ Component: (await import("./routes/LegalPage")).LegalPage }) },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  {
    path: "login",
    lazy: async () => {
      const { AuthPage } = await import("./routes/AuthPage");
      return { Component: () => <AuthPage mode="login" /> };
    },
  },
  {
    path: "signup",
    lazy: async () => {
      const { AuthPage } = await import("./routes/AuthPage");
      return { Component: () => <AuthPage mode="signup" /> };
    },
  },
  {
    path: "app",
    element: <AppShell />,
    children: [
      { index: true, lazy: async () => ({ Component: (await import("./routes/DashboardPage")).DashboardPage }) },
      { path: "projects/:id", lazy: async () => ({ Component: (await import("./routes/EditorPage")).EditorPage }) },
      { path: "gallery", lazy: async () => ({ Component: (await import("./routes/GalleryPage")).GalleryPage }) },
      { path: "account", lazy: async () => ({ Component: (await import("./routes/AccountPage")).AccountPage }) },
    ],
  },
]);

export const App = () => <RouterProvider router={router} />;
