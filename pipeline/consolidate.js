#!/usr/bin/env node
/*
 * consolidate.js — merge the scattered extraction outputs into one canonical map.
 *
 * Inputs (all under data/):
 *   - raw_dialogue*.json, chunks_c/*.json : arrays of {formId,responseIndex,editorId,text}
 *   - extracted_*.jsonl                   : one {formId,responseIndex,editorId,text} object per line
 *                                            (output of pipeline/xedit/extract_dialogue.pas)
 *   - all_formids.txt                     : master list "XXXXXX:Skyrim.esm" (one per line)
 *
 * Output:
 *   - data/dialogue_en.json : { "<Plugin>|<FORMID6>": "<combined english>" }
 *       Key   = plugin name + '|' + the 6 hex local FormID (upper-case). The plugin
 *               qualifier keeps DLC lines from colliding with Skyrim.esm lines that
 *               share the same low-24-bit FormID. Matches translations.json / overlay.
 *       Value = the INFO's response lines, ordered by responseIndex, joined with a space.
 *   - prints a per-plugin coverage + DeepL-budget report (incl. unique-string dedup).
 *
 * Pure/offline: no network, no API key. Safe to run anywhere.
 */
'use strict'
const fs = require('fs')
const path = require('path')

const DATA = path.join(__dirname, '..', 'data')
const OUT = path.join(DATA, 'dialogue_en.json')

// "055DF8:Skyrim.esm" -> "Skyrim.esm|055DF8". Missing plugin defaults to Skyrim.esm
// (all legacy vanilla data predates the plugin suffix being load-bearing).
function keyOf(formId) {
  const [hex, plugin] = String(formId).split(':')
  const p = (plugin || 'Skyrim.esm').trim()
  return p + '|' + String(hex).trim().toUpperCase()
}
const pluginOf = (key) => key.split('|')[0]

// Collect every {formId,responseIndex,text} record from all JSON/JSONL sources.
const records = new Map() // "Plugin|FORMID6" -> Map(responseIndex -> text)
function ingestRecord(r) {
  if (!r || !r.formId || typeof r.text !== 'string') return
  const k = keyOf(r.formId)
  if (!records.has(k)) records.set(k, new Map())
  const ri = Number.isFinite(r.responseIndex) ? r.responseIndex : 0
  // First writer wins per (formId,responseIndex); sources are duplicates of each other.
  if (!records.get(k).has(ri)) records.get(k).set(ri, r.text)
}
function ingestJson(file) {
  let arr
  try { arr = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return }
  if (!Array.isArray(arr)) return
  arr.forEach(ingestRecord)
}
function ingestJsonl(file) {
  let text
  try { text = fs.readFileSync(file, 'utf8') } catch { return }
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    try { ingestRecord(JSON.parse(line)) } catch { /* skip malformed line */ }
  }
}

const jsonSources = []
const jsonlSources = []
for (const f of fs.readdirSync(DATA)) {
  if (/^raw_dialogue.*\.json$/.test(f)) jsonSources.push(path.join(DATA, f))
  if (/^extracted_.*\.jsonl$/.test(f)) jsonlSources.push(path.join(DATA, f))
}
const chunksDir = path.join(DATA, 'chunks_c')
if (fs.existsSync(chunksDir)) for (const f of fs.readdirSync(chunksDir)) if (/\.json$/.test(f)) jsonSources.push(path.join(chunksDir, f))
jsonSources.sort().forEach(ingestJson)
jsonlSources.sort().forEach(ingestJsonl)

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
// Per-plugin entry counts.
const perPlugin = {}
for (const k of sortedKeys) {
  const p = pluginOf(k)
  perPlugin[p] = (perPlugin[p] || 0) + 1
}

// Skyrim.esm master coverage (all_formids.txt is Skyrim.esm-only).
const masterSet = new Set(
  fs.readFileSync(path.join(DATA, 'all_formids.txt'), 'utf8')
    .split(/\r?\n/).filter(Boolean).map((line) => keyOf(line))
)
const skyrimHave = sortedKeys.filter((k) => pluginOf(k) === 'Skyrim.esm').length
const skyrimMissing = [...masterSet].filter((k) => !dialogue[k]).length

let totalChars = 0
const uniqueStrings = new Map() // english -> count
for (const k of sortedKeys) {
  totalChars += dialogue[k].length
  uniqueStrings.set(dialogue[k], (uniqueStrings.get(dialogue[k]) || 0) + 1)
}
let uniqueChars = 0
for (const s of uniqueStrings.keys()) uniqueChars += s.length

console.log('=== consolidate report ===')
console.log('wrote                     :', path.relative(process.cwd(), OUT), `(${sortedKeys.length} entries)`)
console.log('--- entries per plugin ---')
for (const p of Object.keys(perPlugin).sort()) console.log(`  ${p.padEnd(18)}: ${perPlugin[p]}`)
console.log('--- Skyrim.esm master coverage ---')
console.log('master formIds            :', masterSet.size)
console.log('Skyrim.esm with text      :', skyrimHave)
console.log('Skyrim.esm missing text   :', skyrimMissing)
console.log('--- translation budget (all plugins) ---')
console.log('chars, all lines          :', totalChars)
console.log('unique english strings    :', uniqueStrings.size)
console.log('chars, unique only        :', uniqueChars, `(dedup saves ${totalChars - uniqueChars} chars, ${(100 * (1 - uniqueChars / totalChars)).toFixed(1)}%)`)
console.log('DeepL Free months (500k/mo, unique):', Math.ceil(uniqueChars / 500000))
