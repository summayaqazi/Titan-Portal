// Escapes a single CSV cell: quotes values containing commas/quotes/newlines,
// and neutralizes leading =+-@ so spreadsheet apps don't treat it as a formula.
function escapeCell(value) {
  let str = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// rows: array of plain objects. columns: [{ key, header }]
function buildCsv(columns, rows) {
  const header = columns.map((c) => escapeCell(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCell(row[c.key])).join(','));
  return [header, ...lines].join('\r\n');
}

function sendCsv(res, filename, columns, rows) {
  const csv = buildCsv(columns, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

module.exports = { buildCsv, sendCsv };
