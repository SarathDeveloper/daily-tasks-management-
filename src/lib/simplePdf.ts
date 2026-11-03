/**
 * Minimal text-only PDF writer (PDF 1.4, Helvetica, A4) so reports can be
 * exported without a PDF library. Text outside Latin-1 is replaced, and the
 * rupee sign becomes "Rs." because the base-14 fonts cannot draw it.
 */
export interface PdfLine {
  text: string;
  size?: number;
  bold?: boolean;
  /** Extra space before the line, in points. */
  gap?: number;
  /** Right-aligned text on the same line, e.g. an amount. */
  right?: string;
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;

function clean(text: string): string {
  return text
    .replace(/₹\s?/g, 'Rs. ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/[^\x20-\x7e]/g, '?');
}

function escape(text: string): string {
  return clean(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Helvetica is roughly half an em wide per character; enough to right-align numbers. */
function approxWidth(text: string, size: number): number {
  return clean(text).length * size * 0.52;
}

export function buildPdf(lines: PdfLine[]): string {
  const pages: string[] = [];
  let ops: string[] = [];
  let y = PAGE_HEIGHT - MARGIN;

  for (const line of lines) {
    const size = line.size ?? 10;
    const advance = size * 1.45 + (line.gap ?? 0);
    if (y - advance < MARGIN) {
      pages.push(ops.join('\n'));
      ops = [];
      y = PAGE_HEIGHT - MARGIN;
    }
    y -= advance;
    const font = line.bold ? 'F2' : 'F1';
    if (line.text) {
      ops.push(`BT /${font} ${size} Tf ${MARGIN} ${y.toFixed(1)} Td (${escape(line.text)}) Tj ET`);
    }
    if (line.right) {
      const x = PAGE_WIDTH - MARGIN - approxWidth(line.right, size);
      ops.push(`BT /${font} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${escape(line.right)}) Tj ET`);
    }
  }
  pages.push(ops.join('\n'));

  // Objects: 1 catalog, 2 pages, 3 regular font, 4 bold font, then page + content pairs.
  const objects: string[] = [];
  const pageIds = pages.map((_, index) => 5 + index * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  pages.forEach((content, index) => {
    const pageId = pageIds[index];
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
    objects[pageId + 1] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  // Everything is ASCII, so string length equals byte offset.
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}
