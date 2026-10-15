import { createContext } from "react";

// Feedback and bug reports go to Netlify Forms, which stores them and emails
// the site owner (set up under Forms → Form notifications in the Netlify UI).
// Netlify only accepts forms it found in the deployed HTML, so index.html has
// a hidden copy of this form with the same name and fields.

export const FEEDBACK_FORM = "i-need-a-job-feedback";

export type FeedbackKind = "idea" | "bug" | "other";

export const FEEDBACK_KINDS: Record<FeedbackKind, string> = {
  idea: "Suggest a feature",
  bug: "Report a bug",
  other: "Something else",
};

export interface FeedbackFields {
  kind: FeedbackKind;
  message: string;
  email: string;
  /** Technical context for bug reports. Never includes the resume. */
  details: string;
}

export async function submitFeedback(fields: FeedbackFields): Promise<void> {
  const body = new URLSearchParams({ "form-name": FEEDBACK_FORM, ...fields });
  const res = await fetch("/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`The message couldn't be sent (error ${res.status}). Please try again later.`);
}

/** An error's message and the top of its stack trace. */
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const stack = err.stack?.split("\n").slice(0, 6).join("\n");
  return stack?.includes(err.message) ? stack : `${err.message}\n${stack ?? ""}`.trim();
}

/** What a bug report includes: the problem plus page and browser, so it can be reproduced. */
export function technicalDetails(problem: string): string {
  return [
    problem,
    "",
    `Page: ${location.pathname}`,
    `Browser: ${navigator.userAgent}`,
    `Screen: ${screen.width}×${screen.height}`,
    `Time: ${new Date().toISOString()}`,
  ].join("\n");
}

/** Opens the feedback form as a bug report about `problem` (see App). */
export const ReportContext = createContext<(problem: string) => void>(() => {});
