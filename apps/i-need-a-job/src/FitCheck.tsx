import { useEffect, useState } from "react";
import { compareKeywords, type KeywordComparison } from "../shared/keywords.ts";
import { fetchPostingText } from "./api.ts";
import { ReportButton } from "./Feedback.tsx";

interface Props {
  url: string;
  resumeText: string;
}

type State = { kind: "loading" } | { kind: "error"; message: string } | { kind: "done"; result: KeywordComparison };

/** Shows which of a posting's skill keywords the resume covers and which it doesn't. */
export function FitCheck({ url, resumeText }: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    fetchPostingText(url, controller.signal)
      .then((text) => setState({ kind: "done", result: compareKeywords(resumeText, text) }))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setState({ kind: "error", message: err instanceof Error ? err.message : "Couldn't load the posting." });
        }
      });
    return () => controller.abort();
  }, [url, resumeText]);

  if (state.kind === "loading") return <p className="fit hint">Reading the job description…</p>;
  if (state.kind === "error") {
    return (
      <p className="fit error">
        {state.message} <ReportButton problem={`The resume fit check failed: ${state.message}\nPosting: ${url}`} />
      </p>
    );
  }

  const { matched, missing } = state.result;
  if (matched.length === 0 && missing.length === 0) {
    return <p className="fit hint">No skill keywords we track were found in this posting.</p>;
  }
  const total = matched.length + missing.length;
  return (
    <div className="fit">
      <p>
        Your resume mentions <strong>{matched.length}</strong> of the {total} skill keywords in this posting.
        {missing.length > 0 && " If you have experience with the missing ones, say so in your resume or cover letter."}
      </p>
      {matched.length > 0 && (
        <div className="keyword-row">
          <span className="hint">In your resume:</span>
          {matched.map((k) => (
            <span key={k} className="keyword have">
              {k}
            </span>
          ))}
        </div>
      )}
      {missing.length > 0 && (
        <div className="keyword-row">
          <span className="hint">Not in your resume:</span>
          {missing.map((k) => (
            <span key={k} className="keyword missing">
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
