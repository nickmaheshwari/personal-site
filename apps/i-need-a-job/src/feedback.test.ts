import { afterEach, describe, expect, it, vi } from "vitest";
import { describeError, FEEDBACK_FORM, submitFeedback } from "./feedback.ts";

afterEach(() => vi.unstubAllGlobals());

describe("submitFeedback", () => {
  it("posts the fields and screenshots to Netlify Forms, multipart, under the form's name", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const screenshots = [
      new File(["a"], "a.png", { type: "image/png" }),
      new File(["b"], "b.jpg", { type: "image/jpeg" }),
    ];
    await submitFeedback({
      kind: "bug",
      message: "Upload & search broke",
      email: "",
      details: "Page: /x",
      screenshots,
    });

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/");
    expect(init.method).toBe("POST");
    expect(init.headers).toBeUndefined();
    const body = init.body as FormData;
    expect(body.get("form-name")).toBe(FEEDBACK_FORM);
    expect(body.get("kind")).toBe("bug");
    expect(body.get("message")).toBe("Upload & search broke");
    expect(body.get("email")).toBe("");
    expect(body.get("details")).toBe("Page: /x");
    expect((body.get("screenshot1") as File).name).toBe("a.png");
    expect((body.get("screenshot2") as File).name).toBe("b.jpg");
    expect(body.has("screenshot3")).toBe(false);
  });

  it("leaves the screenshots out when there aren't any", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await submitFeedback({ kind: "idea", message: "Hi", email: "", details: "", screenshots: [] });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.body as FormData).has("screenshot1")).toBe(false);
  });

  it("throws when Netlify rejects the submission", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );
    await expect(
      submitFeedback({ kind: "idea", message: "Hi", email: "", details: "", screenshots: [] }),
    ).rejects.toThrow("error 404");
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
