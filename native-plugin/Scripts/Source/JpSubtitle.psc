Scriptname JpSubtitle Hidden

; Native functions implemented by jp-subtitle-spike.dll (SKSE plugin).
; This .psc exists so the Papyrus VM knows the "JpSubtitle" type and can route
; calls (including Skyrim Platform's callNative) to the C++ registrations.

; Phase 3a spike: returns 0x12345 (74565) to prove the C++ <-> TS bridge.
Int Function GetTestValue() global native

; Returns the FormID (as Int, read unsigned) of the INFO record for the
; currently-displayed subtitle line, or 0 if nothing translatable is on screen.
Int Function GetCurrentDialogueFormID() global native
