import { type FormEvent, useMemo, useState } from "react";
import { isSoftSkill, type ResumeSkills, trackedSkill } from "../shared/keywords.ts";
import { type FilterStats, filterBySkills, jobSkills, type MatchedJob, searchJobs } from "../shared/match.ts";
import type { Job } from "../shared/types.ts";
import type { SearchState } from "./App.tsx";
import { postingUrl } from "./api.ts";
import { ReportButton } from "./Feedback.tsx";
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
  /** The resume's top skills (see topSkills), offered as toggles to narrow the results. */
  resumeSkills: ResumeSkills;
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
  resumeSkills,
  titlesChanged,
  onSearchAgain,
}: Props) {
  const [shown, setShown] = useState(PAGE);
  const [query, setQuery] = useState("");
  const sorted = useMemo(
    () => [...matches].sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? "")),
    [matches],
  );
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const visible = useMemo(
    () => filterBySkills(searchJobs(sorted, query), selectedSkills),
    [sorted, query, selectedSkills],
  );
  const companies = new Set(matches.map((m) => m.company)).size;
  const narrowed = query.trim() !== "" || selectedSkills.length > 0;
  // Postings from sources without descriptions can only match skills named in their title.
  const undescribed = selectedSkills.length > 0 && matches.some((m) => !m.skills);
  const toggleSkill = (skill: string) => {
    setSelectedSkills((s) => (s.includes(skill) ? s.filter((x) => x !== skill) : [...s, skill]));
    setShown(PAGE);
  };

  // Skills the visitor typed. A tracked keyword ("Tableau") matches like the
  // resume's skills; anything else can only be found in job titles.
  const [customSkills, setCustomSkills] = useState<{ skill: string; tracked: boolean }[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const fromResume = [...resumeSkills.hard, ...resumeSkills.soft];
  const added = customSkills.filter((c) => !fromResume.includes(c.skill));
  // Typed skills join the group they belong to; ones we don't track go under "Other".
  const skillGroups: [string, string[]][] = [
    [
      "Hard skills",
      [...resumeSkills.hard, ...added.filter((c) => c.tracked && !isSoftSkill(c.skill)).map((c) => c.skill)],
    ],
    [
      "Soft skills",
      [...resumeSkills.soft, ...added.filter((c) => c.tracked && isSoftSkill(c.skill)).map((c) => c.skill)],
    ],
    ["Other", added.filter((c) => !c.tracked).map((c) => c.skill)],
  ];
  const skillOptions = skillGroups.flatMap(([, skills]) => skills);
  const untrackedSelected = customSkills.filter((c) => !c.tracked && selectedSkills.includes(c.skill));
  const addSkill = (e: FormEvent) => {
    e.preventDefault();
    const typed = newSkill.trim();
    if (!typed) return;
    const tracked = trackedSkill(typed);
    const skill = tracked ?? typed;
    if (!skillOptions.includes(skill)) setCustomSkills((c) => [...c, { skill, tracked: tracked !== null }]);
    setSelectedSkills((s) => (s.includes(skill) ? s : [...s, skill]));
    setNewSkill("");
    setShown(PAGE);
  };
  const clearFilters = () => {
    setQuery("");
    setSelectedSkills([]);
  };

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
          {search.failed.join(", ")}.{" "}
          <ReportButton
            problem={`Couldn't load ${search.failed.length} sources: ${search.failed.join(", ")}\nTitles: ${search.titles.join(", ")}`}
          />
        </details>
      )}
      {search.partial.length > 0 && (
        <details className="hint">
          <summary>Some results may be missing from {search.partial.length} large employers</summary>
          These employers' career sites were slow, so not every title was searched: {search.partial.join(", ")}. Search
          again in a few minutes, or with fewer titles, to fill them in.
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
          <div className="skill-filter">
            <span className="hint">
              {fromResume.length > 0
                ? "Filter jobs to show those with skills from your resume:"
                : "Filter jobs to show those with a skill:"}
            </span>
            {skillGroups.map(
              ([label, skills]) =>
                skills.length > 0 && (
                  <div key={label} className="skill-group">
                    <span className="skill-group-label">{label}</span>
                    <div className="chips">
                      {skills.map((skill) => {
                        const on = selectedSkills.includes(skill);
                        return (
                          <button
                            key={skill}
                            type="button"
                            className={`chip${on ? " selected" : ""}`}
                            aria-pressed={on}
                            onClick={() => toggleSkill(skill)}
                          >
                            {skill}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ),
            )}
            <div className="chips">
              <form className="add-skill" onSubmit={addSkill}>
                <input
                  type="text"
                  aria-label="Add a skill to filter by"
                  placeholder="Add a skill…"
                  value={newSkill}
                  maxLength={60}
                  onChange={(e) => setNewSkill(e.target.value)}
                />
                <button type="submit" className="small" disabled={!newSkill.trim()}>
                  Add
                </button>
              </form>
            </div>
          </div>
          {untrackedSelected.length > 0 && (
            <p className="hint">
              {untrackedSelected.map((c) => `"${c.skill}"`).join(", ")}{" "}
              {untrackedSelected.length === 1 ? "isn't a skill" : "aren't skills"} we can find in job descriptions, so{" "}
              {untrackedSelected.length === 1 ? "it only matches" : "they only match"} job titles.
            </p>
          )}
          {narrowed && (
            <p className="hint" aria-live="polite">
              {visible.length === 0
                ? "No matching jobs fit your search and skills."
                : `Showing ${visible.length} of ${matches.length} matches.`}{" "}
              <button type="button" className="link" onClick={clearFilters}>
                Clear
              </button>
              {undescribed &&
                " Some job boards don't share descriptions, so their jobs only match a skill named in the job title."}
            </p>
          )}
        </div>
      )}

      {visible.length > 0 && (
        <p className="hint tracker-hint">
          <strong>Tracking jobs:</strong> use the "Not tracked" menu on a job to mark it Saved, Applied, Interviewing,
          Offer or Rejected. Tracked jobs are listed under "Your applications" at the bottom of the page, where you can
          add notes and export a CSV. They keep a copy of the posting, so they stay listed after it's taken down. Your
          list is saved in this browser only, so it won't show up on other devices and is lost if you clear your browser
          data. Export a copy to keep it safe.
        </p>
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
              {skillOptions.length > 0 &&
                (() => {
                  const have = jobSkills(job);
                  return skillOptions
                    .filter((s) => have.has(s))
                    .map((s) => (
                      <span key={s} className="badge skill">
                        {s}
                      </span>
                    ));
                })()}
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
