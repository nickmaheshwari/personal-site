// Application tracker: jobs the user has saved or applied to, with status and
// notes. Kept in this browser's localStorage only (it's a per-person
// convenience, nothing is sent anywhere), so it can be lost if site data is cleared.

import { useCallback, useEffect, useState } from "react";
import type { Job } from "../shared/types.ts";

export const STATUSES = ["saved", "applied", "interviewing", "offer", "rejected"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected / closed",
};

export interface TrackedJob {
  /** Snapshot of the posting, so it stays listed after it disappears from the job board. */
  job: Job;
  status: Status;
  notes: string;
  /** ISO date the status first became "applied" (or later). */
  appliedAt: string | null;
  updatedAt: string;
}

export type Tracker = Record<string, TrackedJob>;

const STORAGE_KEY = "i-need-a-job:tracker:v1";

function load(): Tracker {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Tracker) : {};
  } catch {
    return {};
  }
}

function save(tracker: Tracker) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracker));
  } catch {
    // Storage unavailable (private mode, quota, blocked); changes last until the page closes.
  }
}

/** Returns the tracker with `jobId` set to `status` (or removed when status is null). */
export function withStatus(tracker: Tracker, job: Job, status: Status | null, now = new Date()): Tracker {
  const next = { ...tracker };
  if (status === null) {
    delete next[job.id];
    return next;
  }
  const existing = tracker[job.id];
  const pastSaved = status !== "saved";
  next[job.id] = {
    job: existing?.job ?? job,
    status,
    notes: existing?.notes ?? "",
    appliedAt: existing?.appliedAt ?? (pastSaved ? now.toISOString() : null),
    updatedAt: now.toISOString(),
  };
  return next;
}

export function useTracker() {
  const [tracker, setTracker] = useState<Tracker>(load);

  useEffect(() => save(tracker), [tracker]);

  // Keep other open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setTracker(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setStatus = useCallback((job: Job, status: Status | null) => setTracker((t) => withStatus(t, job, status)), []);
  const setNotes = useCallback(
    (jobId: string, notes: string) =>
      setTracker((t) => {
        const entry = t[jobId];
        return entry ? { ...t, [jobId]: { ...entry, notes, updatedAt: new Date().toISOString() } } : t;
      }),
    [],
  );

  return { tracker, setStatus, setNotes };
}

const csvCell = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

/** Spreadsheet-friendly export, most recently updated first. */
export function trackerToCsv(tracker: Tracker): string {
  const header = ["Company", "Title", "Location", "Status", "Applied", "Last updated", "Notes", "URL"];
  const rows = Object.values(tracker)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((t) => [
      t.job.company,
      t.job.title,
      t.job.location,
      STATUS_LABELS[t.status],
      day(t.appliedAt),
      day(t.updatedAt),
      t.notes,
      t.job.url,
    ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}
