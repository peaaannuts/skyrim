#!/usr/bin/env node
/*
 * translate.js — batch EN->JA translator for the FormID -> Japanese lookup table.
 *
 * Providers (--provider): "deepl" (default) or "azure". Each provider has its OWN
 * monthly free quota, tracked separately, so switching provider mid-month does not
 * make one provider's usage count against the other's budget.
 *
 * Reads:
 *   - pipeline/config.local.json : provider keys + optional budgets  (LOCAL ONLY, gitignored)
 *       DeepL : { deepl_api_key, deepl_endpoint?, deepl_monthly_char_budget? }
 *       Azure : { azure_api_key, azure_region, azure_endpoint?, azure_monthly_char_budget? }
 *       (legacy: monthly_char_budget is still honored as the DeepL budget)
 *   - data/dialogue_en.json      : { "<FORMID6>": "<english>" }  (from consolidate.js)
 *   - sp-plugin/src/translations.json : existing FormID6 -> JA (seed + prior runs; preserved)
 *
 * Writes (incrementally, checkpointed so it is safe to stop/resume, even across months):
 *   - data/translate_progress.json    : { month, used:{deepl,azure}, cache:{en:ja} }
 *   - sp-plugin/src/translations.json : merged FormID6 -> JA, sorted
 *
 * Already-translated strings are skipped, so a new provider only fills the gaps left
 * by previous runs (e.g. finish with Azure what DeepL started).
 *
 * Usage:
 *   node pipeline/translate.js                       # DeepL, up to its remaining monthly budget
 *   node pipeline/translate.js --provider azure      # Azure (2M/mo free), fills remaining lines
 *   node pipeline/translate.js --limit 50000         # cap this run at 50k chars sent
 *   node pipeline/translate.js --batch 40            # texts per request (default 40)
 *   MOCK=1 node pipeline/translate.js                # offline dry-run: no network, JA = "【JA】<en>"
 */
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const CONFIG = path.join(__dirname, 'config.local.json')
const IN = path.join(ROOT, 'data', 'dialogue_en.json')
const PROGRESS = path.join(ROOT, 'data', 'translate_progress.json')
const OUT = path.join(ROOT, 'sp-plugin', 'src', 'translations.json')

const MOCK = process.env.MOCK === '1' || process.env.DEEPL_MOCK === '1' || process.argv.includes('--dry')
const arg = (name, def) => {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const PROVIDER = arg('--provider', 'deepl')
const BATCH = Math.min(50, Number(arg('--batch', 40)))

function readJson(p, def) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return def }
}
function currentMonth() { return new Date().toISOString().slice(0, 7) } // YYYY-MM
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Free-tier monthly caps, with a little headroom under the real limit.
const DEFAULT_BUDGET = { deepl: 480000, azure: 1900000 }

function monthlyBudgetFor(provider, cfg) {
  const perProvider = cfg && cfg[`${provider}_monthly_char_budget`]
  if (perProvider) return Number(perProvider)
  if (provider === 'deepl' && cfg && cfg.monthly_char_budget) return Number(cfg.monthly_char_budget) // legacy
  return DEFAULT_BUDGET[provider] || 480000
}

async function deeplBatch(texts, cfg) {
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

async function azureBatch(texts, cfg) {
  const base = (cfg.azure_endpoint || 'https://api.cognitive.microsofttranslator.com').replace(/\/$/, '')
  const url = `${base}/translate?api-version=3.0&from=en&to=ja`
  const headers = {
    'Ocp-Apim-Subscription-Key': cfg.azure_api_key,
    'Content-Type': 'application/json; charset=UTF-8',
  }
  if (cfg.azure_region) headers['Ocp-Apim-Subscription-Region'] = cfg.azure_region
  const payload = JSON.stringify(texts.map((t) => ({ Text: t })))
  for (let attempt = 0; attempt < 5; attempt++) {
    let res
    try {
      res = await fetch(url, { method: 'POST', headers, body: payload })
    } catch (e) {
      await sleep(1000 * 2 ** attempt); continue
    }
    if (res.status === 429 || res.status >= 500) { await sleep(1000 * 2 ** attempt); continue }
    if (res.status === 403) throw new Error('Azure HTTP 403 — free quota exhausted or key not authorized for this region')
    if (!res.ok) throw new Error(`Azure HTTP ${res.status}: ${await res.text()}`)
    const json = await res.json()
    // json is an array aligned with texts; each has translations[0].text
    return json.map((r) => r.translations[0].text)
  }
  throw new Error('Azure request failed after retries')
}

async function translateBatch(texts, cfg) {
  if (MOCK) return texts.map((t) => `【JA】${t}`)
  if (PROVIDER === 'azure') return azureBatch(texts, cfg)
  return deeplBatch(texts, cfg)
}

function validateConfig(cfg) {
  if (MOCK) return
  if (!cfg) { fail('No pipeline/config.local.json found. Add provider keys locally, or use MOCK=1.') }
  if (PROVIDER === 'deepl' && !cfg.deepl_api_key) fail('No deepl_api_key in config.local.json.')
  if (PROVIDER === 'azure' && !cfg.azure_api_key) fail('No azure_api_key in config.local.json. Also set azure_region.')
}
function fail(msg) { console.error(msg); process.exit(1) }

// Normalize progress to the per-provider shape, migrating the legacy flat counter
// (charsUsedThisMonth, which only ever tracked DeepL) into used.deepl.
function normalizeProgress(p) {
  const prog = p || { month: currentMonth(), used: {}, cache: {} }
  if (!prog.used) prog.used = {}
  if (typeof prog.charsUsedThisMonth === 'number' && prog.used.deepl == null) {
    prog.used.deepl = prog.charsUsedThisMonth
  }
  delete prog.charsUsedThisMonth
  if (!prog.cache) prog.cache = {}
  if (!prog.month) prog.month = currentMonth()
  return prog
}

async function main() {
  const cfg = MOCK ? {} : readJson(CONFIG, null)
  validateConfig(cfg)
  const monthlyBudget = monthlyBudgetFor(PROVIDER, cfg)

  const dialogue = readJson(IN, null)
  if (!dialogue) fail(`Missing ${path.relative(process.cwd(), IN)} — run consolidate.js first.`)
  const out = readJson(OUT, {})
  const progress = normalizeProgress(readJson(PROGRESS, null))

  // Month rollover: every provider's usage resets.
  if (progress.month !== currentMonth()) { progress.month = currentMonth(); progress.used = {} }
  if (progress.used[PROVIDER] == null) progress.used[PROVIDER] = 0

  const runLimit = Number(arg('--limit', Infinity))
  let budgetLeft = Math.min(monthlyBudget - progress.used[PROVIDER], runLimit)
  if (budgetLeft <= 0) {
    console.log(`[${PROVIDER}] monthly budget exhausted (${progress.used[PROVIDER]}/${monthlyBudget} chars used this month). Nothing to do.`)
    return
  }

  // Unique english strings still needing translation (skip those already in cache/output).
  const cache = progress.cache
  const needed = new Map() // english -> [formIds]
  for (const [fid, en] of Object.entries(dialogue)) {
    if (out[fid]) continue                 // already have a JA for this formId (seed/prior)
    if (cache[en]) { out[fid] = cache[en]; continue } // known string, just map it
    if (!needed.has(en)) needed.set(en, [])
    needed.get(en).push(fid)
  }
  // Priority ordering. This mod is on-demand (hotkey when a subtitle can't be read),
  // so within a limited monthly budget we translate the most useful lines first.
  // Strategies (--strategy):
  //   hard  (default): maximize the number of lines that actually need reading help.
  //                    Lines >= HARD_MIN chars first (ascending, so as many as possible
  //                    fit the budget), then shorter lines, stage directions "(...)" last.
  //   long:           substantive conversation first (longest lines first); trivial
  //                    barks come later. Stage directions pushed to the end.
  //   short:          most lines covered (shortest first), stage directions last.
  //   none:           original consolidation order.
  const STRATEGY = arg('--strategy', 'hard')
  const HARD_MIN = Number(arg('--hard-min', 80))
  const isStageDirection = (s) => /^\s*\(.*\)\s*$/.test(s)
  let pending = [...needed.keys()]
  if (STRATEGY === 'hard') {
    pending.sort((a, b) => {
      const sa = isStageDirection(a), sb = isStageDirection(b)
      if (sa !== sb) return sa ? 1 : -1        // stage directions last
      const ha = a.length >= HARD_MIN, hb = b.length >= HARD_MIN
      if (ha !== hb) return ha ? -1 : 1        // hard-to-read lines first
      return ha ? a.length - b.length          // within hard: ascending -> max count
                : b.length - a.length          // within easy: longer (more useful) first
    })
  } else if (STRATEGY === 'long') {
    pending.sort((a, b) => {
      const sa = isStageDirection(a), sb = isStageDirection(b)
      if (sa !== sb) return sa ? 1 : -1        // stage directions last
      return b.length - a.length               // longest substantive dialogue first
    })
  } else if (STRATEGY === 'short') {
    pending.sort((a, b) => {
      const sa = isStageDirection(a), sb = isStageDirection(b)
      if (sa !== sb) return sa ? 1 : -1
      return a.length - b.length               // most lines covered
    })
  }
  console.log(`${MOCK ? '[MOCK] ' : ''}provider: ${PROVIDER}; strategy: ${STRATEGY}; unique strings to translate: ${pending.length}; budget left this run: ${budgetLeft} chars`)

  let sent = 0, translated = 0, batch = []
  const flush = async () => {
    if (!batch.length) return
    const jas = await translateBatch(batch, cfg)
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
    sent += en.length; budgetLeft -= en.length; progress.used[PROVIDER] += en.length
    if (batch.length >= BATCH) { await flush() }
    if (budgetLeft <= 0) break
  }
  await flush()

  console.log(`${MOCK ? '[MOCK] ' : ''}done: ${translated} strings translated, ${sent} chars sent this run.`)
  console.log(`[${PROVIDER}] month ${progress.month}: ${progress.used[PROVIDER]}/${monthlyBudget} chars used.`)
  console.log(`translations.json now has ${Object.keys(out).length} entries.`)
}

function writeAll(out, progress) {
  const sorted = {}
  for (const k of Object.keys(out).sort()) sorted[k] = out[k]
  fs.writeFileSync(OUT, JSON.stringify(sorted, null, 2) + '\n')
  fs.writeFileSync(PROGRESS, JSON.stringify(progress, null, 0) + '\n')
}

main().catch((e) => { console.error(String(e && e.message || e)); process.exit(1) })
