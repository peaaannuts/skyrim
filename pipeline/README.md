# pipeline/ — Component A: FormID → 日本語 ルックアップテーブル生成

ビルド時に一度だけ回すオフライン処理。MOD本体には含まれない。
成果物は `sp-plugin/src/translations.json`（`<Plugin>|<FORMID6> → 日本語`）で、これを
webpack が `jp-subtitle.js` にバンドルする。

**キー形式（重要）：** `<プラグイン名>|<ローカルFormID6>`（例 `Skyrim.esm|055DF8`,
`Dawnguard.esm|001A2B`）。プラグイン名を付けることで、DLCの台詞が Skyrim.esm の
下位24bit同値FormIDと衝突して誤訳を出すのを防ぐ。TS(`index.ts`) とC++(将来 native関数が
`<Plugin>|<FORMID6>` を返す) も同じキーで一致させる。

## データフロー

```
Skyrim.esm + DLC ─(抽出: 実機のみ, xEdit)→ data/raw_dialogue*.json, chunks_c/*.json,
   Skyrim.esm本体            extract_dialogue.pas → extracted_0/1/2.jsonl
   Dawnguard/HearthFires/    extract_dlc.pas      → extracted_dlc_<Plugin>.jsonl
   Dragonborn                        │
                        node pipeline/consolidate.js   （鍵不要・どこでも可）
                                     ▼
                    data/dialogue_en.json   { "<Plugin>|<FORMID6>": "english" }
                                     │
                        node pipeline/translate.js     （実機のAPIキーが必要）
                                     ▼
             sp-plugin/src/translations.json  { "<Plugin>|<FORMID6>": "日本語" }
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

### 2. 翻訳（translate） — **実機で・プロバイダのキーが必要**

`translate.js` は2プロバイダ対応（`--provider deepl`＝既定 / `--provider azure`）。
**それぞれ別々の月間クォータ**を持ち、使用量も別々に記録するので、DeepLを使い切った月に
Azureへ切り替えて残りを埋められる（既に訳済みの行はスキップされる）。

`pipeline/config.local.json`（gitignore済み・コミット禁止）に**ローカルだけ**でキーを置く:

```json
{
  "deepl_api_key": "…",
  "deepl_endpoint": "https://api-free.deepl.com/v2/translate",
  "monthly_char_budget": 500000,

  "azure_api_key": "…",
  "azure_region": "japaneast",
  "azure_endpoint": "https://api.cognitive.microsofttranslator.com"
}
```

```bash
# DeepL（既定）でその月の残り予算まで
node pipeline/translate.js

# Azure（無料F0＝月200万字）で残りを一気に。中断してもOK、再実行で続きから
node pipeline/translate.js --provider azure

# 動作確認だけ（ネットにもキーにも触れない。JA = "【JA】<en>"）
MOCK=1 node pipeline/translate.js --provider azure --limit 5000
```

**Azure 無料キーの取り方（初回のみ）:** Azureアカウント作成（無料） → ポータルで
「Translator」リソースを作成（価格レベル **F0＝無料/月200万字**）→ 「キーとエンドポイント」から
`Key 1` と `Location/Region`（例 `japaneast`）を取得 → 上記 `azure_api_key` / `azure_region` に設定。

- **中断再開**: `data/translate_progress.json`（gitignore済み）に `used:{deepl,azure}` と翻訳キャッシュを保存。
  クラッシュしても失うのは最大1バッチ分。旧形式（`charsUsedThisMonth`）は自動でDeepL使用量へ移行。
- **予算キャップ**: プロバイダ別に上限（DeepL 既定48万〜設定値、Azure 既定190万）を超えて送らない。
  月が変わると自動リセット。DeepL 456 / Azure 403（quota exceeded）を受けたら安全に停止。
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
CK無しで読める標準ツールとして選定。`pipeline/xedit/` に2本のPascalスクリプトを用意した。

> **実機で構造確認済み（2026-07-15）：** 応答テキストは
> `INFO \ Responses \ Response \ NAM1 - Response Text` にある（`probe_info.pas` で確認、
> `055DF8` の英文が既知データと一致）。よって **`probe_info.pas` は実行不要**。
> 直接 `extract_dialogue.pas` の TEST_MODE から始めてよい。

> **スクリプトはASCIIのみで記述。** xEdit のスクリプトパーサを日本語(CP932)コードページで
> 読むと、日本語コメント中のバイト `0x7D`（`}`）が `{ }` ブロックコメントを途中で閉じて
> 構文エラーになる事故があったため、`.pas` は ASCII のみ・`{ }` ブロックコメント不使用に
> してある。日本語の説明はこの README 側に置く。

1. **`pipeline/xedit/probe_info.pas`**（任意・参考用）— 1件（`055DF8`）の要素ツリーを
   丸ごとログ出力し、応答テキストの Signature/Path を目視確認する。上記の通り確認済み。
2. **`pipeline/xedit/extract_dialogue.pas`** — バッチ抽出本体。
   - まず `TEST_MODE = True`（既定）のまま実行 → 既知2件（`055DF8`, `093131`）を抽出し、
     Phase 1 で照合済みの正解テキスト（"No doubt he thought…" / "With good
     planning…"）と自動で突き合わせて PASS/FAIL をログ出力する。**2026-07-15 に両方PASS実証済み。**
   - **両方 PASS した場合のみ** `TEST_MODE = False` にして1回実行するだけ。
     `data/formid_remaining_0/1/2.txt` の3バッチを**自動で連続処理**し、それぞれ
     `data/extracted_0/1/2.jsonl` に出力する（1行1JSONオブジェクト、
     `{formId,responseIndex,editorId,text}`）。バッチごとの手編集・再コピーは不要。
   - **ログ先頭に `VERSION ...` バナーが出るか必ず確認**（出なければ古いコピーを実行している。
     `.pas` を xEdit の `Edit Scripts` フォルダへ上書きコピーし直すこと）。
   - FAIL した場合は `RESPONSE_TEXT_SIGNATURE` 定数を見直してから再試行。

実行場所: xEditの `Edit Scripts` フォルダへ `.pas` をコピー → SSEEdit起動
（Skyrim.esmのみロード）→ 左ペインでSkyrim.esmを右クリック →
"Apply Script..." → スクリプト選択 → OK。ログはメッセージウィンドウに出る。

抽出後、`data/extracted_0/1/2.jsonl` をこのリポジトリへコミット・push すれば、
`consolidate.js` が既存の `raw_dialogue*.json`/`chunks_c/*.json` と合わせて自動で
取り込む（`.jsonl` 対応済み）。DeepL Free は月50万文字なので、全体（概算1.5〜2M文字）は
**複数月に分割**するか DeepL Pro を検討。
