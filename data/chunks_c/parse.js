// Parses a houseCARL batch_record_detail text dump into JSON entries.
// Usage: node parse.js <input.txt> <output_partial.json>
const fs = require('fs');

const inFile = process.argv[2];
const outFile = process.argv[3];

const text = fs.readFileSync(inFile, 'utf8');
const lines = text.split(/\r?\n/);

const entries = [];
let currentFormId = null;

const respRe = /^\s*Responses\[(\d)\]\.Text\.String\s=\s(.*)$/;
const formidRe = /^type=\S+\s+formid=(\S+)\s+editorid=(\S+)/;

for (const line of lines) {
  const fm = line.match(formidRe);
  if (fm) {
    currentFormId = fm[1];
    continue;
  }
  const rm = line.match(respRe);
  if (rm && currentFormId) {
    const idx = parseInt(rm[1], 10);
    let val = rm[2];
    if (val.startsWith('(unreadable:')) continue;
    if (val.trim() === '') continue;
    if (val === '<none>' || val === 'None') continue;
    entries.push({ formId: currentFormId, responseIndex: idx, editorId: null, text: val });
  }
}

fs.writeFileSync(outFile, JSON.stringify(entries, null, 0));
console.error(`Parsed ${entries.length} entries from ${inFile}`);
