import { useMemo, useState } from "react";
import { type FilterStats, type MatchedJob, searchJobs } from "../shared/match.ts";
import type { Job } from "../shared/types.ts";
import type { SearchState } from "./App.tsx";
import { postingUrl } from "./api.ts";
import { FitCheck } from "./FitCheck.tsx";
import { STATUS_LABELS, STATUSES, type Status, type Tracker } from "./tracker.ts";

interface Props {
  search: SearchState;
  matches: MatchedJob[];
  stats: FilterStats;
  tracker: Tracker;
  onStatusChange: (job: Job, status: Status | null) => void;
  /** The uploaded resume's text, for the keyword check; null if none is loaded. */
  resumeText: string | null;
  /** The selected titles differ from the ones these results were searched for. */
  titlesChanged: boolean;
  onSearchAgain: () => void;
}

interface JobActionsProps {
  job: Job;
  status: Status | null;
  onStatusChange: (job: Job, status: Status | null) => void;
  resumeText: string | null;
}

/** Apply link, tracker status, and the resume keyword check for one posting. */
function JobActions({ job, status, onStatusChange, resumeText }: JobActionsProps) {
  const [checking, setChecking] = useState(false);
  const fitUrl = postingUrl(job);
  return (
    <>
      <div className="job-actions">
        <a
          className="button primary small"
          href={job.applyUrl ?? job.url}
          target="_blank"
          rel="noopener noreferrer"
          title={job.applyUrl ? "Opens the application form" : "Opens the posting; apply from there"}
        >
          {job.applyUrl ? "Apply" : "View & apply"}
        </a>
        <select
          aria-label={`Track ${job.title}`}
          value={status ?? ""}
          onChange={(e) => onStatusChange(job, (e.target.value || null) as Status | null)}
        >
          <option value="">Not tracked</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {fitUrl && resumeText && (
          <button type="button" className="link" aria-expanded={checking} onClick={() => setChecking((c) => !c)}>
            {checking ? "Hide resume fit" : "Check resume fit"}
          </button>
        )}
      </div>
      {checking && fitUrl && resumeText && <FitCheck url={fitUrl} resumeText={resumeText} />}
    </>
  );
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

export function Results({
  search,
  matches,
  stats,
  tracker,
  onStatusChange,
  resumeText,
  titlesChanged,
  onSearchAgain,
}: Props) {
  const [shown, setShown] = useState(PAGE);
  const [query, setQuery] = useState("");
  const sorted = useMemo(
    () => [...matches].sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? "")),
    [matches],
  );
  const visible = useMemo(() => searchJobs(sorted, query), [sorted, query]);
  const companies = new Set(matches.map((m) => m.company)).size;

  return (
    <section className="card">
      <h2>
        <span className="step">3</span> Matching jobs
      </h2>

      <div className="progress" aria-live="polite">
        <progress value={search.done} max={search.total} />
        <span>
          {search.running
            ? `Searching ${search.done} of ${search.total} employers and job sites`
            : `Searched ${search.total} employers and job sites`}{" "}
          · <strong>{matches.length}</strong> matches at {companies} {companies === 1 ? "employer" : "employers"}
        </span>
      </div>

      {titlesChanged && (
        <p className="hint">
          These results are for the {search.titles.length} titles selected when you searched.{" "}
          <button type="button" className="link" onClick={onSearchAgain}>
            Search again with your current titles
          </button>
        </p>
      )}
      {search.federal === "disabled" && (
        <p className="hint">Federal (USAJOBS) jobs aren't included: no USAJOBS API key is configured.</p>
      )}

      {search.failed.length > 0 && (
        <details className="hint">
          <summary>Couldn't load {search.failed.length} sources</summary>
          {search.failed.join(", ")}
        </details>
      )}

      {!search.running && matches.length === 0 && <p className="empty">{noMatchesHint(stats)}</p>}

      {matches.length > 0 && (
        <div className="results-search">
          <input
            type="search"
            aria-label="Search matching jobs"
            placeholder="Search by employer, title, location…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
          />
          {query.trim() && (
            <p className="hint" aria-live="polite">
              {visible.length === 0 ? (
                <>
                  No matching jobs contain "{query.trim()}".{" "}
                  <button type="button" className="link" onClick={() => setQuery("")}>
                    Clear search
                  </button>
                </>
              ) : (
                `Showing ${visible.length} of ${matches.length} matches`
              )}
            </p>
          )}
        </div>
      )}

      <ul className="jobs">
        {visible.slice(0, shown).map((job) => (
          <li key={job.id} className="job">
            <div className="job-main">
              <a href={job.url} target="_blank" rel="noopener noreferrer" className="job-title">
                {job.title}
              </a>
              <span className="job-company">
                {job.company}
                {job.via && (
                  <>
                    {" · via "}
                    <a href={job.url} target="_blank" rel="noopener noreferrer">
                      {job.via}
                    </a>
                  </>
                )}
              </span>
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
            <JobActions
              job={job}
              status={tracker[job.id]?.status ?? null}
              onStatusChange={onStatusChange}
              resumeText={resumeText}
            />
          </li>
        ))}
      </ul>

      {visible.length > shown && (
        <div className="actions">
          <button type="button" onClick={() => setShown((n) => n + PAGE)}>
            Show more ({visible.length - shown} remaining)
          </button>
        </div>
      )}
    </section>
  );
}
