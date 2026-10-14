import { useMemo, useState } from "react";
import type { MatchedJob } from "../shared/match.ts";
import type { SearchState } from "./App.tsx";

interface Props {
  search: SearchState;
  total: number;
  matches: MatchedJob[];
}

const PAGE = 50;

const money = (n: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0, notation: "compact" }).format(
    n,
  );

const age = (iso: string | null) => {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return null;
  return days === 0
    ? "today"
    : days === 1
      ? "1 day ago"
      : days < 60
        ? `${days} days ago`
        : `${Math.floor(days / 30)} months ago`;
};

export function Results({ search, total, matches }: Props) {
  const [shown, setShown] = useState(PAGE);
  const sorted = useMemo(
    () => [...matches].sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? "")),
    [matches],
  );
  const companies = new Set(matches.map((m) => m.company)).size;

  return (
    <section className="card">
      <h2>
        <span className="step">3</span> Matching jobs
      </h2>

      <div className="progress" aria-live="polite">
        <progress value={search.done} max={total} />
        <span>
          {search.running ? `Searched ${search.done} of ${total} companies` : `Searched ${total} companies`} ·{" "}
          <strong>{matches.length}</strong> matches at {companies} {companies === 1 ? "company" : "companies"}
        </span>
      </div>

      {search.failed.length > 0 && (
        <p className="hint">Couldn't load: {search.failed.map((f) => f.company).join(", ")}</p>
      )}

      {!search.running && matches.length === 0 && (
        <p className="empty">No matches. Try selecting more titles or loosening the filters.</p>
      )}

      <ul className="jobs">
        {sorted.slice(0, shown).map((job) => (
          <li key={job.id} className="job">
            <div className="job-main">
              <a href={job.url} target="_blank" rel="noopener noreferrer" className="job-title">
                {job.title}
              </a>
              <span className="job-company">{job.company}</span>
            </div>
            <div className="job-meta">
              {job.location && <span>{job.location}</span>}
              {job.remote && <span className="badge">Remote</span>}
              {job.salary && (
                <span>
                  {money(job.salary.min, job.salary.currency)}–{money(job.salary.max, job.salary.currency)}
                </span>
              )}
              {job.minYears !== null && <span>{job.minYears}+ yrs</span>}
              {age(job.postedAt) && <span>{age(job.postedAt)}</span>}
              <span className="badge subtle">{job.matchedTitle}</span>
            </div>
          </li>
        ))}
      </ul>

      {sorted.length > shown && (
        <div className="actions">
          <button type="button" onClick={() => setShown((n) => n + PAGE)}>
            Show more ({sorted.length - shown} remaining)
          </button>
        </div>
      )}
    </section>
  );
}
