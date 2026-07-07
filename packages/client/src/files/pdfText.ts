import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// Pages with fewer extracted characters than this have no meaningful text
// layer — almost certainly a scanned/photographed page rather than a
// genuinely blank one, so flag them instead of silently dropping content.
const MIN_CHARS_PER_PAGE = 20;

export interface PdfExtractionResult {
  text: string;
  scannedPageNumbers: number[];
}

export async function extractTextFromPdf(file: File): Promise<PdfExtractionResult> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const pageTexts: string[] = [];
  const scannedPageNumbers: number[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();

    if (pageText.length < MIN_CHARS_PER_PAGE) {
      scannedPageNumbers.push(pageNumber);
    }
    pageTexts.push(pageText);
  }

  return { text: pageTexts.join("\n\n"), scannedPageNumbers };
}
