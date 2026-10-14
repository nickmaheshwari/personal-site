import { useMemo, useRef, useState } from "react";
import { COMPANIES, type Company, INDUSTRIES } from "../shared/companies.ts";
import { type Filters, filterJobs } from "../shared/match.ts";
import { analyzeResume } from "../shared/resume.ts";
import type { Job, TitleFit } from "../shared/types.ts";
import { fetchAllJobs } from "./api.ts";
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
  jobs: Job[];
  failed: { company: string; error: string }[];
}

const initialFilters: Filters = {
  titles: [],
  industries: [],
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

  async function runSearch() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearch({ running: true, done: 0, jobs: [], failed: [] });

    const onResult = (company: Company, result: { jobs: Job[] } | { error: string }) =>
      setSearch(
        (s) =>
          s && {
            ...s,
            done: s.done + 1,
            jobs: "jobs" in result ? s.jobs.concat(result.jobs) : s.jobs,
            failed: "error" in result ? [...s.failed, { company: company.name, error: result.error }] : s.failed,
          },
      );

    await fetchAllJobs(COMPANIES, onResult, controller.signal);
    if (!controller.signal.aborted) setSearch((s) => s && { ...s, running: false });
  }

  const selectedTitles = useMemo(() => (titles ?? []).filter((t) => t.selected).map((t) => t.title), [titles]);

  // Filters apply live to whatever has been fetched, so tweaking them after a
  // search doesn't need another round of requests.
  const matches = useMemo(
    () => (search ? filterJobs(search.jobs, { ...filters, titles: selectedTitles }) : []),
    [search, filters, selectedTitles],
  );

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

      {search && <Results search={search} total={COMPANIES.length} matches={matches} />}
    </main>
  );
}
