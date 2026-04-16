# Song Educator プロジェクト 肥大化対策提案

Vue 3 + Vite + Capacitor 製の楽曲学習アプリのリファクタリング方針をまとめる。

---

## 問題点

### 1. `TrackDetailView.vue` が巨大すぎる（約1,000行）

最も深刻な問題。1ファイルに以下が同居している。

- プレイヤー制御（audio要素、シーク、リピート、キーボード検知）
- タブ切替（基本情報 / 歌詞 / 画像 / テスト）
- メタデータ読み込み（IndexedDB → Pinia → ネットワーク の3段キャッシュ戦略）
- ビジュアル生成（AI呼び出し、ツールチップ、タッチ処理）
- クイズ全フェーズ（cover / generating / question / feedback / result）
- 正解追認ロジック（AI検証）

実質 **5〜6個のコンポーネントが1ファイルに同居している** 状態。

### 2. `claudeApi.js` にプロンプト・ロジック・API呼び出しが密結合

現在 `claudeApi.js`（約270行）には以下が **すべて直書き** されている。

- `DIFFICULTY_PROMPTS`（難易度別のシステムプロンプト断片、計3パターン）
- `generateQuizQuestions` のシステムプロンプト（約40行の日本語指示）
- `generateVisualHtml` のシステムプロンプト（annotation/tooltip生成指示）
- `validateAcceptAnswer` のプロンプト（正解追認の判定基準）
- APIキー管理（localStorage操作）
- Blob → Base64 変換ユーティリティ
- JSON パース＋フォールバック処理
- HTML 組み立てロジック（`buildVisualHtml`, `annotateText`）

**問題点:**

- プロンプトの修正にJS知識が必要（非エンジニアが調整できない）
- プロンプトの差分がコードの差分に埋もれてレビューしづらい
- テストが困難（プロンプトの動作確認にAPI実行が必要）
- 難易度追加やプロンプト改善のたびにJS側の変更が発生する
- 1ファイルの責務が多すぎて全体像を把握しにくい

### 3. 未使用・デッドコードの残存

| ファイル | 状態 |
|---|---|
| `src/components/HelloWorld.vue` | Vite テンプレート残骸 |
| `src/assets/vue.svg`, `vite.svg` | HelloWorld.vue でしか使われていない |
| `src/data/quizQuestions.json` | どこからも import されていない |
| `src/services/visualHtmlFrame.html` | 現在の実装（`buildVisualHtml`）では未使用 |
| `TrackDetailView.vue` 内のコメントアウト済みテンプレート | 歌詞タブ・解説タブの残骸 |

### 4. ロジック重複

- `quizStore.js` と `TrackDetailView.vue` に **同一の `normalize` 関数** が別実装
- `claudeApi.js` の `buildVisualHtml` 内に HTML エスケープ処理が埋め込まれ、再利用不可
- プレイヤー時刻フォーマット、trackNumber パース、拡張子除去などの小物ユーティリティが各ファイルに散在

### 5. バンドルに乗る重量級依存

| 依存 | 用途 | 代替可能性 |
|---|---|---|
| `jsmediatags` | ID3 解析 | 既に自前で `parseId3v2Frames` を実装済み。削除可 |
| `marked` | Markdown 解説タブ | 現在コメントアウト中。実質未使用 |
| `@anthropic-ai/sdk` | Claude API 呼び出し | `messages.create` のみ使用。fetch で置換可能（数百KB削減） |

### 6. Pinia 永続化の肥大化リスク

- `visualStore` は最大 5,000 件の HTML 文字列を `localStorage` に保持する設計
- しかし `localStorage` は通常 5MB 上限 → 数百件で限界に達する
- `quizStore` も全トラックの問題・進捗を保持し続け、`prune` はあるがリスト未読込時は実行されない

---

## 解決策（優先度順）

### 【高】TrackDetailView.vue の分割

```
views/
└── TrackDetailView.vue          （親・タブ制御のみ、200行程度へ）

components/track/
├── PlayerBar.vue                （audio制御＋UI）
├── TrackInfoTab.vue             （基本情報タブ）
├── TrackImagesTab.vue           （画像タブ）
├── TrackVisualTab.vue           （ビジュアル＋ツールチップ）
└── TrackQuizTab.vue             （クイズ全フェーズ）

composables/
├── useAudioPlayer.js            （再生状態＋キーボード検知）
├── useTrackLoader.js            （3段キャッシュのメタデータ読込）
├── useQuizSession.js            （クイズ進行ロジック）
└── useVisualTooltip.js          （ツールチップ位置計算）
```

1ファイルあたり 150〜250行に収まり、テスト・改修が劇的に楽になる。

### 【高】claudeApi.js のプロンプト分離とモジュール分割

#### ディレクトリ構成

```
src/
├── prompts/                         ← NEW: プロンプト専用ディレクトリ
│   ├── quizSystem.txt               クイズ生成のシステムプロンプト本文
│   ├── quizDifficulty.json          難易度別の追加指示（low/medium/high）
│   ├── visualSystem.txt             ビジュアル生成のシステムプロンプト
│   └── validateAnswer.txt           正解追認の判定プロンプト
│
├── services/
│   ├── ai/                          ← NEW: AI関連を責務ごとに分割
│   │   ├── client.js                APIキー管理 + クライアント生成
│   │   ├── generateQuiz.js          クイズ生成（プロンプト読込 + API呼出 + JSON解析）
│   │   ├── generateVisual.js        ビジュアル生成（プロンプト読込 + API呼出 + HTML組立）
│   │   ├── validateAnswer.js        正解追認（プロンプト読込 + API呼出）
│   │   └── parseResponse.js         JSON抽出・フォールバック処理（共通）
│   └── ...
│
└── utils/
    └── blobToBase64.js              Blob URL → Base64 変換（汎用ユーティリティ）
```

#### 分離の方針

**プロンプトファイル（`src/prompts/`）**

プレーンテキスト or JSON で管理し、Vite の `?raw` import で読み込む。

```js
// generateQuiz.js での使用例
import systemPromptBase from '@/prompts/quizSystem.txt?raw'
import difficultyConfig from '@/prompts/quizDifficulty.json'

const systemPrompt = systemPromptBase.replace(
  '{{DIFFICULTY_INSTRUCTION}}',
  difficultyConfig[difficulty]
)
```

- プロンプトの修正が **テキストエディタだけで完結** する
- Git diff でプロンプト変更とロジック変更が明確に分離される
- 将来的に多言語化やバージョン管理（v1/v2）が容易

**`quizDifficulty.json` のイメージ**

```json
{
  "low": "5問すべてを歌詞穴埋め問題にしてください。\n- \"穴埋め：...\"",
  "medium": "5問すべてを解説・画像から重要単語[重要単語]を答えさせる問題にしてください。",
  "high": "5問すべてを解説・画像から重要単語[重要単語]の説明を求めたり理由を確認する問題にしてください。"
}
```

**モジュール分割後の各ファイルの責務**

| ファイル | 行数目安 | 責務 |
|---|---|---|
| `client.js` | 30行 | APIキー CRUD + Anthropicクライアント生成 |
| `generateQuiz.js` | 80行 | メタデータ → コンテンツブロック組立 → API呼出 → JSON解析 |
| `generateVisual.js` | 60行 | メタデータ → API呼出 → HTML組立（`buildVisualHtml`含む） |
| `validateAnswer.js` | 40行 | 問題＋回答 → API呼出 → 判定結果返却 |
| `parseResponse.js` | 20行 | コードブロック除去・JSON抽出・配列抽出のフォールバック |
| `blobToBase64.js` | 25行 | Blob URL → {base64, mediaType} 変換 |

合計 255行（現在270行と同等）だが、1ファイルの最大が80行になる。

### 【高】共通ユーティリティの抽出

```
src/utils/
├── normalize.js       （全角半角・大文字小文字統一）
├── format.js          （formatTime, trackNum, stripExt）
├── escapeHtml.js
└── blobToBase64.js    （claudeApi.js から移動）
```

`quizStore.js` と `TrackDetailView.vue` の `normalize` 重複を解消し、将来の不一致バグを予防する。

### 【中】デッドコードの削除

- `components/HelloWorld.vue`、`assets/vue.svg`、`assets/vite.svg` を削除
- `data/quizQuestions.json` を削除（未使用確認後）
- `services/visualHtmlFrame.html` を削除または役割を明確化
- `TrackDetailView.vue` のコメントアウト済みテンプレートを削除

**即効性あり・バンドル数十KB削減・30分作業。**

### 【中】依存の削減

- **`marked`**: Markdown 解説タブを復活させないなら完全削除
- **`@anthropic-ai/sdk`**: `fetch` での直接呼び出しに置換。使っているのは `messages.create` のみなので移行容易
- **`jsmediatags`**: 既に `parseId3v2Frames` で独自パーサを書いているので、`title / artist / album` 等も自前で取れば削除可能

### 【中】永続化戦略の見直し

現状、`visualStore` と `prefetchCache` で永続化層が不統一。

- `visualStore`: localStorage（pinia-plugin-persistedstate デフォルト）
- `prefetchCache`: IndexedDB

**方針候補:**

- A案: `visualStore` を IndexedDB に移行（`prefetchCache.js` と同じパターン）
- B案: `pinia-plugin-persistedstate` に IndexedDB アダプタを設定

---

## 着手順のおすすめ

| 順 | 作業 | 所要時間 | 効果 |
|---|---|---|---|
| 1 | デッドコード削除 | 30分 | 即効性あり・バンドル数十KB減 |
| 2 | `utils/` 共通化（normalize等） | 1時間 | バグ予防 |
| 3 | `claudeApi.js` → プロンプト分離 + モジュール分割 | 2〜3時間 | 保守性大幅改善 |
| 4 | TrackDetailView を Composable + 子コンポーネントに分割 | 半日 | **最大の効果** |
| 5 | `@anthropic-ai/sdk` → fetch 置換 | 1〜2時間 | バンドル大幅減 |
| 6 | 永続化戦略の統一 | 半日 | 中長期の安定性 |

---

## リファクタリング後の全体構成（ゴールイメージ）

```
src/
├── main.js
├── App.vue
├── style.css
│
├── views/
│   ├── HomeView.vue
│   ├── TrackDetailView.vue          ← 1,000行 → 200行
│   ├── SettingsView.vue
│   └── OAuthCallbackView.vue
│
├── components/
│   ├── ImageViewer.vue
│   └── track/                       ← NEW
│       ├── PlayerBar.vue
│       ├── TrackInfoTab.vue
│       ├── TrackImagesTab.vue
│       ├── TrackVisualTab.vue
│       └── TrackQuizTab.vue
│
├── composables/                     ← NEW
│   ├── useAudioPlayer.js
│   ├── useTrackLoader.js
│   ├── useQuizSession.js
│   └── useVisualTooltip.js
│
├── prompts/                         ← NEW
│   ├── quizSystem.txt
│   ├── quizDifficulty.json
│   ├── visualSystem.txt
│   └── validateAnswer.txt
│
├── services/
│   ├── ai/                          ← claudeApi.js を分割
│   │   ├── client.js
│   │   ├── generateQuiz.js
│   │   ├── generateVisual.js
│   │   ├── validateAnswer.js
│   │   └── parseResponse.js
│   ├── dropboxAuth.js
│   ├── dropboxFiles.js
│   ├── trackMetadata.js
│   └── prefetchCache.js
│
├── stores/
│   ├── trackMetadataStore.js
│   ├── albumCollapseStore.js
│   ├── quizStore.js
│   └── visualStore.js
│
├── utils/                           ← NEW
│   ├── normalize.js
│   ├── format.js
│   ├── escapeHtml.js
│   └── blobToBase64.js
│
└── stubs/
    └── react-native-fs.js
```

---

## 期待効果まとめ

- **バンドルサイズ**: SDK 置換＋デッドコード削除で数百KB減
- **保守性**: 最大ファイルが 1,000行 → 200行へ / プロンプト修正にJS知識不要
- **拡張性**: Composable 化により機能追加時の影響範囲を局所化 / 難易度追加がJSON編集のみ
- **レビュー効率**: プロンプト変更とロジック変更がGit diffで明確に分離
- **安定性**: 永続化層統一と上限設計の見直しで localStorage 溢れリスクを排除
