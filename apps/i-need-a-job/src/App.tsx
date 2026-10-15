import { useMemo, useRef, useState } from "react";
import { AGGREGATORS } from "../shared/aggregators.ts";
import { COMPANIES, INDUSTRIES } from "../shared/companies.ts";
import { dedupeJobs, type Filters, filterJobsWithStats } from "../shared/match.ts";
import { analyzeResume } from "../shared/resume.ts";
import type { Job, TitleFit } from "../shared/types.ts";
import { Applications } from "./Applications.tsx";
import { aggregatorTask, batchTasks, runSearchTasks, type SearchTask, type TaskResult, usaJobsTask } from "./api.ts";
import { extractText, MAX_BYTES, UnsupportedFileError } from "./extract.ts";
import { FiltersPanel } from "./FiltersPanel.tsx";
import { Results } from "./Results.tsx";
import { useTracker } from "./tracker.ts";
import { Upload } from "./Upload.tsx";

export interface TitleOption {
  title: string;
  fit: TitleFit | "custom";
  selected: boolean;
}

export interface SearchState {
  running: boolean;
  done: number;
  total: number;
  jobs: Job[];
  failed: string[];
  /** Employers that ran out of time and returned only some of their matching postings. */
  partial: string[];
  /** Whether federal (USAJOBS) postings are in the results; "disabled" means no API key is configured. */
  federal: "searching" | "included" | "disabled";
  /** Postings are matched to titles when they're fetched, so results only cover the titles selected when the search ran. */
  titles: string[];
}

const initialFilters: Filters = {
  titles: [],
  industries: [],
  broadTitleMatch: true,
  remoteOnly: false,
  location: "",
  yearsOfExperience: null,
  minSalary: null,
  includeUnlistedSalary: true,
};

export function App() {
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [titles, setTitles] = useState<TitleOption[] | null>(null);
  const [filters, setFilters] = useState(initialFilters);
  const [search, setSearch] = useState<SearchState | null>(null);
  // Kept in memory only, for the per-job keyword check.
  const [resumeText, setResumeText] = useState<string | null>(null);
  const { tracker, setStatus, setNotes } = useTracker();
  const abortRef = useRef<AbortController | null>(null);

  async function analyze(file: File) {
    setAnalyzing(true);
    setUploadError(null);
    try {
      if (file.size > MAX_BYTES) throw new Error("That file is over 10 MB.");
      const text = await extractText(file);
      if (!text.trim()) throw new Error("No text found in that file. Is it a scanned image?");
      const result = analyzeResume(text);
      if (result.titles.length === 0) {
        setUploadError("Couldn't recognize any roles in this resume. Add titles yourself below.");
      }
      setResumeText(text);
      setTitles(result.titles.map((t) => ({ ...t, selected: t.fit !== "stretch" })));
      setFilters((f) => ({ ...f, yearsOfExperience: result.yearsOfExperience ?? f.yearsOfExperience }));
      setSearch(null);
    } catch (err) {
      if (err instanceof UnsupportedFileError) setUploadError("Upload a PDF, DOCX, TXT, or MD file.");
      else setUploadError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setAnalyzing(false);
    }
  }

  const selectedTitles = useMemo(() => (titles ?? []).filter((t) => t.selected).map((t) => t.title), [titles]);

  async function runSearch() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // Employers are fetched in batches, matched to the titles on the server.
    // USAJOBS and the remote job sites are searched once per title.
    const tasks = [
      ...batchTasks(selectedTitles),
      ...selectedTitles.map(usaJobsTask),
      ...AGGREGATORS.flatMap((source) => selectedTitles.map((t) => aggregatorTask(source, t))),
    ];
    setSearch({
      running: true,
      done: 0,
      total: tasks.reduce((n, t) => n + t.weight, 0),
      jobs: [],
      failed: [],
      partial: [],
      federal: "searching",
      titles: selectedTitles,
    });

    const onResult = (task: SearchTask, result: TaskResult) =>
      setSearch((s) => {
        if (!s) return s;
        const next = { ...s, done: s.done + task.weight };
        if ("error" in result) {
          next.failed = [...s.failed, ...task.names];
        } else {
          next.jobs = s.jobs.concat(result.jobs);
          if (result.failed.length > 0) next.failed = [...s.failed, ...result.failed];
          if (result.partial.length > 0) next.partial = [...s.partial, ...result.partial];
          if (task.kind === "usajobs") next.federal = result.disabled ? "disabled" : "included";
        }
        return next;
      });

    await runSearchTasks(tasks, onResult, controller.signal);
    if (!controller.signal.aborted) setSearch((s) => s && { ...s, running: false });
  }

  // Filters apply live to whatever has been fetched, so tweaking them after a
  // search doesn't need another round of requests. Titles are different: postings
  // were matched to the searched titles when fetched, so results use those, and
  // the page offers to search again when the selection changes.
  // Per-title searches overlap, and job sites relist employers' own postings,
  // so drop duplicates first, preferring the employer's listing.
  const { matches, stats } = useMemo(() => {
    if (!search) return { matches: [], stats: null };
    return filterJobsWithStats(dedupeJobs(search.jobs), { ...filters, titles: search.titles });
  }, [search, filters]);
  const titlesChanged =
    search !== null &&
    (search.titles.length !== selectedTitles.length || search.titles.some((t) => !selectedTitles.includes(t)));

  return (
    <main className="page">
      <header className="masthead">
        <h1>I Need a Job</h1>
        <p>
          Add your resume, pick the roles you'd take, and search current openings at {COMPANIES.length} employers across{" "}
          {INDUSTRIES.length} industries, plus federal and remote job sites. Your resume is read in your browser and
          never uploaded.
        </p>
      </header>

      <Upload analyzing={analyzing} error={uploadError} onAnalyze={analyze} />

      {titles && (
        <FiltersPanel
          titles={titles}
          onTitlesChange={setTitles}
          filters={filters}
          onFiltersChange={setFilters}
          searching={search?.running ?? false}
          onSearch={runSearch}
          canSearch={selectedTitles.length > 0}
        />
      )}

      {search && stats && (
        <Results
          search={search}
          matches={matches}
          stats={stats}
          tracker={tracker}
          onStatusChange={setStatus}
          resumeText={resumeText}
          titlesChanged={titlesChanged && !search.running}
          onSearchAgain={runSearch}
        />
      )}

      <Applications
        tracker={tracker}
        onStatusChange={(id, status) => {
          const entry = tracker[id];
          if (entry) setStatus(entry.job, status);
        }}
        onNotesChange={setNotes}
      />
    </main>
  );
}
