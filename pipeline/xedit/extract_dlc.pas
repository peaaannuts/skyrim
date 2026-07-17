// extract_dlc.pas - extract INFO response text from the DLC master files.
// Same approach as extract_dialogue.pas (INFO\Responses\Response\NAM1), but instead
// of a FormID list it walks every DIAL topic's INFO children in each DLC plugin.
// ASCII-only, no '{ }' block comments (CP932 parse safety) - see extract_dialogue.pas.
//
// Output: data/extracted_dlc_<Plugin>.jsonl, one JSON object per response line:
//   {"formId":"<LOCAL6>:<Plugin>","responseIndex":N,"editorId":null,"text":"..."}
// consolidate.js already reads extracted_*.jsonl and keys by plugin.
//
// Run: copy to xEdit Edit Scripts, load Skyrim.esm + the 3 DLC masters (the normal
// vanilla load order), right-click any file -> Apply Script -> extract_dlc.
//   - TEST_MODE = True (default): only COUNT INFO records + print a few samples per
//     plugin. No files written. Confirms the DIAL->INFO walk works before bulk dump.
//   - Then TEST_MODE = False: writes the .jsonl files.

unit UserScript;

interface
uses xEditAPI, SysUtils, Classes;

implementation

const
  DATA_DIR = 'C:\Modding\SubtitleTranslator\data\';
  RESPONSE_TEXT_SIGNATURE = 'NAM1';
  TEST_MODE = True;   // set False to actually write the .jsonl files

function JsonEscape(s: string): string;
begin
  Result := StringReplace(s, '\', '\\', [rfReplaceAll]);
  Result := StringReplace(Result, '"', '\"', [rfReplaceAll]);
  Result := StringReplace(Result, #13#10, ' ', [rfReplaceAll]);
  Result := StringReplace(Result, #13, ' ', [rfReplaceAll]);
  Result := StringReplace(Result, #10, ' ', [rfReplaceAll]);
end;

// 6-hex local FormID (strip the load-order byte; DLCs are full ESMs, not ESL).
function LocalHex6(rec: IInterface): string;
var
  local: Cardinal;
begin
  local := GetLoadOrderFormID(rec) and $FFFFFF;
  Result := IntToHex(local, 6);
end;

function FindTextBySignature(e: IInterface; sig: string): string;
var
  i: integer;
  found: string;
begin
  Result := '';
  if not Assigned(e) then Exit;
  if Signature(e) = sig then begin
    Result := GetEditValue(e);
    Exit;
  end;
  for i := 0 to ElementCount(e) - 1 do begin
    found := FindTextBySignature(ElementByIndex(e, i), sig);
    if found <> '' then begin Result := found; Exit; end;
  end;
end;

// Append this INFO's response lines to outLines. Returns lines written.
function DumpInfo(info: IInterface; pluginName: string; outLines: TStringList): integer;
var
  responses, resp: IInterface;
  i: integer;
  txt, hex6: string;
begin
  Result := 0;
  responses := ElementByPath(info, 'Responses');
  if not Assigned(responses) then Exit;
  hex6 := LocalHex6(info);
  for i := 0 to ElementCount(responses) - 1 do begin
    resp := ElementByIndex(responses, i);
    txt := Trim(FindTextBySignature(resp, RESPONSE_TEXT_SIGNATURE));
    if txt = '' then Continue;
    outLines.Add('{"formId":"' + hex6 + ':' + pluginName + '","responseIndex":' +
      IntToStr(i) + ',"editorId":null,"text":"' + JsonEscape(txt) + '"}');
    Inc(Result);
  end;
end;

// Walk every DIAL topic's INFO children in one plugin.
procedure ProcessPlugin(pluginName: string);
var
  f, dialGroup, dial, infoGroup, info: IInterface;
  i, j, infoCount, okLines, sampleShown: integer;
  outLines: TStringList;
begin
  f := FileByName(pluginName);
  if not Assigned(f) then begin
    AddMessage('SKIP ' + pluginName + ': not loaded (add it to the load order).');
    Exit;
  end;
  dialGroup := GroupBySignature(f, 'DIAL');
  if not Assigned(dialGroup) then begin
    AddMessage('SKIP ' + pluginName + ': no DIAL group.');
    Exit;
  end;

  outLines := TStringList.Create;
  infoCount := 0; okLines := 0; sampleShown := 0;
  try
    for i := 0 to ElementCount(dialGroup) - 1 do begin
      dial := ElementByIndex(dialGroup, i);
      if Signature(dial) <> 'DIAL' then Continue;
      infoGroup := ChildGroup(dial);
      if not Assigned(infoGroup) then Continue;
      for j := 0 to ElementCount(infoGroup) - 1 do begin
        info := ElementByIndex(infoGroup, j);
        if Signature(info) <> 'INFO' then Continue;
        Inc(infoCount);
        okLines := okLines + DumpInfo(info, pluginName, outLines);
        if TEST_MODE and (sampleShown < 3) and (outLines.Count > 0) then begin
          AddMessage('  sample: ' + outLines[outLines.Count - 1]);
          Inc(sampleShown);
        end;
      end;
    end;

    if TEST_MODE then
      AddMessage('COUNT ' + pluginName + ': INFO=' + IntToStr(infoCount) +
        ', response lines=' + IntToStr(okLines) + ' (TEST_MODE, no file written)')
    else begin
      outLines.SaveToFile(DATA_DIR + 'extracted_dlc_' + pluginName + '.jsonl');
      AddMessage('DONE ' + pluginName + ': INFO=' + IntToStr(infoCount) +
        ', response lines=' + IntToStr(okLines) + ' -> ' +
        DATA_DIR + 'extracted_dlc_' + pluginName + '.jsonl');
    end;
  finally
    outLines.Free;
  end;
end;

function Initialize: integer;
begin
  Result := 0;
  AddMessage('extract_dlc.pas VERSION 2026-07-18a');
  ProcessPlugin('Dawnguard.esm');
  ProcessPlugin('HearthFires.esm');
  ProcessPlugin('Dragonborn.esm');
  AddMessage('extract_dlc done. If TEST_MODE, set it False and re-run to write files.');
end;

function Finalize: integer;
begin
  Result := 0;
end;

end.
