import { useMemo, useRef, useState } from "react";
import { COMPANIES, INDUSTRIES } from "../shared/companies.ts";
import { type Filters, filterJobsWithStats } from "../shared/match.ts";
import { analyzeResume } from "../shared/resume.ts";
import type { Job, TitleFit } from "../shared/types.ts";
import { companyTask, runSearchTasks, type SearchTask, type TaskResult, usaJobsTask } from "./api.ts";
import { extractText, MAX_BYTES, UnsupportedFileError } from "./extract.ts";
import { FiltersPanel } from "./FiltersPanel.tsx";
import { Results } from "./Results.tsx";
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
  failed: { company: string; error: string }[];
  /** Whether federal (USAJOBS) postings are in the results; "disabled" means no API key is configured. */
  federal: "searching" | "included" | "disabled";
  /** USAJOBS is searched by title, so it only covers the titles selected when the search ran. */
  federalTitles: string[];
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
    // Company boards return everything (filtered here); USAJOBS is searched per selected title.
    const tasks = [...COMPANIES.map(companyTask), ...selectedTitles.map(usaJobsTask)];
    setSearch({
      running: true,
      done: 0,
      total: tasks.length,
      jobs: [],
      failed: [],
      federal: "searching",
      federalTitles: selectedTitles,
    });

    const onResult = (task: SearchTask, result: TaskResult) =>
      setSearch((s) => {
        if (!s) return s;
        const next = { ...s, done: s.done + 1 };
        if ("error" in result) {
          next.failed = [...s.failed, { company: task.label, error: result.error }];
        } else {
          next.jobs = s.jobs.concat(result.jobs);
          if (task.kind === "usajobs") next.federal = result.disabled ? "disabled" : "included";
        }
        return next;
      });

    await runSearchTasks(tasks, onResult, controller.signal);
    if (!controller.signal.aborted) setSearch((s) => s && { ...s, running: false });
  }

  // Filters apply live to whatever has been fetched, so tweaking them after a
  // search doesn't need another round of requests. USAJOBS results for
  // different titles can overlap, so drop duplicate postings first.
  const { matches, stats } = useMemo(() => {
    if (!search) return { matches: [], stats: null };
    const seen = new Set<string>();
    const unique = search.jobs.filter((j) => !seen.has(j.id) && seen.add(j.id));
    return filterJobsWithStats(unique, { ...filters, titles: selectedTitles });
  }, [search, filters, selectedTitles]);

  return (
    <main className="page">
      <header className="masthead">
        <h1>I Need a Job</h1>
        <p>
          Add your resume, pick the roles you'd take, and search current openings at {COMPANIES.length} companies across{" "}
          {INDUSTRIES.length} industries. Your resume is read in your browser and never uploaded.
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

      {search && stats && <Results search={search} matches={matches} stats={stats} />}
    </main>
  );
}
