#!/usr/bin/env node
/*
 * consolidate.js — merge the scattered extraction outputs into one canonical map.
 *
 * Inputs (all under data/):
 *   - raw_dialogue*.json, chunks_c/*.json : arrays of {formId,responseIndex,editorId,text}
 *   - all_formids.txt                     : master list "XXXXXX:Skyrim.esm" (one per line)
 *
 * Output:
 *   - data/dialogue_en.json : { "<FORMID6>": "<combined english>" }
 *       Key   = the 6 hex digits before ':' (upper-case), matching translations.json / the overlay.
 *       Value = the INFO's response lines, ordered by responseIndex, joined with a space.
 *   - prints a coverage + DeepL-budget report (incl. unique-string dedup savings).
 *
 * Pure/offline: no network, no API key. Safe to run anywhere.
 */
'use strict'
const fs = require('fs')
const path = require('path')

const DATA = path.join(__dirname, '..', 'data')
const OUT = path.join(DATA, 'dialogue_en.json')

const key6 = (formId) => String(formId).split(':')[0].trim().toUpperCase()

// Collect every {formId,responseIndex,text} record from all JSON sources.
const records = new Map() // formId6 -> Map(responseIndex -> text)
function ingest(file) {
  let arr
  try { arr = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return }
  if (!Array.isArray(arr)) return
  for (const r of arr) {
    if (!r || !r.formId || typeof r.text !== 'string') continue
    const k = key6(r.formId)
    if (!records.has(k)) records.set(k, new Map())
    const ri = Number.isFinite(r.responseIndex) ? r.responseIndex : 0
    // First writer wins per (formId,responseIndex); sources are duplicates of each other.
    if (!records.get(k).has(ri)) records.get(k).set(ri, r.text)
  }
}

const sources = []
for (const f of fs.readdirSync(DATA)) if (/^raw_dialogue.*\.json$/.test(f)) sources.push(path.join(DATA, f))
const chunksDir = path.join(DATA, 'chunks_c')
if (fs.existsSync(chunksDir)) for (const f of fs.readdirSync(chunksDir)) if (/\.json$/.test(f)) sources.push(path.join(chunksDir, f))
sources.sort().forEach(ingest)

// Build canonical map: responses joined in responseIndex order.
const dialogue = {}
for (const [k, byRi] of records) {
  const text = [...byRi.entries()].sort((a, b) => a[0] - b[0]).map(([, t]) => t.trim()).filter(Boolean).join(' ')
  if (text) dialogue[k] = text
}

// Write sorted for stable diffs.
const sortedKeys = Object.keys(dialogue).sort()
const ordered = {}
for (const k of sortedKeys) ordered[k] = dialogue[k]
fs.writeFileSync(OUT, JSON.stringify(ordered, null, 0) + '\n')

// ---- Report ----
const master = fs.readFileSync(path.join(DATA, 'all_formids.txt'), 'utf8')
  .split(/\r?\n/).filter(Boolean).map(key6)
const masterSet = new Set(master)
const haveText = sortedKeys.filter((k) => masterSet.has(k))
const remaining = [...masterSet].filter((k) => !dialogue[k])

let totalChars = 0
const uniqueStrings = new Map() // english -> count
for (const k of sortedKeys) {
  totalChars += dialogue[k].length
  uniqueStrings.set(dialogue[k], (uniqueStrings.get(dialogue[k]) || 0) + 1)
}
let uniqueChars = 0
for (const s of uniqueStrings.keys()) uniqueChars += s.length

console.log('=== consolidate report ===')
console.log('master formIds            :', masterSet.size)
console.log('formIds with english text :', haveText.length)
console.log('formIds still missing text:', remaining.length)
console.log('wrote                     :', path.relative(process.cwd(), OUT), `(${sortedKeys.length} entries)`)
console.log('--- DeepL budget (extracted portion only) ---')
console.log('chars, all lines          :', totalChars)
console.log('unique english strings    :', uniqueStrings.size)
console.log('chars, unique only        :', uniqueChars, `(dedup saves ${totalChars - uniqueChars} chars, ${(100 * (1 - uniqueChars / totalChars)).toFixed(1)}%)`)
console.log('DeepL Free months (500k/mo, unique):', Math.ceil(uniqueChars / 500000))
