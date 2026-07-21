Scriptname JpSubtitle Hidden

; Native functions implemented by jp-subtitle-spike.dll (SKSE plugin).
; This .psc exists so the Papyrus VM knows the "JpSubtitle" type and can route
; calls (including Skyrim Platform's callNative) to the C++ registrations.

; Phase 3a spike: returns 0x12345 (74565) to prove the C++ <-> TS bridge.
Int Function GetTestValue() global native

; Returns "<Plugin>|<FORMID6>" for the INFO record behind the currently-displayed
; subtitle line (e.g. "Skyrim.esm|055DF8", "Dawnguard.esm|001A2B"), or "" if
; nothing translatable is on screen. The plugin qualifier keeps DLC lines from
; colliding with Skyrim.esm lines that share the same low-24-bit FormID.
String Function GetCurrentDialogueKey() global native
