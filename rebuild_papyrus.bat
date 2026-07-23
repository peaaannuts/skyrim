@echo off
REM Recompile JpSubtitle.psc -> JpSubtitle.pex straight into the MO2 mod folder.
REM Run this on the real machine whenever native-plugin/Scripts/Source/JpSubtitle.psc
REM changes (i.e. whenever a native function is added/renamed/retyped). Close the game
REM first so the .pex isn't locked.
REM
REM Notes learned the hard way (2026-07-22):
REM  - houseCARL_compile_script does not exist on this machine; use PapyrusCompiler.exe.
REM  - The flags file TESV_Papyrus_Flags.flg lives under SkyrimVR's VR-layout source
REM    dir: SkyrimVR\Data\Source\Scripts (note "Source\Scripts", not "Scripts\Source").
REM    Without it on the -import path you get "Unknown user flag Hidden".
REM  - -import must also contain JpSubtitle.psc's own folder, or you get
REM    "unable to locate script JpSubtitle".

set COMPILER=C:\Program Files (x86)\Steam\steamapps\common\SkyrimVR\Papyrus Compiler\PapyrusCompiler.exe
set SRC=C:\Modding\SubtitleTranslator\native-plugin\Scripts\Source\JpSubtitle.psc
set OUT=C:\Modding\MO2\mods\jp-subtitle-spike\Scripts
set IMPORT=C:\Modding\SubtitleTranslator\native-plugin\Scripts\Source;C:\Program Files (x86)\Steam\steamapps\common\SkyrimVR\Data\Source\Scripts

"%COMPILER%" "%SRC%" -output="%OUT%" -import="%IMPORT%" -flags="TESV_Papyrus_Flags.flg"

echo.
echo --- Resulting .pex timestamp (should be "now" on success) ---
dir "%OUT%\JpSubtitle.pex" | findstr JpSubtitle.pex
pause
