import { PDFParse, PasswordException, InvalidPDFException } from 'pdf-parse';

// ─────────────────────────────────────────────────────────────────────────────
// PDF Text Extraction Service (Phase 8.5)
//
// Extracts readable text from an in-memory PDF buffer so Source Analysis can run
// on real document content. extractPdf() NEVER throws — every failure mode
// (empty, oversized, not-a-PDF, password-protected, scanned/image-only) resolves
// to { status: 'failed', error } with a clean user-facing message, so adding a
// PDF source never crashes.
//
// Security: PDF only (magic-byte checked), size-capped, no JS execution
// (isEvalSupported: false), password-protected PDFs fail gracefully. The buffer
// is processed in memory — nothing is written to disk, so there are no file-path
// concerns.
// ─────────────────────────────────────────────────────────────────────────────

export interface PdfExtractionResult {
  status: 'success' | 'failed';
  title?: string;
  text?: string;
  error?: string; // safe, user-friendly
}

const MAX_FILE_SIZE_BYTES = parseInt(process.env.MAX_FILE_SIZE_BYTES ?? '10485760', 10);
// Below this many characters, treat as failed (scanned/image-only PDFs yield ~0).
const MIN_PDF_CHARS = 50;

function cleanText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export async function extractPdf(buffer: Buffer, fileName: string): Promise<PdfExtractionResult> {
  if (buffer.length === 0) {
    return { status: 'failed', error: 'The PDF file appears to be empty.' };
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return { status: 'failed', error: 'This PDF is too large to analyze.' };
  }
  // Magic-byte guard: real PDFs start with "%PDF-".
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return { status: 'failed', error: 'This file does not look like a valid PDF.' };
  }

  let parser: PDFParse | null = null;
  try {
    parser = new PDFParse({
      data: new Uint8Array(buffer),
      isEvalSupported: false, // do not evaluate PDF functions as JS
      useSystemFonts: false,
    });

    const textResult = await parser.getText();
    const text = cleanText(textResult.text ?? '');

    let title: string | undefined;
    try {
      const info = await parser.getInfo();
      const t = info?.info?.Title;
      if (typeof t === 'string' && t.trim()) title = t.trim();
    } catch {
      // Metadata is optional — ignore and fall back to the filename.
    }
    if (!title) title = fileName;

    if (text.length < MIN_PDF_CHARS) {
      return {
        status: 'failed',
        error: 'We could not extract readable text from this PDF (it may be scanned or image-only).',
      };
    }

    return { status: 'success', title, text };
  } catch (err) {
    let error = 'We could not read this PDF.';
    if (err instanceof PasswordException) {
      error = 'This PDF is password-protected and cannot be analyzed.';
    } else if (err instanceof InvalidPDFException) {
      error = 'This file does not look like a valid PDF.';
    }
    console.warn(`[pdfExtraction] extraction failed for "${fileName}": ${error}`);
    return { status: 'failed', error };
  } finally {
    if (parser) {
      try { await parser.destroy(); } catch { /* best-effort cleanup */ }
    }
  }
}
