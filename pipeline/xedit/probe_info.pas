{
  probe_info.pas — verification step, run BEFORE extract_dialogue.pas.

  Skyrim.esm を読める形で1件の INFO レコード（TARGET_FORMID）の要素ツリーを
  丸ごとログに出す。Responses 配列の中で応答テキストがどの Signature/Name/Path に
  入っているかを目視確認するための道具。「NAM1 が Response Text のはず」という
  想定は Bethesda ESM フォーマットの一般的知識に基づく見込みであり、
  このリポジトリ側では実機で検証できていない（CLAUDE.md の方針により、
  未検証の挙動を断定しないため、まずこれで確認する）。

  使い方:
    1. このファイルを xEdit の "Edit Scripts" フォルダにコピー
       （例: <xEdit install>\Edit Scripts\probe_info.pas）
    2. SSEEdit を起動し、Skyrim.esm だけロード（他のプラグインは不要）
    3. 左ペインで Skyrim.esm を右クリック → "Apply Script..." → probe_info を選択 → OK
    4. 下のメッセージログに出力される
    5. 055DF8 の応答が "No doubt he thought it was the only way to make his
       point..." で始まっていれば、NAM1 の場所が特定できたということなので、
       そのパスを extract_dialogue.pas の RESPONSE_TEXT_SIGNATURE に反映する
       （デフォルトの 'NAM1' で一致していれば変更不要）。
}
unit UserScript;

interface
uses xEditAPI, SysUtils, Classes;

implementation

// 既知の正解と付き合わせるための確認対象。他のFormIDを確認したい場合はここを書き換える。
const
  TARGET_FORMID_HEX = '055DF8'; // 期待値: "No doubt he thought it was the only way..."

procedure DumpTree(e: IInterface; depth: integer);
var
  i: integer;
  prefix, nm, sig, val: string;
begin
  if not Assigned(e) then Exit;
  prefix := StringOfChar(' ', depth * 2);
  nm := Name(e);
  sig := Signature(e);
  val := '';
  try
    if ElementCount(e) = 0 then val := GetEditValue(e);
  except
    val := '(unreadable)';
  end;
  AddMessage(Format('%s[%s] name="%s" path="%s" value="%s"',
    [prefix, sig, nm, Path(e), val]));
  for i := 0 to ElementCount(e) - 1 do
    DumpTree(ElementByIndex(e, i), depth + 1);
end;

function Initialize: integer;
var
  skyrim, rec, responses: IInterface;
  fid: Cardinal;
begin
  Result := 0;
  skyrim := FileByName('Skyrim.esm');
  if not Assigned(skyrim) then begin
    AddMessage('ERROR: Skyrim.esm not loaded. Load only Skyrim.esm and retry.');
    Exit;
  end;

  fid := StrToInt('$' + TARGET_FORMID_HEX);
  rec := RecordByFormID(skyrim, fid, False);
  if not Assigned(rec) then begin
    AddMessage('ERROR: FormID ' + TARGET_FORMID_HEX + ' not found in Skyrim.esm.');
    Exit;
  end;
  AddMessage('Found record, signature=' + Signature(rec) + ' editorId=' + EditorID(rec));

  if Signature(rec) <> 'INFO' then begin
    AddMessage('WARNING: expected signature INFO, got ' + Signature(rec));
  end;

  AddMessage('--- full element tree of ' + TARGET_FORMID_HEX + ' ---');
  DumpTree(rec, 0);
  AddMessage('--- end tree ---');

  responses := ElementByPath(rec, 'Responses');
  if Assigned(responses) then
    AddMessage('Responses element found directly at path "Responses", ' +
      IntToStr(ElementCount(responses)) + ' entries.')
  else
    AddMessage('NOTE: no element at path "Responses" — check the tree dump above ' +
      'for the correct path/signature instead.');
end;

function Finalize: integer;
begin
  Result := 0;
end;

end.
