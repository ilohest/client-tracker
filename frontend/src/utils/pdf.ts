const escapePdfText = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const wrapLine = (line: string, maxChars: number): string[] => {
  if (line.length <= maxChars) return [line];

  const words = line.split(' ');
  const result: string[] = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      return;
    }

    if (current) result.push(current);
    current = word;
  });

  if (current) result.push(current);
  return result;
};

export const downloadPdfFromLines = (fileName: string, lines: string[]): void => {
  const pageHeight = 842;
  const marginX = 50;
  const top = 790;
  const lineHeight = 16;
  const maxChars = 92;
  const wrappedLines = lines.flatMap((line) => wrapLine(line || ' ', maxChars));
  const pageSize = Math.max(1, Math.floor((pageHeight - 110) / lineHeight));

  const pages: string[][] = [];
  for (let index = 0; index < wrappedLines.length; index += pageSize) {
    pages.push(wrappedLines.slice(index, index + pageSize));
  }

  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Count 0 /Kids [] >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  pages.forEach((pageLines) => {
    const contentStream = [
      'BT',
      '/F1 11 Tf',
      `${marginX} ${top} Td`,
      ...pageLines.map((line, index) =>
        index === 0 ? `(${escapePdfText(line)}) Tj` : `T* (${escapePdfText(line)}) Tj`,
      ),
      'ET',
    ].join('\n');

    contentObjectIds.push(objects.length + 1);
    objects.push(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);

    pageObjectIds.push(objects.length + 1);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${
        contentObjectIds[contentObjectIds.length - 1]
      } 0 R >>`,
    );
  });

  objects[1] = `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] >>`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

