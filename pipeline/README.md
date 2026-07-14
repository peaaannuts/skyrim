# pipeline/ — Component A: FormID → 日本語 ルックアップテーブル生成

ビルド時に一度だけ回すオフライン処理。MOD本体には含まれない。
成果物は `sp-plugin/src/translations.json`（`FORMID6 → 日本語`）で、これを webpack が
`jp-subtitle.js` にバンドルする。

## データフロー

```
Skyrim.esm ──(抽出: 実機のみ、xEdit Pascalスクリプト)──> data/raw_dialogue*.json,
                                                          chunks_c/*.json, extracted_*.jsonl
                                         │
                        node pipeline/consolidate.js   （鍵不要・どこでも可）
                                         ▼
                              data/dialogue_en.json   { "FORMID6": "english" }
                                         │
                        node pipeline/translate.js     （実機の DeepL 新キーが必要）
                                         ▼
                        sp-plugin/src/translations.json  { "FORMID6": "日本語" }
```

## 現状の数字（2026-07-14 実測）

- 全FormID: **31,465**
- 英語抽出済み: **4,868**（ユニーク約39.8万文字 → DeepL Free 月50万で今月中に翻訳可）
- 未抽出（英語テキストがまだ無い）: **26,597** ← 抽出は実機（ESM）でのみ可能

## 手順

### 1. 統合（consolidate） — 鍵不要・この環境でも可

散らばった抽出JSONを正規形 `data/dialogue_en.json` に統合・重複排除する。

```bash
node pipeline/consolidate.js
```

### 2. 翻訳（translate） — **実機で・DeepL 新キーが必要**

`pipeline/config.local.json`（gitignore済み・コミット禁止）に**ローカルだけ**でキーを置く:

```json
{ "deepl_api_key": "…", "deepl_endpoint": "https://api-free.deepl.com/v2/translate",
  "deepl_api_tier": "free", "monthly_char_budget": 480000 }
```

```bash
# その月の残り予算いっぱいまで翻訳（中断してもOK、再実行で続きから）
node pipeline/translate.js

# 動作確認だけ（ネットにもキーにも触れない。JA = "【JA】<en>"）
DEEPL_MOCK=1 node pipeline/translate.js --limit 5000
```

- **中断再開**: `data/translate_progress.json`（gitignore済み）に月次使用文字数と翻訳キャッシュを保存。
  クラッシュしても失うのは最大1バッチ分。
- **予算キャップ**: `monthly_char_budget` を超えて送らない。月が変わると自動リセット。
  DeepL が HTTP 456（quota exceeded）を返したら安全に停止。
- **重複排除**: 同一英文は1回だけ課金対象として送り、全FormIDへ結果を展開。
- **シード保護**: 手動翻訳済みの4行など、既に `translations.json` にあるキーは上書きしない。

### 3. デプロイ

```bash
cd sp-plugin && npm run build
# build/jp-subtitle.js を MO2 mods/jp-subtitle-ts/Platform/Plugins/ へコピー
```

## 未抽出26,597件の抽出について（実機タスク）

英語テキストの抽出は `Skyrim.esm` を読む処理なので**実機でしか実行できない**。
対象FormIDは `data/formid_remaining_0/1/2.txt` に分割済み。

**ツール: xEdit (SSEEdit)。** SE側にCK未インストールのため、Bethesda ESM形式を
CK無しで読める標準ツールとして選定。`pipeline/xedit/` に2本のPascalスクリプトを用意した
（**未実機検証** — INFOレコードのResponses配列の正確な内部パスはこの開発環境では
確認できないため、必ず①→②の順で実行すること）：

1. **`pipeline/xedit/probe_info.pas`** — 1件（`055DF8`）の要素ツリーを丸ごとログ出力し、
   応答テキストの Signature/Path を目視確認する。想定は `NAM1` だが、これは
   Bethesda ESM形式の一般的知識に基づく見込みであり断定ではない。
2. **`pipeline/xedit/extract_dialogue.pas`** — バッチ抽出本体。
   - まず `TEST_MODE := True` のまま実行 → 既知2件（`055DF8`, `093131`）を抽出し、
     Phase 1 で照合済みの正解テキスト（"No doubt he thought…" / "With good
     planning…"）と自動で突き合わせて PASS/FAIL をログ出力する。
   - **両方 PASS した場合のみ** `TEST_MODE := False` にし、`BATCH_INDEX` を
     `0 → 1 → 2` と変えて3回実行。`data/formid_remaining_N.txt` を読み、
     `data/extracted_N.jsonl` に出力する（1行1JSONオブジェクト、
     `{formId,responseIndex,editorId,text}`）。
   - FAIL した場合は `RESPONSE_TEXT_SIGNATURE` 定数（probe結果を見て）を直してから再試行。

実行場所: xEditの `Edit Scripts` フォルダへ `.pas` をコピー → SSEEdit起動
（Skyrim.esmのみロード）→ 左ペインでSkyrim.esmを右クリック →
"Apply Script..." → スクリプト選択 → OK。ログはメッセージウィンドウに出る。

抽出後、`data/extracted_0/1/2.jsonl` をこのリポジトリへコミット・push すれば、
`consolidate.js` が既存の `raw_dialogue*.json`/`chunks_c/*.json` と合わせて自動で
取り込む（`.jsonl` 対応済み）。DeepL Free は月50万文字なので、全体（概算1.5〜2M文字）は
**複数月に分割**するか DeepL Pro を検討。
