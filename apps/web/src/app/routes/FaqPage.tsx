import { Collapsible } from "@cloudflare/kumo";
import { Link } from "react-router";
import { FAQ } from "@/components/marketing/content";
import { PageHeader } from "@/components/marketing/Section";

export const FaqPage = () => (
  <>
    <PageHeader title="Questions" />
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <div className="divide-y exo-border border-y exo-border">
        {FAQ.map((f) => (
          <Collapsible.Root key={f.q} className="py-2">
            <Collapsible.DefaultTrigger>{f.q}</Collapsible.DefaultTrigger>
            <Collapsible.DefaultPanel>
              <p className="pb-3 exo-fg-soft">{f.a}</p>
            </Collapsible.DefaultPanel>
          </Collapsible.Root>
        ))}
      </div>
      <p className="mt-8 exo-fg-soft">
        Not answered here?{" "}
        <Link to="/contact" className="underline underline-offset-4">
          Send us a message
        </Link>
        .
      </p>
    </div>
  </>
);
