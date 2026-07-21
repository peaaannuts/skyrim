# SubtitleTranslator

Skyrim SE を英語音声・字幕で学習用にプレイ中、字幕が読み取れない行だけホットキーで
日本語訳をオーバーレイ表示する MOD。常時表示ではなく on-demand（英語を読む訓練を妨げないため）。

## アーキテクチャ（確定済み・再検討不要）

- **翻訳API：** DeepL API（Free tier、ユーザー自身のキー。`pipeline/config.local.json` に設定済み、
  コミット・ハードコード禁止）
- **v1スコープ：** vanilla Skyrim.esm のダイアログのみ（有効な261 modプラグインは対象外）。まずPoC。
- **方式：** ゲーム内でDeepLをリアルタイム呼び出しせず、事前にオフラインで
  FormID → 日本語 のルックアップテーブルを作る（会話中のAPI遅延を避けるため）。

### 3コンポーネント構成

| # | 内容 | 場所 |
|---|---|---|
| A | ビルド時の一回限りのデータパイプライン（抽出＋DeepL翻訳）。MOD本体には含まれない | `pipeline/`, `data/` |
| B | ネイティブSKSEプラグイン（C++, CommonLibSSE-NG）。現在再生中のTopicInfo（INFOレコード）のFormIDを検知してスクリプト層に渡す | `native-plugin/` |
| C | Skyrim Platform（TypeScript）プラグイン。ホットキーをポーリングし、Bから現在のFormIDを取得、AのJSONで日本語を引き、Skyrim PlatformのCEFオーバーレイで英語字幕の下に表示 | `sp-plugin/` → MO2 `mods/jp-subtitle-ts/` |

## 現状（2026-07-14 時点）

- **Component B：** ビルド成功・in-game検証済み。`src/main.cpp` は本実装済み。
  `TESTopicInfoEvent` シンクで「話者FormID → アクティブなTopicInfo FormID」を
  `g_activeBySpeaker` マップに保持（BEGINで記録、ENDで削除。瞬間BEGIN/ENDのノイズは残らない）。
  Papyrus native関数を2つ登録：`GetTestValue()`（0x12345を返すサニティ用）と
  `GetCurrentDialogueFormID()`（SubtitleManagerで表示中字幕の話者を特定→その話者の
  アクティブTopicInfo FormIDを返す。0=該当なし。呼ばれるたび `[QUERY]` ログを出す）。
- **Component C：** 実装済み・**in-game検証済み（2026-07-14 E2E PoC成功）**。`sp-plugin/src/index.ts`。
  F10(=68)で `GetCurrentDialogueFormID` を呼び、`translations.json` で日本語を引いて
  CEFオーバーレイに表示。F9(=67)で非表示。表示は `browser.executeJavaScript` で
  固定配置divを注入（共有UIページを差し替えない）。`translations.json` は
  **私が手動翻訳したBalgruuf会話4行のシードのみ**（055DF8, 093131, 0E24E7, 092D9E）。
  未登録の行は赤字で「［FormID XXXXXX の訳は未登録］」を表示 = 経路実証用プレースホルダー。
- **Component A：** **抽出・翻訳とも完了（2026-07-18）**。
  - 抽出：xEdit(SSEEdit) の Pascalスクリプト（`pipeline/xedit/extract_dialogue.pas`）で
    `data/formid_remaining_0/1/2.txt` の30,781件を一括処理 → `data/extracted_0/1/2.jsonl`。
    `consolidate.js` で統合した結果、`data/dialogue_en.json` は **27,840件が英語テキストあり**
    （全31,465件の88.5%。残り3,625件は応答テキストが空のINFO＝翻訳対象外）。
  - 翻訳：`pipeline/translate.js` は DeepL・Azure Translator の2プロバイダ対応（プロバイダ別に
    月次予算・使用量を分離管理、`hard`戦略＝長文優先、resumable）。DeepL Free（初月50万文字、
    `hard`戦略で1,747件）→ 予算切れ後 Azure Translator 無料枠（F0・月200万文字）で残り
    26,093件を一度に完投。**`translations.json` は 27,840/27,840件＝100%カバレッジ**。
    検品済み（MOCK混入0・キー形式OK・シード4行保護・訳質良好、長文/短文サンプルとも自然）。
  - vanilla Skyrim.esm の翻訳可能ダイアログは実質全件カバー。残タスクはin-game最終確認のみ。

## 検証済みの事実（Phase 1、in-game実証済み）

- **`TESTopicInfoEvent` が正しく機能する。** `ScriptEventSourceHolder` 経由で
  `kDataLoaded` 時に登録すると、ダイアログの `topicInfoFormID`（INFOレコードのFormID）を
  BEGIN/ENDで受け取れる。捕捉したFormIDが houseCARL のデータ層の実際のINFOレコード
  テキストと完全一致することを照合済み（例: `055DF8`→"No doubt he thought it was the only
  way to make his point..." 、`093131`→"With good planning and constant vigilance."）。
  → **翻訳ルックアップテーブル（FormID→日本語）と直接突き合わせ可能。**
- **ノイズが大量にある。** プレイヤーの近くにいないNPC（実測では Frea = `04017A0D`、
  Dragonborn DLC）が背景シーン評価で毎秒何十回もTopicInfoをBEGIN/END発火する。
  全ログの大半がこれ。**見分け方：本物の再生中の台詞は BEGIN→END に実時間の間隔
  （数百ms〜数秒）があるが、ノイズは BEGIN と END が同一ミリ秒**（実際には喋っていない）。
- **`SubtitleManager` の speaker は話者のFormIDであって台詞（INFO）のFormIDではない。**
  ポーリング単独では翻訳テーブルを引けない。TopicInfoEvent と組み合わせる必要がある。
- **設計方針（確定）：** MODはオンデマンド（ホットキー押下時）なので全イベントをライブ処理
  する必要はない。ネイティブ側で「話者ごとの現在アクティブな（BEGINしたがまだENDしていない）
  TopicInfo」を1つ保持し、ホットキー時に (1) SubtitleManagerで表示中字幕の話者を取得 →
  (2) その話者のアクティブTopicInfo FormIDを引く → (3) 翻訳テーブルで日本語を引く。
  瞬間BEGIN/ENDのノイズは「アクティブ状態が1ms未満」なので自然に除外される。

## 検証済みの事実（Phase 3a、in-game実証済み）

- **C++→TS の橋は `callNative` で通る。** Skyrim Platform の
  `callNative(className, functionName, self?, ...args)` で、SKSEプラグインが登録した
  Papyrus native global関数を同期呼び出しできる。テスト関数 `JpSubtitle.GetTestValue()`
  が `0x12345`(74565) を返し、TS側が正しく受信、C++側で実際に関数が呼ばれることを両ログで確認。
  → **計画の選択肢(a)が成立。FormID取得もこの方式で実装する。**
- **【重要】native関数には `.psc`/`.pex` が必須。** C++で `vm->RegisterFunction` するだけでは
  VMが型名を知らず、`callNative` は "Native function not found" で失敗する。スクリプト側の
  `.psc`（型と関数シグネチャの宣言）をコンパイルした `.pex` を同梱して初めてVMがルーティングできる。
  ネイティブ関数は「2箇所で宣言される1つのもの」（C++登録 + .psc宣言）。
  現物: `native-plugin/Scripts/Source/JpSubtitle.psc`（`Scriptname JpSubtitle Hidden` +
  `Int Function GetTestValue() global native`）→ コンパイルして
  `jp-subtitle-spike/Scripts/JpSubtitle.pex` に配置。
- **ホットキー検出（`Input.isKeyPressed`）は動作する。** 前フレーム状態を保持した
  立ち上がりエッジ検出でF10を正しく検知（実測）。DXスキャンコード F10=68。
- **TS `writeLogs(pluginName, ...)` の出力先** は `<MO2 overwrite>\Platform\Logs\<pluginName>-logs.txt`。

## 検証済みの事実（Phase E2E、in-game実証済み・2026-07-14）

- **エンドツーエンドPoC 成功。** 会話 → INFO FormID捕捉 → C++→TS橋（`callNative`）→
  辞書引き → CEFオーバーレイ描画 → F9で消去 の全経路が実機で一気通貫。
- **実証ログ（実測）：**
  - C++側 `jp-subtitle-spike.log`：
    `[QUERY] speaker=0001A67F topicInfo=00090504 text="I've got my eyes on you."`
    （F10押下で `GetCurrentDialogueFormID` が発火 → 表示中字幕の話者を特定 →
    その話者のアクティブTopicInfo FormIDを返し、実テキストまで一致確認。**QUERYは1行だけ**＝
    設計通りノイズの瞬間BEGIN/ENDが除外されている）。
  - TS側 `jp-subtitle-logs.txt`：`miss 090504 (no translation yet)`
    （`callNative` で `00090504` を受信 → `formIdKey()` が下位6桁大文字 `090504` に整形 →
    シード4行に無いので**正当なmiss** → 赤字プレースホルダーを描画）。
  - 目視：F10で画面下部に表示され、F9で消えることをユーザーが確認。
- **`formIdKey()` の整形は正しい。** C++の signed Int を `>>> 0` で unsigned 化 →
  下位24bit → 6桁hex → **大文字化**。`translations.json` のキーも大文字なので、
  アルファ入りキー（例 `0E24E7`）もその台詞が再生されれば hit する（潜在バグなし。
  今回の `090504` は英字を含まないため大文字化自体はこのケースでは未検証だが、コードは整合）。
- **未検証キーで踏んだのは汎用の見張りバーク**（"I've got my eyes on you."）。
  シード（Balgruuf 4行）ではなかったため miss だが、**経路実証としては十分**。
  シード台詞の hit 表示は、その台詞を実際に再生させれば別途確認できる。

## 未確定・要検証の技術判断

- **DLC（Dawnguard/Hearthfire/Dragonborn）は翻訳対象外（v1スコープ通り、意図的）。**
  `data/all_formids.txt`（全31,465件）は100% `Skyrim.esm` のみで確認済み。
  **潜在リスク（未検証）：** `sp-plugin/src/index.ts` の `formIdKey()` はFormIDの
  下位24bitのみで引く（プラグインのロード順バイトを捨てる、Skyrim.esm=ロード順00前提の
  割り切り）。そのため、DLC側のINFOレコードがSkyrim.esm側と下位24bitで偶然衝突すると、
  DLCの台詞なのに誤ってSkyrim.esmの日本語訳が出る可能性が理論上ある
  （27,840件までデータが増えた2026-07-18時点で衝突面積も拡大。実機で未確認・要検証）。
- **ルックアップ未対応行の挙動：** サイレントに何も表示しない vs プレースホルダー表示。未決定。
- **ホットキー割り当て：** テストではF10(=68)を使用。ロードオーダーに他のホットキー系MOD
  （Dodge MCO-DXP, TK Dodge RE等）が多数有効なため、本番のキー選定は衝突回避が必要。
- **オーバーレイの位置・サイズは実機調整中。** 2026-07-18、フルデータ投入後の初回in-game確認で
  「日本語がバニラ英語字幕に被る、フォントも英語字幕よりかなり大きい」ことが判明。
  `sp-plugin/src/index.ts` の `ensureOverlay()` を `bottom: 14%→20%`（英語字幕の上に間隔を確保）、
  `fontSize: 30px→24px`（英語字幕に近いサイズへ）に調整済み・**未実機確認**（要 npm run build→
  デプロイ→in-game再確認。値はまだ推測ベースで、UIスケール設定次第では再調整が要る）。

## ビルド環境（追記）

- Node.js v24 + npm インストール済み（`C:\Program Files\nodejs`）。
  TSプラグインは `C:\Modding\SubtitleTranslator\sp-plugin`（webpack + ts-loader）。
  `npm run build` で `build\jp-subtitle.js` を生成 → MO2の
  `mods\jp-subtitle-ts\Platform\Plugins\jp-subtitle.js` にコピー。
- **tsconfig 注意：** Node24付属の新しい `@types/node` は TS4.9 でパースエラーになるため、
  tsconfig に `"types": []` と `"skipLibCheck": true` を設定して自動読み込みを止めてある。
- Papyrusコンパイラは SkyrimVR 付属のものを使用
  （`C:\Program Files (x86)\Steam\steamapps\common\SkyrimVR\Papyrus Compiler\PapyrusCompiler.exe`）。
  SE側にはCK未インストール。.pexフォーマットはSE/VR共通なので問題なし。
  SE側バニラソースを import_dirs に渡してコンパイル。houseCARL_compile_script 経由。

## 既知のハマりどころ（再発防止）

- **MO2に同名プラグインを出す重複MODフォルダに注意。** 旧セッションが作った
  `JPSubtitleSpike`（PascalCase）と現行の `jp-subtitle-spike`（kebab-case）が両方存在し、
  古い方が有効・新しい方が無効になっていて、ビルド更新が一切ゲームに反映されない事故が発生した。
  現行は `jp-subtitle-spike` が正。`JPSubtitleSpike` は無効化済み（削除推奨）。
- **MO2起動中に modlist.txt を直接編集しない。** MO2が終了時に自分のメモリ状態で上書きする。
  編集前にMO2を閉じること。MODの有効/無効は `C:\Modding\MO2\profiles\251102\modlist.txt` の
  行頭 `+`（有効）/`-`（無効）で制御。
- **`build.bat` は `cd /d %~dp0` で自分のディレクトリに移動してから xmake を呼ぶこと。**
  VsDevCmd.bat がカレントディレクトリを変えるため、これがないと xmake.lua が見つからない。
- **`REX::Singleton` を使うには `pch.h` に `#include <REX/REX/Singleton.h>` が必要**
  （`RE/Skyrim.h` には含まれない）。

## ビルド環境

- VS2022 Build Tools インストール済み（`C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools`,
  MSVC v14.44、C++23対応）
- xmake v3.0.9 インストール済み（`C:\Program Files\xmake\xmake.exe`）
- CommonLibSSE-NG は `native-plugin/lib/commonlibsse-ng` に submodule 済み
  （alandtse/CommonLibVR の `ng` ブランチ — 正しいライン）
- ビルドは VS Developer Shell 経由が必須（`VsDevCmd.bat` を通してから `xmake build`）。
  `native-plugin/build.bat` にラップ済み。

## MO2 / ロードオーダー

- houseCARL の MO2 instance: `C:\Modding\MO2`
- Skyrim Platform SDK: `C:\Modding\MO2\mods\Skyrim Platform - A TypeScript SDK for Skyrim\Platform\`
  （`Modules\skyrimPlatform.ts` にAPI定義、`plugin-example\` にTSプロジェクトの雛形あり）

## 開発方針

- houseCARL の `skse-plugin-authoring` スキルを Component B の作業時は必ず参照する
  （CommonLibSSE-NGのフック・イベントシンク・native関数登録パターン）
- 未検証のランタイム挙動は「推測」ではなく「検証すべき事項」として明示する
  （憶測でAPIやフック名をでっち上げない）

## ⏭ 引継ぎ：次にやること（2026-07-21 更新）

**vanilla Skyrim.esm 対応（①②③）は完了・実証済み。** ①③のE2E PoC成功（2026-07-14）、
②翻訳パイプラインも抽出完了＋翻訳100%完了（2026-07-18、`translations.json` 4→27,840行）。
**現在はDLC対応（Dawnguard/HearthFires/Dragonborn）が進行中**（詳細は下記セクション3）。
キーを `<Plugin>|<FORMID6>` 形式に統一する改修中で、DLC抽出・データ統合・C++/TS実装は
完了したが、**C++の再ビルドと全コンポーネントのin-game再検証がまだ**（native-plugin/を
2026-07-21にpush完了、詳細は下記「リポジトリ状態の注意」）。

**リポジトリ状態の注意（Linux側・2026-07-18）：**
- `main` を経由して `data/`・`pipeline/`・`sp-plugin/` を GitHub に push 済み。
  作業ブランチ `claude/e2e-poc-verification-ido0u6` で `.gitignore` を追加し、
  `sp-plugin/node_modules/`（99MB/3988ファイル）と `pipeline/config.local.json` を
  **追跡除外**（追跡 4071→83ファイル）。以後この2つはコミットされない。
- **旧DeepLキーの漏洩と失効：** 初回コミット `57b69f6` に `config.local.json`（旧キー）が
  平文で入ってしまったが、**ユーザーが旧キーを失効・再発行済み**なので実害なし。
  履歴 `57b69f6` には旧キー文字列が残る（無効なので放置可。気になれば `main` を
  force-push で書き換え）。**新キーはローカルの `config.local.json` のみに置く（コミット禁止）。**
- **`native-plugin/`（C++・Component B）を2026-07-21にようやく GitHub へ push 完了。**
  実機フォルダ `C:\Modding\SubtitleTranslator` 自体が git 未初期化のまま長期間運用されて
  おり（`main` への迷子コミットや直下への誤配置の真因）、`native-plugin/` 内部にも
  コミット0件の入れ子 `.git` が存在していた。復旧手順：①実機フォルダを `git init` し
  既存の `origin` remote を確認、②untrackedファイルを `master` ブランチへ一旦
  スナップショットコミット（`0f6d1ed`、native-plugin以外の全ファイルを含む）、③
  `git checkout claude/e2e-poc-verification-ido0u6` でブランチ切替（作業ディレクトリが
  ブランチの内容に同期される。native-plugin等 `master` 専用パスは一旦消えるが履歴には残る）、
  ④ `git checkout master -- native-plugin` で native-plugin だけを復元、⑤コミット・push。
  途中、`native-plugin/` 内の入れ子 `.git`（`git add -A` を "does not have a commit
  checked out" で阻害）を削除、`.xmake/` ビルドキャッシュを `.gitignore` に追加、
  `data/config.local.json`（`pipeline/config.local.json` の誤コピー、実キー入り）を
  発見・削除、という副産物の後始末も発生した。**教訓：実機の作業フォルダで
  `git status`/`git branch` を定期的に確認する習慣がないと、この種の分岐が長期間
  気づかれず蓄積する。**
- **`main` ブランチに迷子のコミットあり（実害なし・放置可）：** `main` の `a1b23cc "submit"` に
  リポジトリ直下（`pipeline/`の外）へ `translate.js` のコピーが1つ紛れ込んでいる。おそらく
  実機の別フォルダ/別チェックアウトから誤って `main` へpushされたもの。**作業は常に
  `claude/e2e-poc-verification-ido0u6` ブランチで行うこと。** 実機でブランチ名の確認を怠ると
  再発するので、pushする前に `git branch`（Current branch表示）を都度確認する習慣を推奨。

### 1. ✅ 完了：エンドツーエンドPoCのin-game検証（2026-07-14 成功）

**結果：成功。** 詳細ログは「検証済みの事実（Phase E2E）」節を参照。
`[QUERY] speaker=0001A67F topicInfo=00090504` を捕捉 → TS側 `miss 090504` → 赤字
プレースホルダー描画 → F9で消去、を実機で確認。以下は再現手順（記録用）：
1. MO2起動 → SKSE経由でゲーム起動 → セーブロード
2. NPCと会話（ホワイトランのバルグルーフ首長ならシード済み日本語がヒットしやすい）
3. 字幕表示中に **F10** を押す → 画面下部(下から14%)に日本語オーバーレイが出るか
4. F9で消える

**確認するログ：**
- C++側 `C:\Users\japan\Documents\My Games\Skyrim Special Edition\SKSE\jp-subtitle-spike.log`
  → `[QUERY] speaker=... topicInfo=... text="..."` が出るか（F10押下ごとに1行）
- TS側 `C:\Modding\MO2\overwrite\Platform\Logs\jp-subtitle-logs.txt`
  → `hit <FormID> -> <日本語>` または `miss <FormID>` が出るか

**期待結果：** シード4行なら日本語表示、それ以外は赤字「［FormID … の訳は未登録］」。
どちらでも「会話→FormID捕捉→オーバーレイ描画」の経路が実証できれば①③のPoC成功。

**検証で出うる問題と着眼点：**
- オーバーレイが全く見えない → `browser.setVisible(true)` でCEFが表示されているか、
  divのz-index/位置、ページ(既定 index.html)が読めているか。`browser.executeJavaScript`
  はページのロード完了後でないと効かない可能性 → F10は起動後十分経ってから押す前提。
- FormIDは取れるが日本語が出ない → `formIdKey()` の整形（下位6桁hex大文字）と
  translations.jsonのキーが一致しているか。C++の `[QUERY]` の topicInfo と突き合わせる。
- 会話中に字幕の話者と別NPCのアクティブTopicInfoを拾う → `GetCurrentDialogueFormID` の
  「forceDisplay優先」ロジックの調整。Phase 1bのノイズ（Frea等の瞬間BEGIN/END）は
  設計上除外されるはずだが実挙動を確認。

### 2. ✅ 完了：② 翻訳パイプライン（Component A）

**抽出・翻訳とも完了（2026-07-18）。** パイプライン3スクリプトを実装・実機実証済み：
- `pipeline/xedit/extract_dialogue.pas`（xEdit）：INFO\Responses\Response\NAM1 から
  応答テキストを一括抽出。**ASCIIのみ・`{ }`ブロックコメント不使用**（CP932で読まれると
  日本語コメント中の 0x7D がブロックコメントを閉じ構文エラーになるため）。`TEST_MODE`で
  既知2件（055DF8/093131）を正解照合してから本番。実行は xEdit の `Edit Scripts` フォルダの
  コピーを直接編集（版数バナーで最新か判別）。30,781件処理 → notFound/notInfo=0。
- `pipeline/consolidate.js`：`raw_dialogue*.json`/`chunks_c/*.json`/`extracted_*.jsonl` を
  `data/dialogue_en.json`（FORMID6→英語）に統合＋重複排除＋予算レポート。
- `pipeline/translate.js`：DeepL・Azure Translator の2プロバイダ対応バッチ翻訳。resumable
  （`data/translate_progress.json`、プロバイダ別に使用量分離管理）、月次予算キャップ、
  月替わり自動リセット、シード保護、`MOCK=1` ドライラン、`--strategy hard`（既定＝長文優先）、
  `--provider azure`（Azure無料F0＝月200万文字）。

**結果：** DeepL Free初月分（50万文字・`hard`戦略で1,747件）→ 予算切れ後 Azure Translator
無料枠で残り26,093件を一度に完投。**`translations.json` は 27,840/27,840件＝カバレッジ100%**
（`data/dialogue_en.json` の全FormIDが翻訳済み。残り3,625件は応答テキストが空で翻訳対象外）。
検品済み（MOCK混入0・キー形式OK・シード4行保護・長文/短文サンプルとも訳質良好）。
- **予算判断（確定）：** 低価値な短バーク除外は文字数を1割も減らせない（課金は文字数、
  短行は元々安い）ため無意味。方針は「重要度優先（hard）でFree枠消化→枯渇したら別プロバイダ
  （Azure）で残りを完投」で確定・実証済み。
- APIキーは `pipeline/config.local.json`（gitignore済み・コミット禁止）。旧キー漏洩は失効済み。
- **残タスクなし。** 今後は Skyrim.esm 側の内容変更が無い限り再翻訳不要。

### 3. 🚧 進行中：DLC対応（Dawnguard/HearthFires/Dragonborn）

**ユーザー要望（2026-07-20）で着手。** キー形式を `FORMID6` 単独から
`<Plugin>|<FORMID6>`（例 `Skyrim.esm|055DF8`, `Dawnguard.esm|001A2B`）に変更し、
DLCの台詞がSkyrim.esm側と下位24bit衝突して誤爆する問題を根本解決する設計（詳細は
「未確定・要検証の技術判断」の該当項目）。

- **抽出（Component A）：** ✅ 完了。`pipeline/xedit/extract_dlc.pas` で3DLCの
  DIAL→INFO を走査し `NAM1` 応答テキストを抽出（Dawnguard 3,119件、Dragonborn 4,098件、
  HearthFires 655件、計7,872件、実機実証済み）。`data/extracted_dlc_<Plugin>.jsonl`。
- **統合（Component A）：** ✅ 完了。`consolidate.js` をプラグイン込みキー対応に改修。
  `data/dialogue_en.json` は35,712件（Skyrim 27,840 + DLC 7,872）。既存
  `translations.json`（27,840件）も `Skyrim.esm|...` キーへ移行済み（再翻訳を回避、
  MOCK検証で新規翻訳がDLC分7,487件のみに正しく絞られることを確認済み）。
- **DLC翻訳：** ❌ 未実施。実機で `node pipeline/translate.js --provider azure` を
  再実行すればDLC分（ユニーク約7,487文字列）が翻訳される（Skyrim分は既訳としてスキップ
  される設計）。
- **C++（Component B）：** ✅ 実装・**ビルド成功済み（2026-07-21実機確認）**。`native-plugin/`
  をようやくGitHubへpush（下記「リポジトリ状態の注意」参照）。`GetCurrentDialogueFormID`
  （Int返却・Skyrim.esm専用）を `GetCurrentDialogueKey`（String返却、
  `"<Plugin>|<FORMID6>"` 形式、`TESForm::GetFile(0)->GetFilename()` でプラグイン名を
  解決）に置き換えた。`.psc` も追随済み。`native-plugin/build.bat` で `[100%]: build ok`
  を実機確認済み（`RE::TESForm::LookupByID` / `TESForm::GetFile` / `RE::BSFixedString` /
  `fmt::format` すべてコンパイル通過。Linux側では検証できていなかったが、CommonLibSSE-NGの
  標準APIという推測は正しかった）。**未実施：DLL/PDBのデプロイ、`.psc`再コンパイル、
  in-game動作確認。**
- **TS（Component C）：** ✅ 実装済み・**未ビルド・未実機検証**。`index.ts` は
  `callNative('JpSubtitle', 'GetCurrentDialogueKey', ...)` を呼び、返ってきた文字列を
  そのまま `table[key]` で引く（旧 `formIdKey()`/`skyrimKey()` のビット演算は削除）。
  TypeScript型チェックはこの環境で実行しクリーン（`tsc --noEmit` エラー0件）。

**次の一手（実機・3つ）：**
1. `native-plugin/build.bat` で再ビルド → **コンパイルエラーが出たらそのまま貼ってほしい**
   （Linux側で検証できていない箇所のため、エラーメッセージから即座に対応する）。
2. `.psc` を再コンパイルして `.pex` 更新（native関数を変えたので必須）。
3. `.dll`/`.pdb`/`.pex` をデプロイ → `npm run build` → `jp-subtitle.js` デプロイ →
   in-game確認。ログに `[QUERY] speaker=... topicInfo=... key=Skyrim.esm|... text="..."`
   （Skyrim.esm）や `key=Dawnguard.esm|...`（Dawnguard中）が出るか確認。
   DLC翻訳がまだの場合は `miss Dawnguard.esm|...` のプレースホルダーが出れば経路は正常。

### 4. その後の磨き込み（未決定事項）

- 本番ホットキーの選定（F10は仮。Dodge MCO-DXP / TK Dodge RE 等と衝突しないキーへ）。
- 未登録行の挙動（現状プレースホルダー表示。サイレントにするか要相談）。
- 複数応答（`Responses[N]`, N>0）の扱い。表示の自動消去タイマー等。

## ビルド・デプロイ手順（そのままコピペ可）

**C++（native-plugin）:**
1. ビルド: `cmd //c 'C:\Modding\SubtitleTranslator\native-plugin\build.bat'`
   （出力: `native-plugin\build\windows\x64\releasedbg\jp-subtitle-spike.dll`）
2. デプロイ: `.dll` と `.pdb` を `C:\Modding\MO2\mods\jp-subtitle-spike\SKSE\Plugins\` へコピー。
   **ゲーム起動中はDLLがロックされコピー不可（"Device or resource busy"）→ ゲーム終了後に。**
3. `.psc` を変更したら再コンパイル（下記）。

**Papyrus（.psc → .pex）:**
- `native-plugin/Scripts/Source/JpSubtitle.psc` を houseCARL_compile_script で。
  `output_dir=C:\Modding\MO2\mods\jp-subtitle-spike`、
  `import_dirs=C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\Data\Scripts\Source`
  → `jp-subtitle-spike\Scripts\JpSubtitle.pex` に出力。
- native関数を追加/変更したら **C++登録・.psc宣言・.pex再コンパイルの3つを必ず揃える**。

**TS（sp-plugin）:**
1. ビルド: `cd C:\Modding\SubtitleTranslator\sp-plugin && npm run build`
   （出力: `build\jp-subtitle.js`）
2. デプロイ: `build\jp-subtitle.js` を
   `C:\Modding\MO2\mods\jp-subtitle-ts\Platform\Plugins\jp-subtitle.js` へコピー。

**MO2の該当MOD（両方 modlist.txt で `+` = 有効済み）:**
`jp-subtitle-spike`（DLL+pex）, `jp-subtitle-ts`（js）。旧 `JPSubtitleSpike` は無効(削除推奨)。
