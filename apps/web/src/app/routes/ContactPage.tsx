import { Banner, Button, Input, InputArea, Select } from "@cloudflare/kumo";
import { CheckCircleIcon } from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";
import { PageHeader } from "@/components/marketing/Section";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/client/http/api";
import { type ContactTopic, contactService } from "@/lib/client/services/contact.service";

const TOPICS: Record<ContactTopic, string> = {
  question: "A question",
  bug: "Something is broken",
  file: "A file that won't load",
  feedback: "Feedback or an idea",
};

export const ContactPage = () => {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? "");
  const [topic, setTopic] = useState<ContactTopic>("question");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await contactService.send({ email, topic, message });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send your message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader title="Contact" lede="Ask a question or tell us about a file that won't load. We reply by email." />
      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {sent ? (
          <Banner
            icon={<CheckCircleIcon weight="fill" />}
            title="Message sent"
            description="Thanks. We'll reply by email."
          />
        ) : (
          <form onSubmit={submit} className="max-w-xl space-y-4">
            <Input label="Your email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Select
              label="About"
              value={topic}
              onValueChange={(v) => setTopic((v as ContactTopic) ?? "question")}
              items={TOPICS}
            />
            <InputArea
              label="Message"
              required
              minLength={10}
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              description={topic === "file" ? "Tell us which slicer and printer you used." : undefined}
            />
            {error && <Banner variant="error" title={error} />}
            <Button type="submit" variant="primary" loading={sending}>
              Send
            </Button>
          </form>
        )}
      </div>
    </>
  );
};
