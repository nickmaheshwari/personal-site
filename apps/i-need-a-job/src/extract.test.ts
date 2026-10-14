import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { docxToText, pdfItemsToText } from "./extract.ts";

describe("docxToText", () => {
  it("reads paragraphs, breaks and entities from word/document.xml", () => {
    const xml =
      "<w:document><w:body><w:p><w:r><w:t>Software Engineer</w:t></w:r></w:p>" +
      '<w:p><w:r><w:t xml:space="preserve">Acme &amp; Co</w:t><w:br/><w:t>Jan 2020 – Present</w:t></w:r></w:p></w:body></w:document>';
    const docx = zipSync({ "word/document.xml": strToU8(xml), "[Content_Types].xml": strToU8("<Types/>") });
    expect(docxToText(docx)).toBe("Software Engineer\nAcme & Co\nJan 2020 – Present\n");
  });
});

describe("pdfItemsToText", () => {
  it("keeps line breaks and skips marked-content items", () => {
    expect(pdfItemsToText([{ str: "Experience", hasEOL: true }, {}, { str: "Engineer" }, { str: " 2020" }])).toBe(
      "Experience\nEngineer 2020",
    );
  });
});
