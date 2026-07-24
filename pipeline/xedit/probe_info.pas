// probe_info.pas - dump one INFO record's element tree so the response-text path
// can be confirmed by eye. ASCII-only and no '{ }' block comments on purpose (see
// extract_dialogue.pas header for why). Japanese notes are in pipeline/README.md.
//
// Result already confirmed on the real machine: the response text lives at
//   INFO \ Responses \ Response \ NAM1 - Response Text
// so extract_dialogue.pas can be run directly; this probe is kept for reference.
//
// Usage: copy to xEdit's "Edit Scripts" folder, load only Skyrim.esm, right-click
// Skyrim.esm -> Apply Script -> probe_info. Output goes to the message log.

unit UserScript;

interface
uses xEditAPI, SysUtils, Classes;

implementation

const
  TARGET_FORMID_HEX = '055DF8'; // expected: "No doubt he thought it was the only way..."

procedure DumpTree(e: IInterface; depth: integer);
var
  i: integer;
  prefix, val: string;
begin
  if not Assigned(e) then Exit;
  prefix := StringOfChar(' ', depth * 2);
  val := '';
  try
    if ElementCount(e) = 0 then val := GetEditValue(e);
  except
    val := '(unreadable)';
  end;
  AddMessage(prefix + '[' + Signature(e) + '] path="' + Path(e) + '" value="' + val + '"');
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

  AddMessage('--- full element tree of ' + TARGET_FORMID_HEX + ' ---');
  DumpTree(rec, 0);
  AddMessage('--- end tree ---');

  responses := ElementByPath(rec, 'Responses');
  if Assigned(responses) then
    AddMessage('Responses found at path "Responses", ' + IntToStr(ElementCount(responses)) + ' entries.')
  else
    AddMessage('NOTE: no element at path "Responses" - check the tree dump above.');
end;

function Finalize: integer;
begin
  Result := 0;
end;

end.
