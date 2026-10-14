import { api } from "../http/api";

export type ContactTopic = "question" | "bug" | "file" | "feedback";

export const contactService = {
  send: (input: { email: string; topic: ContactTopic; message: string }) =>
    api.post<{ ok: true }>("/api/contact", input),
};
