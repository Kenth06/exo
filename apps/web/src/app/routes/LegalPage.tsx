import { Navigate, useParams } from "react-router";
import { PageHeader } from "@/components/marketing/Section";

const DOCS: Record<string, { title: string; sections: Array<[string, string]> }> = {
  privacy: {
    title: "Privacy",
    sections: [
      [
        "What we store",
        "Your email, a salted password hash, the files you upload, the project settings you choose and the renders you keep. Session cookies are HttpOnly and only identify your session.",
      ],
      [
        "Where",
        "Files and renders are stored in Cloudflare R2; account data in Cloudflare D1. Rendering happens on your own device.",
      ],
      ["What we don't do", "We don't sell data, show ads, or use your files or renders to train models."],
      [
        "Deleting",
        "Deleting a project deletes its files. Deleting a render deletes it from storage. Write to us to delete your account.",
      ],
    ],
  },
  terms: {
    title: "Terms",
    sections: [
      ["The service", "Exo is provided free of charge, as is, without warranty. We may change or stop features."],
      [
        "Your content",
        "You keep all rights to what you upload and render. You give us permission to store and process it only to run the service for you.",
      ],
      ["Fair use", "Don't upload content you have no right to, and don't try to break or overload the service."],
    ],
  },
  accessibility: {
    title: "Accessibility",
    sections: [
      [
        "Our aim",
        "Exo should be usable with a keyboard and a screen reader, in light and dark mode, and at any zoom level.",
      ],
      [
        "Known gaps",
        "The 3D preview is visual by nature; every render is labeled with the model, color and scene it shows.",
      ],
      ["Tell us", "If something gets in your way, use the contact page and we'll fix it."],
    ],
  },
};

export const LegalPage = () => {
  const { doc = "" } = useParams();
  const page = DOCS[doc];
  if (!page) return <Navigate to="/legal/privacy" replace />;
  return (
    <>
      <PageHeader title={page.title} />
      <div className="mx-auto max-w-6xl space-y-8 px-4 pb-16 sm:px-6">
        {page.sections.map(([h, p]) => (
          <section key={h}>
            <h2 className="text-lg font-semibold">{h}</h2>
            <p className="mt-2 max-w-2xl exo-fg-soft">{p}</p>
          </section>
        ))}
      </div>
    </>
  );
};
