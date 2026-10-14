// Extracts plain text from a resume file entirely in the browser.

import { strFromU8, unzipSync } from "fflate";
import { decodeEntities } from "../shared/normalize.ts";

export const MAX_BYTES = 10 * 1024 * 1024;

export class UnsupportedFileError extends Error {}

/** Joins pdf.js text items, keeping the line breaks that section detection relies on. */
export function pdfItemsToText(items: readonly object[]): string {
  let text = "";
  for (const item of items) {
    // Marked-content items carry no text.
    if (!("str" in item) || typeof item.str !== "string") continue;
    text += item.str;
    if ("hasEOL" in item && item.hasEOL) text += "\n";
  }
  return text;
}

async function pdfToText(data: Uint8Array): Promise<string> {
  // Loaded on demand: pdf.js is large and only needed once a PDF is chosen.
  const [{ getDocument, GlobalWorkerOptions }, { default: workerUrl }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  GlobalWorkerOptions.workerSrc = workerUrl;
  const task = getDocument({ data });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      pages.push(pdfItemsToText(content.items));
    }
    return pages.join("\n");
  } finally {
    await task.destroy();
  }
}

/** A .docx is a zip; the body text lives in word/document.xml as <w:t> runs inside <w:p> paragraphs. */
export function docxToText(data: Uint8Array): string {
  const files = unzipSync(data, { filter: (f) => f.name === "word/document.xml" });
  const xml = files["word/document.xml"];
  if (!xml) throw new UnsupportedFileError();
  return decodeEntities(
    strFromU8(xml)
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:(?:br|cr)\b[^>]*\/>/g, "\n")
      .replace(/<w:tab\b[^>]*\/>/g, "\t")
      .replace(/<[^>]+>/g, ""),
  );
}

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const data = new Uint8Array(await file.arrayBuffer());
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return pdfToText(data);
  if (name.endsWith(".docx")) return docxToText(data);
  if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) return strFromU8(data);
  throw new UnsupportedFileError();
}
