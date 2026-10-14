import { useMemo, useState } from "react";
import { STATUS_LABELS, STATUSES, type Status, type Tracker, trackerToCsv } from "./tracker.ts";

interface Props {
  tracker: Tracker;
  onStatusChange: (jobId: string, status: Status | null) => void;
  onNotesChange: (jobId: string, notes: string) => void;
}

function downloadCsv(tracker: Tracker) {
  const blob = new Blob([trackerToCsv(tracker)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `job-applications-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

/** The user's saved and applied jobs, with status, notes and CSV export. */
export function Applications({ tracker, onStatusChange, onNotesChange }: Props) {
  const [filter, setFilter] = useState<Status | "all">("all");
  const entries = useMemo(
    () =>
      Object.values(tracker)
        .filter((t) => filter === "all" || t.status === filter)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [tracker, filter],
  );
  const counts = useMemo(() => {
    const c: Partial<Record<Status, number>> = {};
    for (const t of Object.values(tracker)) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [tracker]);
  const total = Object.keys(tracker).length;
  if (total === 0) return null;

  return (
    <section className="card">
      <h2>Your applications</h2>
      <p className="hint">Saved in this browser only. Export a copy to keep it safe or move it to another device.</p>

      <div className="title-toolbar">
        <div className="chips">
          <button
            type="button"
            className={`chip${filter === "all" ? " selected" : ""}`}
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All ({total})
          </button>
          {STATUSES.filter((s) => counts[s]).map((s) => (
            <button
              key={s}
              type="button"
              className={`chip${filter === s ? " selected" : ""}`}
              aria-pressed={filter === s}
              onClick={() => setFilter(s)}
            >
              {STATUS_LABELS[s]} ({counts[s]})
            </button>
          ))}
        </div>
        <button type="button" onClick={() => downloadCsv(tracker)}>
          Export CSV
        </button>
      </div>

      <ul className="jobs">
        {entries.map(({ job, status, notes, appliedAt }) => (
          <li key={job.id} className="job">
            <div className="job-main">
              <a href={job.url} target="_blank" rel="noopener noreferrer" className="job-title">
                {job.title}
              </a>
              <span className="job-company">{job.company}</span>
            </div>
            <div className="job-meta">
              {job.location && <span>{job.location}</span>}
              {appliedAt && <span>Applied {shortDate(appliedAt)}</span>}
            </div>
            <div className="tracker-row">
              <select
                aria-label={`Status for ${job.title}`}
                value={status}
                onChange={(e) => onStatusChange(job.id, e.target.value as Status)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <textarea
                aria-label={`Notes for ${job.title}`}
                placeholder="Notes: contacts, follow-up dates, interview prep…"
                defaultValue={notes}
                rows={1}
                onBlur={(e) => {
                  if (e.target.value !== notes) onNotesChange(job.id, e.target.value);
                }}
              />
              <button type="button" className="link" onClick={() => onStatusChange(job.id, null)}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
