#!/usr/bin/env node
/*
 * translate.js — DeepL batch translator for the FormID -> Japanese lookup table.
 *
 * Reads:
 *   - pipeline/config.local.json : { deepl_api_key, deepl_endpoint, deepl_api_tier,
 *                                    monthly_char_budget }   (LOCAL ONLY, gitignored)
 *   - data/dialogue_en.json      : { "<FORMID6>": "<english>" }  (from consolidate.js)
 *   - sp-plugin/src/translations.json : existing FormID6 -> JA (seed + prior runs; preserved)
 *
 * Writes (incrementally, checkpointed so it is safe to stop/resume, even across months):
 *   - data/translate_progress.json    : { month, charsUsedThisMonth, cache:{en:ja} }
 *   - sp-plugin/src/translations.json : merged FormID6 -> JA, sorted
 *
 * Budget: never sends more than the remaining monthly char budget in one run, and
 * de-duplicates identical english strings so each unique string is paid for once.
 *
 * Usage:
 *   node pipeline/translate.js                 # translate up to remaining monthly budget
 *   node pipeline/translate.js --limit 50000   # cap this run at 50k chars sent
 *   node pipeline/translate.js --batch 40      # texts per DeepL request (default 40, max 50)
 *   DEEPL_MOCK=1 node pipeline/translate.js    # offline dry-run: no network, JA = "【JA】<en>"
 *
 * The real run needs a LIVE DeepL key in config.local.json and consumes quota.
 */
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const CONFIG = path.join(__dirname, 'config.local.json')
const IN = path.join(ROOT, 'data', 'dialogue_en.json')
const PROGRESS = path.join(ROOT, 'data', 'translate_progress.json')
const OUT = path.join(ROOT, 'sp-plugin', 'src', 'translations.json')

const MOCK = process.env.DEEPL_MOCK === '1' || process.argv.includes('--dry')
const arg = (name, def) => {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const BATCH = Math.min(50, Number(arg('--batch', 40)))

function readJson(p, def) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return def }
}
function currentMonth() { return new Date().toISOString().slice(0, 7) } // YYYY-MM
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function deeplBatch(texts, cfg) {
  if (MOCK) return texts.map((t) => `【JA】${t}`)
  const url = (cfg.deepl_endpoint || 'https://api-free.deepl.com/v2/translate')
  const body = new URLSearchParams()
  body.append('target_lang', 'JA')
  body.append('source_lang', 'EN')
  for (const t of texts) body.append('text', t)
  for (let attempt = 0; attempt < 5; attempt++) {
    let res
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${cfg.deepl_api_key}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
    } catch (e) {
      await sleep(1000 * 2 ** attempt); continue
    }
    if (res.status === 429 || res.status >= 500) { await sleep(1000 * 2 ** attempt); continue }
    if (res.status === 456) throw new Error('DeepL quota exceeded (HTTP 456) — monthly budget spent')
    if (!res.ok) throw new Error(`DeepL HTTP ${res.status}: ${await res.text()}`)
    const json = await res.json()
    return json.translations.map((t) => t.text)
  }
  throw new Error('DeepL request failed after retries')
}

async function main() {
  const cfg = MOCK ? {} : readJson(CONFIG, null)
  if (!MOCK && (!cfg || !cfg.deepl_api_key)) {
    console.error('No DeepL key in pipeline/config.local.json. Add the key locally, or use DEEPL_MOCK=1 for a dry run.')
    process.exit(1)
  }
  const monthlyBudget = Number((cfg && cfg.monthly_char_budget) || 480000) // headroom under 500k

  const dialogue = readJson(IN, null)
  if (!dialogue) { console.error(`Missing ${path.relative(process.cwd(), IN)} — run consolidate.js first.`); process.exit(1) }
  const out = readJson(OUT, {})
  const progress = readJson(PROGRESS, { month: currentMonth(), charsUsedThisMonth: 0, cache: {} })

  // Month rollover: budget resets.
  if (progress.month !== currentMonth()) { progress.month = currentMonth(); progress.charsUsedThisMonth = 0 }

  const runLimit = Number(arg('--limit', Infinity))
  let budgetLeft = Math.min(monthlyBudget - progress.charsUsedThisMonth, runLimit)
  if (budgetLeft <= 0) { console.log(`Monthly budget exhausted (${progress.charsUsedThisMonth}/${monthlyBudget} chars used this month). Nothing to do.`); return }

  // Unique english strings still needing translation (skip those already in cache/output).
  const cache = progress.cache
  const needed = new Map() // english -> [formIds]
  for (const [fid, en] of Object.entries(dialogue)) {
    if (out[fid]) continue                 // already have a JA for this formId (seed/prior)
    if (cache[en]) { out[fid] = cache[en]; continue } // known string, just map it
    if (!needed.has(en)) needed.set(en, [])
    needed.get(en).push(fid)
  }
  const pending = [...needed.keys()]
  console.log(`${MOCK ? '[MOCK] ' : ''}unique strings to translate: ${pending.length}; budget left this run: ${budgetLeft} chars`)

  let sent = 0, translated = 0, batch = []
  const flush = async () => {
    if (!batch.length) return
    const jas = await deeplBatch(batch, cfg)
    for (let i = 0; i < batch.length; i++) {
      const en = batch[i], ja = jas[i]
      cache[en] = ja
      for (const fid of needed.get(en)) out[fid] = ja
      translated++
    }
    // Checkpoint after every batch so a crash never loses more than one batch.
    writeAll(out, progress)
    batch = []
  }

  for (const en of pending) {
    if (en.length > budgetLeft) continue // skip strings that would blow the remaining budget
    batch.push(en)
    sent += en.length; budgetLeft -= en.length; progress.charsUsedThisMonth += en.length
    if (batch.length >= BATCH) { await flush() }
    if (budgetLeft <= 0) break
  }
  await flush()

  console.log(`${MOCK ? '[MOCK] ' : ''}done: ${translated} strings translated, ${sent} chars sent this run.`)
  console.log(`month ${progress.month}: ${progress.charsUsedThisMonth}/${monthlyBudget} chars used.`)
  console.log(`translations.json now has ${Object.keys(out).length} entries.`)
}

function writeAll(out, progress) {
  const sorted = {}
  for (const k of Object.keys(out).sort()) sorted[k] = out[k]
  fs.writeFileSync(OUT, JSON.stringify(sorted, null, 2) + '\n')
  fs.writeFileSync(PROGRESS, JSON.stringify(progress, null, 0) + '\n')
}

main().catch((e) => { console.error(String(e && e.message || e)); process.exit(1) })
