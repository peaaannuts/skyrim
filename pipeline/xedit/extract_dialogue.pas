{
  extract_dialogue.pas — batch INFO-record English text extractor.

  【必ず probe_info.pas を先に実機で実行し、Responses/NAM1 の構造を目視確認してから
   このスクリプトを回すこと】。未検証のまま26,597件を回すと、誤ったパスで空データを
   大量生成するリスクがある。

  仕組み:
    - data/formid_remaining_0/1/2.txt（"XXXXXX:Skyrim.esm" 形式、1行1FormID）を読み、
      Skyrim.esm から RecordByFormID で直接該当 INFO レコードを引く
      （プラグイン全走査はしない＝高速・対象を絞れる）。
    - 各 INFO の Responses 配列を responseIndex 順に走査し、応答テキストを取り出す。
    - 出力は JSONL（1行1オブジェクト）。既存の consolidate.js が読める形式に合わせてある
      （consolidate.js 側で .jsonl 対応済み）。

  使い方:
    1. probe_info.pas で構造確認を終えていること（RESPONSE_TEXT_SIGNATURE が
       'NAM1' で合っていたか確認済みであること。違えばここで書き換える）。
    2. まず TEST_MODE := True のまま実行 → 既知の2件（055DF8, 093131）で
       期待テキストと一致するか自己チェックログを確認。
       一致しなければ本番実行しない。RESPONSE_TEXT_SIGNATURE を見直す。
    3. TEST_MODE := False にし、BATCH_INDEX を 0 → 1 → 2 と変えて3回実行
       （data/formid_remaining_0.txt → data/extracted_0.jsonl、以下同様）。
    4. 実行後、Linux側にファイルを持ってきてもらい consolidate.js を再実行。
}
unit UserScript;

interface
uses xEditAPI, SysUtils, Classes;

implementation

const
  DATA_DIR = 'C:\Modding\SubtitleTranslator\data\';
  RESPONSE_TEXT_SIGNATURE = 'NAM1'; // probe_info.pas の結果を見て要調整

  // ---- ここを実行のたびに編集する ----
  TEST_MODE = True;   // まず True で既知2件の自己チェック。OKなら False にして本番。
  BATCH_INDEX = 0;     // TEST_MODE=False のとき: 0, 1, 2 の3回実行する
  // -------------------------------------

type
  TKnownCase = record
    formIdHex: string;
    expectedSubstring: string;
  end;

const
  KNOWN_CASES: array[0..1] of TKnownCase = (
    (formIdHex: '055DF8'; expectedSubstring: 'No doubt he thought'),
    (formIdHex: '093131'; expectedSubstring: 'With good planning')
  );

function JsonEscape(s: string): string;
begin
  Result := StringReplace(s, '\', '\\', [rfReplaceAll]);
  Result := StringReplace(Result, '"', '\"', [rfReplaceAll]);
  Result := StringReplace(Result, #13#10, ' ', [rfReplaceAll]);
  Result := StringReplace(Result, #13, ' ', [rfReplaceAll]);
  Result := StringReplace(Result, #10, ' ', [rfReplaceAll]);
end;

// Depth-first search for the first descendant whose signature matches sig,
// returning its edit value. Defensive against exact-path differences between
// xEdit versions — probe_info.pas should have confirmed the signature already.
function FindTextBySignature(e: IInterface; const sig: string): string;
var
  i: integer;
  child: IInterface;
  found: string;
begin
  Result := '';
  if not Assigned(e) then Exit;
  if Signature(e) = sig then begin
    Result := GetEditValue(e);
    Exit;
  end;
  for i := 0 to ElementCount(e) - 1 do begin
    child := ElementByIndex(e, i);
    found := FindTextBySignature(child, sig);
    if found <> '' then begin
      Result := found;
      Exit;
    end;
  end;
end;

// Extracts every response line of one INFO record into outLines as JSONL entries.
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
    outLines.Add(Format(
      '{"formId":"%s:Skyrim.esm","responseIndex":%d,"editorId":null,"text":"%s"}',
      [formIdHex, i, JsonEscape(txt)]));
    Inc(Result);
  end;
end;

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
  if n = 0 then Result := 'INFO found but 0 response lines extracted (path/signature mismatch?)';
end;

procedure RunTestMode(skyrim: IInterface);
var
  i: integer;
  outLines: TStringList;
  status, lastLine: string;
  pass: boolean;
begin
  AddMessage('=== TEST_MODE: checking ' + IntToStr(Length(KNOWN_CASES)) + ' known FormIDs ===');
  outLines := TStringList.Create;
  try
    for i := 0 to High(KNOWN_CASES) do begin
      outLines.Clear;
      status := RunOne(skyrim, KNOWN_CASES[i].formIdHex, outLines);
      if status <> '' then begin
        AddMessage('FAIL ' + KNOWN_CASES[i].formIdHex + ': ' + status);
        Continue;
      end;
      lastLine := outLines.Text;
      pass := Pos(KNOWN_CASES[i].expectedSubstring, lastLine) > 0;
      if pass then
        AddMessage('PASS ' + KNOWN_CASES[i].formIdHex + ': ' + lastLine)
      else
        AddMessage('FAIL ' + KNOWN_CASES[i].formIdHex + ': got "' + lastLine +
          '", expected to contain "' + KNOWN_CASES[i].expectedSubstring + '"');
    end;
  finally
    outLines.Free;
  end;
  AddMessage('=== TEST_MODE done. If both PASS, set TEST_MODE := False and run per batch. ===');
end;

procedure RunBatch(skyrim: IInterface; batchIndex: integer);
var
  inList, outLines: TStringList;
  i: integer;
  line, hexPart, status: string;
  colonPos: integer;
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
        AddMessage(Format('progress: %d/%d (ok=%d, notFound=%d, notInfo=%d, empty=%d)',
          [i, inList.Count, okCount, notFound, notInfo, emptyResp]));
    end;
    outLines.SaveToFile(DATA_DIR + 'extracted_' + IntToStr(batchIndex) + '.jsonl');
    AddMessage(Format('DONE batch %d: ok=%d notFound=%d notInfo=%d emptyResp=%d -> %s',
      [batchIndex, okCount, notFound, notInfo, emptyResp,
       DATA_DIR + 'extracted_' + IntToStr(batchIndex) + '.jsonl']));
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
