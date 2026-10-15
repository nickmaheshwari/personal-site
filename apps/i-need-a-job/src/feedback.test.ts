import { afterEach, describe, expect, it, vi } from "vitest";
import { describeError, FEEDBACK_FORM, submitFeedback } from "./feedback.ts";

afterEach(() => vi.unstubAllGlobals());

describe("submitFeedback", () => {
  it("posts the fields to Netlify Forms, url-encoded, under the form's name", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await submitFeedback({ kind: "bug", message: "Upload & search broke", email: "", details: "Page: /x" });

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/x-www-form-urlencoded" });
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({
      "form-name": FEEDBACK_FORM,
      kind: "bug",
      message: "Upload & search broke",
      email: "",
      details: "Page: /x",
    });
  });

  it("throws when Netlify rejects the submission", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );
    await expect(submitFeedback({ kind: "idea", message: "Hi", email: "", details: "" })).rejects.toThrow("error 404");
  });
});

describe("describeError", () => {
  it("keeps the message and the top of the stack", () => {
    const text = describeError(new TypeError("undefined is not a function"));
    expect(text).toContain("TypeError: undefined is not a function");
    expect(text.split("\n").length).toBeLessThanOrEqual(6);
  });

  it("handles things thrown that aren't errors", () => {
    expect(describeError("plain string")).toBe("plain string");
  });
});
