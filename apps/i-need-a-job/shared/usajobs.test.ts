import { describe, expect, it } from "vitest";
import { normalizeUsaJobs } from "./usajobs.ts";

describe("normalizeUsaJobs", () => {
  it("maps the documented search response fields", () => {
    const [job, hourly] = normalizeUsaJobs({
      SearchResult: {
        SearchResultItems: [
          {
            MatchedObjectId: "123",
            MatchedObjectDescriptor: {
              PositionTitle: "Health Educator ",
              PositionURI: "https://www.usajobs.gov/job/123",
              PositionLocationDisplay: "Anywhere in the U.S. (remote job)",
              OrganizationName: "Indian Health Service",
              DepartmentName: "Department of Health and Human Services",
              PublicationStartDate: "2026-10-01",
              PositionRemuneration: [{ MinimumRange: "61111", MaximumRange: "79443", RateIntervalCode: "PA" }],
            },
          },
          {
            MatchedObjectId: "456",
            MatchedObjectDescriptor: {
              PositionTitle: "Recreation Aid",
              PositionURI: "https://www.usajobs.gov/job/456",
              PositionLocationDisplay: "Denver, Colorado",
              PositionRemuneration: [{ MinimumRange: "18.50", MaximumRange: "21.00", RateIntervalCode: "PH" }],
            },
          },
        ],
      },
    });
    expect(job).toMatchObject({
      id: "usajobs:123",
      company: "Indian Health Service",
      title: "Health Educator",
      remote: true,
      salary: { min: 61111, max: 79443, currency: "USD" },
      industry: "Nonprofit & Government",
    });
    expect(hourly).toMatchObject({ company: "U.S. Federal Government", remote: false, salary: null });
  });

  it("handles an empty response", () => {
    expect(normalizeUsaJobs({})).toEqual([]);
  });
});
