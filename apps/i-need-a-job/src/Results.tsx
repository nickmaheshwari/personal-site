import { useMemo, useState } from "react";
import type { FilterStats, MatchedJob } from "../shared/match.ts";
import type { SearchState } from "./App.tsx";

interface Props {
  search: SearchState;
  matches: MatchedJob[];
  stats: FilterStats;
}

const FILTER_NAMES: Record<keyof FilterStats["removed"], string> = {
  industry: "the industry filter",
  remote: "Remote only",
  location: "the location filter",
  experience: "years of experience",
  salary: "the salary filter",
};

/** Explains an empty result: did nothing match the titles, or did a filter remove everything? */
function noMatchesHint(stats: FilterStats): string {
  if (stats.titleMatches === 0) {
    return 'No postings matched your selected titles. Try selecting more titles (including stretch ones), adding shorter titles yourself (e.g. "Program Coordinator"), or turning on broader title matching.';
  }
  const removed = (Object.keys(FILTER_NAMES) as (keyof FilterStats["removed"])[])
    .filter((k) => stats.removed[k] > 0)
    .map((k) => `${FILTER_NAMES[k]} removed ${stats.removed[k]}`);
  return `${stats.titleMatches} postings matched your titles, but ${removed.join(", ")}. Try loosening those filters.`;
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

export function Results({ search, matches, stats }: Props) {
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
        <progress value={search.done} max={search.total} />
        <span>
          {search.running ? `Searching ${search.done} of ${search.total} sources` : `Searched ${search.total} sources`}{" "}
          · <strong>{matches.length}</strong> matches at {companies} {companies === 1 ? "employer" : "employers"}
        </span>
      </div>

      {search.federal === "included" && (
        <p className="hint">
          Includes federal jobs from USAJOBS for the {search.federalTitles.length} titles selected when you searched.
          Search again after changing titles to update them.
        </p>
      )}
      {search.federal === "disabled" && (
        <p className="hint">Federal (USAJOBS) jobs aren't included: no USAJOBS API key is configured.</p>
      )}

      {search.failed.length > 0 && (
        <p className="hint">Couldn't load: {search.failed.map((f) => f.company).join(", ")}</p>
      )}

      {!search.running && matches.length === 0 && <p className="empty">{noMatchesHint(stats)}</p>}

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
