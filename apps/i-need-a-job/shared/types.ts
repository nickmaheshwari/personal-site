export type TitleFit = "close" | "related" | "stretch";

export interface TitleSuggestion {
  title: string;
  fit: TitleFit;
}

export interface ResumeAnalysis {
  titles: TitleSuggestion[];
  /** Total years covered by work-history date ranges, or null if none were found. */
  yearsOfExperience: number | null;
}

/** A posting normalized from any job board, stripped of its (large) description. */
export interface Job {
  id: string;
  company: string;
  title: string;
  location: string;
  remote: boolean;
  url: string;
  postedAt: string | null;
  /** Annual salary range in the posting's currency, when the posting lists one. */
  salary: { min: number; max: number; currency: string } | null;
  /** Minimum years of experience the posting asks for, when it states one. */
  minYears: number | null;
}

export interface JobsResponse {
  company: string;
  jobs: Job[];
}
