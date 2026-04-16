export const downloadCsvTemplate = (filename, content) => {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + String(content || '')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const copyTextToClipboard = async (content) => {
  await navigator.clipboard.writeText(String(content || ''));
};

export const readTextFromInputSource = async (textValue, fileValue) => {
  if (fileValue) {
    return fileValue.text();
  }
  return String(textValue || '');
};

export const splitCsvRow = (line) => {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
};

export const parseCsvText = (text) =>
  String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitCsvRow);
