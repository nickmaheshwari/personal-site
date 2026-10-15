import { Component, type ReactNode } from "react";
import { Feedback } from "./Feedback.tsx";
import { describeError, technicalDetails } from "./feedback.ts";

interface State {
  details: string | null;
}

/**
 * If rendering crashes, shows an apology and a prefilled bug report instead of
 * a blank page. (React only catches render errors in class components.)
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { details: null };

  static getDerivedStateFromError(error: unknown): State {
    return { details: technicalDetails(`The page crashed:\n${describeError(error)}`) };
  }

  render() {
    if (this.state.details === null) return this.props.children;
    return (
      <main className="page">
        <section className="card">
          <h2>Something went wrong</h2>
          <p>
            The page stopped working. Reload to try again. If it keeps happening, please tell me what you were doing
            below.
          </p>
          <div className="actions">
            <button type="button" className="primary" onClick={() => location.reload()}>
              Reload
            </button>
          </div>
        </section>
        <Feedback prefill={{ kind: "bug", details: this.state.details, id: 1 }} />
      </main>
    );
  }
}
