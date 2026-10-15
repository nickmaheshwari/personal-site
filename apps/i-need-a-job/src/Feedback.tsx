import { type FormEvent, useContext, useEffect, useState } from "react";
import { FEEDBACK_KINDS, type FeedbackKind, ReportContext, submitFeedback } from "./feedback.ts";

/** A bug report started from an error message: the form opens prefilled with its details. */
export interface FeedbackPrefill {
  kind: FeedbackKind;
  details: string;
  /** Changes on every report, so reporting the same error twice still resets the form. */
  id: number;
}

interface Props {
  prefill: FeedbackPrefill | null;
  /** Closed, it's just a button that opens it. The draft is kept while closed. */
  open: boolean;
  /** Omit to show the form with no way to close it (the crash page). */
  onOpenChange?: (open: boolean) => void;
}

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

const MAX_MESSAGE = 5000;

export function Feedback({ prefill, open, onOpenChange }: Props) {
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [details, setDetails] = useState("");
  const [includeDetails, setIncludeDetails] = useState(true);
  // Honeypot: hidden from people, so only bots fill it in.
  const [botField, setBotField] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    if (!prefill) return;
    setKind(prefill.kind);
    setDetails(prefill.details);
    setIncludeDetails(true);
    setStatus({ kind: "idle" });
  }, [prefill]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (botField) {
      setStatus({ kind: "sent" });
      return;
    }
    setStatus({ kind: "sending" });
    try {
      await submitFeedback({
        kind,
        message: message.trim(),
        email: email.trim(),
        details: includeDetails ? details : "",
      });
      setStatus({ kind: "sent" });
      setMessage("");
      setDetails("");
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "The message couldn't be sent." });
    }
  }

  if (!open) {
    return (
      <div className="feedback-toggle">
        <button type="button" onClick={() => onOpenChange?.(true)}>
          Send feedback or report a bug
        </button>
      </div>
    );
  }

  return (
    <section className="card" id="feedback">
      <div className="card-header">
        <h2>Feedback and bug reports</h2>
        {onOpenChange && (
          <button type="button" className="link" onClick={() => onOpenChange(false)}>
            Close
          </button>
        )}
      </div>
      <p className="hint">
        Suggest a feature or tell me about a problem. Your message is emailed to the site's owner. Your resume is never
        included.
      </p>

      {status.kind === "sent" ? (
        <p role="status">
          Thanks, your message was sent.{" "}
          <button type="button" className="link" onClick={() => setStatus({ kind: "idle" })}>
            Send another
          </button>
        </p>
      ) : (
        <form onSubmit={send}>
          <label className="field">
            <span>What's this about?</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as FeedbackKind)}>
              {(Object.keys(FEEDBACK_KINDS) as FeedbackKind[]).map((k) => (
                <option key={k} value={k}>
                  {FEEDBACK_KINDS[k]}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>{kind === "bug" ? "What happened, and what were you doing?" : "Your message"}</span>
            <textarea
              required
              rows={5}
              maxLength={MAX_MESSAGE}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Your email (optional, if you'd like a reply)</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>

          {details && (
            <>
              <label className="field checkbox">
                <input type="checkbox" checked={includeDetails} onChange={(e) => setIncludeDetails(e.target.checked)} />
                <span>Include technical details about the problem</span>
              </label>
              <details className="hint">
                <summary>What's included</summary>
                <pre className="details">{details}</pre>
              </details>
            </>
          )}

          <label className="honeypot" aria-hidden="true">
            Leave this empty
            <input
              type="text"
              name="bot-field"
              tabIndex={-1}
              autoComplete="off"
              value={botField}
              onChange={(e) => setBotField(e.target.value)}
            />
          </label>

          <div className="actions">
            <button type="submit" className="primary" disabled={status.kind === "sending" || !message.trim()}>
              {status.kind === "sending" ? "Sending…" : "Send"}
            </button>
          </div>
          {status.kind === "error" && (
            <p className="error" role="alert">
              {status.message}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

/** A link that opens the feedback form as a bug report, prefilled with `problem`. */
export function ReportButton({ problem }: { problem: string }) {
  const report = useContext(ReportContext);
  return (
    <button type="button" className="link" onClick={() => report(problem)}>
      Report this problem
    </button>
  );
}
