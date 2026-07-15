// extract_dialogue.pas - batch INFO-record English text extractor for SSEEdit.
// ASCII-only on purpose: xEdit's script parser can be read with a Japanese (CP932)
// codepage, and a multibyte comment char containing byte 0x7D ('}') can close a
// '{ }' block comment early and break parsing. So: no '{ }' blocks, no non-ASCII.
// Full Japanese notes live in pipeline/README.md.
//
// Run order:
//   1. TEST_MODE = True (default): self-checks 055DF8 and 093131 against known text.
//      Apply the script; look for "PASS 055DF8" and "PASS 093131" in the log.
//   2. If both PASS, set TEST_MODE = False, then run once for each BATCH_INDEX 0,1,2.
//      Each run reads data/formid_remaining_<N>.txt and writes data/extracted_<N>.jsonl.

unit UserScript;

interface
uses xEditAPI, SysUtils, Classes;

implementation

const
  DATA_DIR = 'C:\Modding\SubtitleTranslator\data\';
  RESPONSE_TEXT_SIGNATURE = 'NAM1'; // confirmed via probe: INFO\Responses\Response\NAM1
  TEST_MODE = True;                 // set False for a real batch run
  BATCH_INDEX = 0;                  // when TEST_MODE=False: run for 0, then 1, then 2

function JsonEscape(s: string): string;
begin
  Result := StringReplace(s, '\', '\\', [rfReplaceAll]);
  Result := StringReplace(Result, '"', '\"', [rfReplaceAll]);
  Result := StringReplace(Result, #13#10, ' ', [rfReplaceAll]);
  Result := StringReplace(Result, #13, ' ', [rfReplaceAll]);
  Result := StringReplace(Result, #10, ' ', [rfReplaceAll]);
end;

// Depth-first search for the first descendant with the given signature; returns
// its edit value, or '' if none is found.
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
    if found <> '' then begin
      Result := found;
      Exit;
    end;
  end;
end;

// Writes each response line of one INFO record into outLines as a JSONL object.
// Returns the number of lines written.
function DumpInfo(info: IInterface; formIdHex: string; outLines: TStringList): integer;
var
  responses, resp: IInterface;
  i: integer;
  txt: string;
begin
  Result := 0;
  responses := ElementByPath(info, 'Responses');
  if not Assigned(responses) then Exit;
  for i := 0 to ElementCount(responses) - 1 do begin
    resp := ElementByIndex(responses, i);
    txt := Trim(FindTextBySignature(resp, RESPONSE_TEXT_SIGNATURE));
    if txt = '' then Continue;
    outLines.Add('{"formId":"' + formIdHex + ':Skyrim.esm","responseIndex":' +
      IntToStr(i) + ',"editorId":null,"text":"' + JsonEscape(txt) + '"}');
    Inc(Result);
  end;
end;

// Resolves one FormID and extracts it. Returns '' on success, else an error tag.
function RunOne(skyrim: IInterface; formIdHex: string; outLines: TStringList): string;
var
  fid: Cardinal;
  rec: IInterface;
  n: integer;
begin
  Result := '';
  fid := StrToInt('$' + formIdHex);
  rec := RecordByFormID(skyrim, fid, False);
  if not Assigned(rec) then begin
    Result := 'NOT FOUND';
    Exit;
  end;
  if Signature(rec) <> 'INFO' then begin
    Result := 'NOT INFO (got ' + Signature(rec) + ')';
    Exit;
  end;
  n := DumpInfo(rec, formIdHex, outLines);
  if n = 0 then Result := 'INFO found but 0 response lines (path/signature mismatch?)';
end;

procedure RunTestMode(skyrim: IInterface);
var
  formids, expects: TStringList;
  i: integer;
  outLines: TStringList;
  status, lastLine: string;
begin
  formids := TStringList.Create;
  expects := TStringList.Create;
  outLines := TStringList.Create;
  try
    formids.Add('055DF8'); expects.Add('No doubt he thought');
    formids.Add('093131'); expects.Add('With good planning');
    AddMessage('=== TEST_MODE: checking ' + IntToStr(formids.Count) + ' known FormIDs ===');
    for i := 0 to formids.Count - 1 do begin
      outLines.Clear;
      status := RunOne(skyrim, formids[i], outLines);
      if status <> '' then begin
        AddMessage('FAIL ' + formids[i] + ': ' + status);
        Continue;
      end;
      lastLine := outLines.Text;
      if Pos(expects[i], lastLine) > 0 then
        AddMessage('PASS ' + formids[i] + ': ' + lastLine)
      else
        AddMessage('FAIL ' + formids[i] + ': got "' + lastLine +
          '", expected to contain "' + expects[i] + '"');
    end;
    AddMessage('=== TEST_MODE done. If both PASS, set TEST_MODE=False and run per batch. ===');
  finally
    formids.Free;
    expects.Free;
    outLines.Free;
  end;
end;

procedure RunBatch(skyrim: IInterface; batchIndex: integer);
var
  inList, outLines: TStringList;
  i, colonPos: integer;
  line, hexPart, status: string;
  notFound, notInfo, emptyResp, okCount: integer;
begin
  inList := TStringList.Create;
  outLines := TStringList.Create;
  notFound := 0; notInfo := 0; emptyResp := 0; okCount := 0;
  try
    inList.LoadFromFile(DATA_DIR + 'formid_remaining_' + IntToStr(batchIndex) + '.txt');
    AddMessage('Loaded ' + IntToStr(inList.Count) + ' FormIDs from batch ' + IntToStr(batchIndex));
    for i := 0 to inList.Count - 1 do begin
      line := Trim(inList[i]);
      if line = '' then Continue;
      colonPos := Pos(':', line);
      if colonPos <= 0 then Continue;
      hexPart := Copy(line, 1, colonPos - 1);

      status := RunOne(skyrim, hexPart, outLines);
      if status = 'NOT FOUND' then Inc(notFound)
      else if Pos('NOT INFO', status) = 1 then Inc(notInfo)
      else if status <> '' then Inc(emptyResp)
      else Inc(okCount);

      if (i mod 1000) = 0 then
        AddMessage('progress: ' + IntToStr(i) + '/' + IntToStr(inList.Count) +
          ' (ok=' + IntToStr(okCount) + ', notFound=' + IntToStr(notFound) +
          ', notInfo=' + IntToStr(notInfo) + ', empty=' + IntToStr(emptyResp) + ')');
    end;
    outLines.SaveToFile(DATA_DIR + 'extracted_' + IntToStr(batchIndex) + '.jsonl');
    AddMessage('DONE batch ' + IntToStr(batchIndex) + ': ok=' + IntToStr(okCount) +
      ' notFound=' + IntToStr(notFound) + ' notInfo=' + IntToStr(notInfo) +
      ' emptyResp=' + IntToStr(emptyResp) + ' -> ' +
      DATA_DIR + 'extracted_' + IntToStr(batchIndex) + '.jsonl');
  finally
    inList.Free;
    outLines.Free;
  end;
end;

function Initialize: integer;
var
  skyrim: IInterface;
begin
  Result := 0;
  // Version banner: if you do NOT see this line in the log, xEdit is running an
  // OLD copy. Copy this file into <xEdit install>\Edit Scripts\ and re-apply.
  AddMessage('extract_dialogue.pas VERSION 2026-07-15d');
  skyrim := FileByName('Skyrim.esm');
  if not Assigned(skyrim) then begin
    AddMessage('ERROR: Skyrim.esm not loaded. Load only Skyrim.esm and retry.');
    Exit;
  end;
  if TEST_MODE then
    RunTestMode(skyrim)
  else
    RunBatch(skyrim, BATCH_INDEX);
end;

function Finalize: integer;
begin
  Result := 0;
end;

end.
