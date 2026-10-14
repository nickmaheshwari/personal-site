import { type FormEvent, useState } from "react";
import { INDUSTRIES, type Industry } from "../shared/companies.ts";
import { LOCATIONS } from "../shared/locations.ts";
import type { Filters } from "../shared/match.ts";
import type { TitleOption } from "./App.tsx";

interface Props {
  titles: TitleOption[];
  onTitlesChange: (titles: TitleOption[]) => void;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  searching: boolean;
  canSearch: boolean;
  onSearch: () => void;
}

const GROUPS: { fit: TitleOption["fit"]; label: string }[] = [
  { fit: "close", label: "Closest fit" },
  { fit: "related", label: "Related" },
  { fit: "stretch", label: "Stretch" },
  { fit: "custom", label: "Added by you" },
];

const parseNumber = (value: string): number | null => {
  const n = Number(value);
  return value.trim() === "" || !Number.isFinite(n) || n < 0 ? null : n;
};

export function FiltersPanel({
  titles,
  onTitlesChange,
  filters,
  onFiltersChange,
  searching,
  canSearch,
  onSearch,
}: Props) {
  const [custom, setCustom] = useState("");
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onFiltersChange({ ...filters, [key]: value });

  const toggle = (title: string) =>
    onTitlesChange(titles.map((t) => (t.title === title ? { ...t, selected: !t.selected } : t)));
  const setAll = (selected: boolean) => onTitlesChange(titles.map((t) => ({ ...t, selected })));

  function addCustom(e: FormEvent) {
    e.preventDefault();
    const title = custom.trim();
    if (!title) return;
    if (!titles.some((t) => t.title.toLowerCase() === title.toLowerCase())) {
      onTitlesChange([...titles, { title, fit: "custom", selected: true }]);
    }
    setCustom("");
  }

  return (
    <section className="card">
      <h2>
        <span className="step">2</span> Roles and filters
      </h2>

      <div className="title-toolbar">
        <span>{titles.filter((t) => t.selected).length} selected</span>
        <button type="button" className="link" onClick={() => setAll(true)}>
          Select all
        </button>
        <button type="button" className="link" onClick={() => setAll(false)}>
          Clear
        </button>
      </div>

      {GROUPS.map(({ fit, label }) => {
        const group = titles.filter((t) => t.fit === fit);
        if (group.length === 0) return null;
        return (
          <div key={fit} className="title-group">
            <h3>{label}</h3>
            <div className="chips">
              {group.map((t) => (
                <button
                  key={t.title}
                  type="button"
                  className={`chip${t.selected ? " selected" : ""}`}
                  aria-pressed={t.selected}
                  onClick={() => toggle(t.title)}
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <form className="add-title" onSubmit={addCustom}>
        <input
          type="text"
          placeholder="Add another title…"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          maxLength={80}
        />
        <button type="submit" disabled={!custom.trim()}>
          Add
        </button>
      </form>

      <div className="title-group">
        <h3>Industries {filters.industries.length === 0 && <span className="hint">(all)</span>}</h3>
        <div className="chips">
          {INDUSTRIES.map((industry) => {
            const on = filters.industries.includes(industry);
            const toggleIndustry = (i: Industry) =>
              set("industries", on ? filters.industries.filter((x) => x !== i) : [...filters.industries, i]);
            return (
              <button
                key={industry}
                type="button"
                className={`chip${on ? " selected" : ""}`}
                aria-pressed={on}
                onClick={() => toggleIndustry(industry)}
              >
                {industry}
              </button>
            );
          })}
        </div>
      </div>

      <div className="filters">
        <label className="field checkbox">
          <input type="checkbox" checked={filters.remoteOnly} onChange={(e) => set("remoteOnly", e.target.checked)} />
          <span>Remote only</span>
        </label>

        <label className="field checkbox">
          <input
            type="checkbox"
            checked={filters.broadTitleMatch}
            onChange={(e) => set("broadTitleMatch", e.target.checked)}
          />
          <span title='Long titles also match close variants, e.g. "Health and Wellness Coordinator" finds "Wellness Program Coordinator".'>
            Broader title matching
          </span>
        </label>

        <label className="field">
          <span>Location</span>
          <select value={filters.location} onChange={(e) => set("location", e.target.value)}>
            <option value="">Anywhere</option>
            {LOCATIONS.map((l) => (
              <option key={l.label} value={l.label}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Years of experience</span>
          <input
            type="number"
            min={0}
            max={50}
            value={filters.yearsOfExperience ?? ""}
            onChange={(e) => set("yearsOfExperience", parseNumber(e.target.value))}
          />
        </label>

        <label className="field">
          <span>Minimum salary (USD)</span>
          <input
            type="number"
            min={0}
            step={10000}
            placeholder="e.g. 150000"
            value={filters.minSalary ?? ""}
            onChange={(e) => set("minSalary", parseNumber(e.target.value))}
          />
        </label>

        {filters.minSalary !== null && (
          <label className="field checkbox">
            <input
              type="checkbox"
              checked={filters.includeUnlistedSalary}
              onChange={(e) => set("includeUnlistedSalary", e.target.checked)}
            />
            <span>Include postings without a listed salary</span>
          </label>
        )}
      </div>

      <div className="actions">
        <button type="button" className="primary" disabled={!canSearch || searching} onClick={onSearch}>
          {searching ? "Searching…" : "Search for matching jobs"}
        </button>
      </div>
    </section>
  );
}
