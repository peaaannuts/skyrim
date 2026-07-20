import { callNative, on, Input, browser, writeLogs } from 'skyrimPlatform'
import translations from './translations.json'

// Key "<Plugin>|<FORMID6>" (e.g. "Skyrim.esm|055DF8") -> Japanese text. Bundled at
// build time. The plugin qualifier prevents DLC lines from colliding with Skyrim.esm
// lines that share the same low-24-bit FormID.
const table: Record<string, string> = translations as Record<string, string>

function log(msg: string): void {
  writeLogs('jp-subtitle', msg)
}

// The native plugin currently returns the INFO FormID as a signed Int; read it
// unsigned and take the low 6 hex digits. Skyrim.esm is load-index 00, so this is a
// Skyrim.esm-local FormID. NOTE: this cannot see which plugin the line came from, so
// DLC lookups are not yet possible from here — that needs the native side to return
// the plugin name too (planned: GetCurrentDialogueKey returning "<Plugin>|<FORMID6>").
function formIdKey(raw: number): string {
  return ((raw >>> 0) & 0xffffff).toString(16).padStart(6, '0').toUpperCase()
}

// Build the lookup key for a raw FormID from the (Skyrim.esm-only) native call.
function skyrimKey(raw: number): string {
  return 'Skyrim.esm|' + formIdKey(raw)
}

// Escape a string for safe embedding inside the JS source we hand to the CEF browser.
function esc(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
}

// Inject a fixed-position overlay div once. Additive - does not replace the shared
// Skyrim Platform UI page, so it coexists with other mods' browser UI.
let overlayReady = false
function ensureOverlay(): void {
  if (overlayReady) return
  browser.executeJavaScript(`
    if (!document.getElementById('jp-subtitle-overlay')) {
      var d = document.createElement('div');
      d.id = 'jp-subtitle-overlay';
      d.style.position = 'fixed';
      d.style.left = '50%';
      d.style.bottom = '20%';
      d.style.transform = 'translateX(-50%)';
      d.style.maxWidth = '72%';
      d.style.textAlign = 'center';
      d.style.fontFamily = 'sans-serif';
      d.style.fontSize = '24px';
      d.style.lineHeight = '1.3';
      d.style.color = '#ffe9c8';
      d.style.textShadow = '0 0 4px #000, 0 0 8px #000, 0 2px 4px #000';
      d.style.pointerEvents = 'none';
      d.style.zIndex = '99999';
      d.style.display = 'none';
      document.body.appendChild(d);
    }
  `)
  overlayReady = true
}

function showOverlay(text: string): void {
  ensureOverlay()
  browser.executeJavaScript(`
    (function(){
      var d = document.getElementById('jp-subtitle-overlay');
      if (d) { d.innerHTML = '${esc(text)}'; d.style.display = 'block'; }
    })();
  `)
  browser.setVisible(true)
  browser.setFocused(false)
}

function hideOverlay(): void {
  browser.executeJavaScript(`
    (function(){
      var d = document.getElementById('jp-subtitle-overlay');
      if (d) d.style.display = 'none';
    })();
  `)
}

function translateCurrent(): void {
  let raw = 0
  try {
    raw = callNative('JpSubtitle', 'GetCurrentDialogueFormID', undefined) as number
  } catch (e) {
    log(`callNative failed: ${e}`)
    return
  }

  if (!raw) {
    log('no current dialogue FormID (0)')
    showOverlay('<span style="color:#aaa">（今表示中の字幕はありません）</span>')
    return
  }

  const key = skyrimKey(raw)
  const jp = table[key]
  if (jp) {
    log(`hit ${key} -> ${jp}`)
    showOverlay(jp)
  } else {
    log(`miss ${key} (no translation yet)`)
    showOverlay(`<span style="color:#ffb0b0">［${key} の訳は未登録］</span>`)
  }
}

// Hotkey: F10 (DirectX scancode 68). Edge-detect so holding it does not re-fire.
const HOTKEY = 68
const HIDE_KEY = 67 // F9: hide the overlay
let prevShow = false
let prevHide = false
on('update', () => {
  const show = Input.isKeyPressed(HOTKEY)
  if (show && !prevShow) {
    translateCurrent()
  }
  prevShow = show

  const hide = Input.isKeyPressed(HIDE_KEY)
  if (hide && !prevHide) {
    hideOverlay()
  }
  prevHide = hide
})

log('jp-subtitle overlay plugin loaded')
