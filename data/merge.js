// merge.js <toolResultFile1> [file2 ...]
// Reads persisted houseCARL tool-result JSON files (or raw text), parses INFO
// response blocks, and merges into raw_dialogue.json (dedup by formId|responseIndex).
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'raw_dialogue.json');

let data = [];
try { data = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { data = []; }

const seen = new Map();
const out = [];
function pushEntry(formId, idx, editorId, text) {
  if (text == null) return;
  const trimmed = text.trim();
  if (!trimmed) return;
  if (trimmed.startsWith('(unreadable')) return;
  const key = formId + '|' + idx;
  if (seen.has(key)) return;
  seen.set(key, true);
  out.push({ formId, responseIndex: idx, editorId: editorId ?? null, text });
}

// carry over existing (cleaning any prior junk)
for (const e of data) {
  if (!e || typeof e.text !== 'string') continue;
  if (/Responses\[\d\]\.Text\.String =/.test(e.text)) continue;
  pushEntry(e.formId, e.responseIndex, e.editorId, e.text);
}

function extractText(file) {
  const buf = fs.readFileSync(file, 'utf8');
  try {
    const j = JSON.parse(buf);
    if (Array.isArray(j)) {
      // persisted tool-result: [{type:'text', text:'...'}]
      return j.map(x => (x && typeof x.text === 'string') ? x.text : '').join('\n');
    }
  } catch (e) { /* not JSON, treat as raw */ }
  return buf;
}

const reText = /^\s*Responses\[(\d)\]\.Text\.String\s*=\s?(.*)$/;
const reHeadFields = /formid=([0-9A-Fa-f]{6}:[^\s]+)\s+.*?editorid=(\S+)/;
const reHeadSummary = /^\s*([0-9A-Fa-f]{6}:[^\s]+)\s+type=DialogResponses\s+editorid=(\S+)/;

let added = 0;
for (let a = 2; a < process.argv.length; a++) {
  const content = extractText(process.argv[a]);
  const lines = content.split(/\r?\n/);
  let curForm = null, curEid = null;
  for (const line of lines) {
    let h = line.match(reHeadFields);
    if (h) { curForm = h[1]; curEid = (h[2] === '<none>') ? null : h[2]; continue; }
    h = line.match(reHeadSummary);
    if (h) { curForm = h[1]; curEid = (h[2] === '<none>') ? null : h[2]; continue; }
    const m = line.match(reText);
    if (m && curForm) {
      const before = out.length;
      pushEntry(curForm, parseInt(m[1], 10), curEid, m[2]);
      if (out.length > before) added++;
    }
  }
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 0));
console.log('added=' + added + ' total_unique=' + out.length);
