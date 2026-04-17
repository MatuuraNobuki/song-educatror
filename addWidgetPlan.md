# Androidホーム画面ウィジェット 実装計画

アルバムアート・曲タイトル・再生/停止・前/次ボタンを持つ音楽プレイヤーウィジェット。

---

## アーキテクチャ概要

```
Vue (WebView)                          Native Android
──────────────────────────────         ──────────────────────────────
playing / title / albumArt 変化
  → MusicWidgetPlugin.updateState()  → SharedPreferences に保存
                                     → AppWidgetManager.updateAppWidget()
                                              ↓
                                       [ウィジェット表示更新]

ウィジェットボタン押下 ←────────────── BroadcastReceiver
(play/pause / prev / next)                    ↓
  Capacitor.addListener(                MusicWidgetPlugin が
    "widgetAction", handler)              Capacitor に emit
  → togglePlay() / prev / next
```

---

## 作業ステップ

### Step 1 — Androidレイアウト・設定XML（新規作成）

| ファイル | 内容 |
|----------|------|
| `android/app/src/main/res/layout/music_widget.xml` | ウィジェットUI（RemoteViews）: アルバムアート・タイトル・前/停止/再生/次ボタン |
| `android/app/src/main/res/xml/music_widget_info.xml` | ウィジェットサイズ・更新間隔などのメタ情報 |

---

### Step 2 — Javaネイティブ実装（新規作成）

| ファイル | 内容 |
|----------|------|
| `android/app/src/main/java/com/songeducator/app/MusicWidgetProvider.java` | `AppWidgetProvider`: SharedPreferencesから状態を読みウィジェットを描画。ボタンのPendingIntentをBroadcastとして発行 |
| `android/app/src/main/java/com/songeducator/app/MusicWidgetPlugin.java` | Capacitorプラグイン: `updateState()` でSharedPreferencesに保存 → ウィジェット更新。BroadcastReceiverでボタンイベントをJS側にemit |

---

### Step 3 — AndroidManifest.xml 修正

- `MusicWidgetProvider` を `<receiver>` として登録（`APPWIDGET_UPDATE` インテントフィルタ付き）
- `MusicWidgetPlugin` のBroadcastReceiverを登録
- `uses-permission`: `RECEIVE_BOOT_COMPLETED`（任意、起動後ウィジェット復元用）

---

### Step 4 — MainActivity.java 修正

`MusicWidgetPlugin` をCapacitorのプラグインリストに追加。

---

### Step 5 — JSプラグインラッパー（新規作成）

**`src/plugins/musicWidget.js`**

```js
import { registerPlugin } from '@capacitor/core'
const MusicWidgetPlugin = registerPlugin('MusicWidget')

export async function updateWidget({ title, artist, isPlaying, albumArtBase64 }) { ... }
export async function addWidgetActionListener(callback) { ... }
```

---

### Step 6 — 前曲機能の追加（既存ファイル修正）

**`src/views/TrackDetailView.vue`**
- `goToPrevTrack()` を追加（`goToNextTrack` と対称）
- `PlayerBar` に `@prev-track="goToPrevTrack"` を追加

**`src/components/track/PlayerBar.vue`**
- 前曲ボタンを追加（UIには出さない or 出す、要確認）
- `emit('prev-track')` を追加

---

### Step 7 — 状態連携（既存ファイル修正）

**`src/views/TrackDetailView.vue`** または **`src/components/track/PlayerBar.vue`**

- `watch(playing, ...)` で再生状態変化時に `updateWidget()` を呼ぶ
- `watch(() => props.track, ...)` でトラック変化時にタイトル・アルバムアートを更新
- アルバムアートは blob URL → `fetch` → `arrayBuffer` → base64 に変換してから渡す
- `addWidgetActionListener` でウィジェットボタンイベントを受け取り `togglePlay` / `goToPrevTrack` / `goToNextTrack` を呼ぶ

---

## データフロー詳細

### JS → ネイティブ（状態更新）

```
1. playing or track が変化
2. blob URL → fetch → ArrayBuffer → btoa() で base64 化
3. MusicWidgetPlugin.updateState({ title, artist, isPlaying, albumArtBase64 })
4. Java側: SharedPreferences に保存
5. AppWidgetManager.updateAppWidget() でRemoteViews更新
```

### ネイティブ → JS（ボタン操作）

```
1. ウィジェットボタンタップ
2. PendingIntent → BroadcastReceiver 発火
3. MusicWidgetPlugin が Capacitor.getBridge().triggerJSEvent() で emit
4. JS の addWidgetActionListener コールバックが発火
5. action に応じて togglePlay / goToPrevTrack / goToNextTrack を実行
```

### サムネイル（アルバムアート）タップ → アプリ前面表示

サムネイルのタップは他のボタンと異なり、**アプリを前面に出す**のが目的。  
`BroadcastReceiver` ではなく `PendingIntent.getActivity()` を使い、MainActivity を直接起動する。

```java
// MusicWidgetProvider.java 内（updateAppWidget）
Intent openIntent = new Intent(context, MainActivity.class);
openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
PendingIntent openPending = PendingIntent.getActivity(
    context, 0, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
);
views.setOnClickPendingIntent(R.id.widget_album_art, openPending);
```

- `singleTask` / `FLAG_ACTIVITY_SINGLE_TOP` により、起動中なら `onNewIntent` が呼ばれて前面に出るだけ
- アプリが完全終了していれば通常起動
- JS 側に通知不要（アプリを開くだけなので追加処理なし）

---

## 注意事項

- ウィジェットUIはXMLレイアウト（RemoteViews）のみ。Vue/PrimeVueは使えない
- アルバムアートの base64 は容量が大きくなりがちなので、SharedPreferences ではなくファイルに保存する（`getCacheDir()`）
- Capacitorのバージョン確認（プラグイン登録APIがv4/v5で異なる）

---

## アプリ未起動時のウィジェット操作方針

### 前提: なぜ難しいか

音楽再生は WebView 内の HTML audio が担うため、WebView が生きていないと再生できない。  
ただし「アプリが画面に出ていない」状態と「アプリプロセスが完全に死んでいる」状態は別物。

### 状態別の動作設計

| アプリの状態 | ウィジェット操作時の動作 |
|-------------|------------------------|
| **バックグラウンド動作中**（最も多いケース） | アプリ画面を表示せず、BroadcastReceiver が直接 Capacitor ブリッジに命令。音楽がシームレスに制御される |
| **完全終了（プロセスなし）** | アプリを起動するしかない。ただし画面は表示せず即バックグラウンド移行 + 前回の曲を自動再生 |

### Case 1: バックグラウンド動作中（メインケース）

```
[ウィジェットボタン押下]
        ↓
BroadcastReceiver（MusicWidgetPlugin内）
  ↓ ブリッジが生きているか確認（isAppAlive フラグ）
  ↓ YES
bridge.triggerJSEvent("widgetAction", { action: "play"|"prev"|"next" })
        ↓
App.vue の widgetAction リスナーが発火
  → togglePlay / goToPrevTrack / goToNextTrack を実行
  → UIは変わらない、音楽だけ制御される ✓
```

`isAppAlive` はプラグインの `load()` で true、アプリが破棄されたら false にするフラグ。

### Case 2: プロセス完全終了（コールドスタート）

```
[ウィジェットボタン押下]
        ↓
BroadcastReceiver
  ↓ isAppAlive = false
  ↓ pendingAction を SharedPreferences に保存
  ↓ Intent でアプリを起動（FLAG_ACTIVITY_NEW_TASK のみ、前面には出さない）
        ↓
App.vue の onMounted
  → getPendingAction() を呼ぶ
  → action があれば前回のトラックを復元して自動再生
  → Activity は表示されるが、アプリ操作なしに画面を閉じることはAndroidでは不可
```

> **Android の制約**: Android 10 以降、バックグラウンドからの Activity 起動は制限されている。  
> `FLAG_ACTIVITY_NEW_TASK` を使っても、通知やフォアグラウンドサービスなしでは前面に出るのを防ぐだけで  
> Activity 自体の起動は可能。ただしユーザーには一瞬アプリが見える場合がある。  
> **これは許容する**（完全終了からの起動なので稀なケース）。

### SharedPreferences に保存する情報（updateState 呼び出し時）

| キー | 内容 |
|------|------|
| `widget_title` | 曲タイトル |
| `widget_artist` | アーティスト |
| `widget_is_playing` | 再生中かどうか |
| `widget_art_path` | アルバムアート画像ファイルパス（getCacheDir内） |
| `widget_current_index` | albumTracks内の現在インデックス |
| `widget_album_paths` | albumTracks の path_lower を JSON配列で保存 |
| `widget_pending_action` | ボタン押下時のアクション（"play" / "prev" / "next"、読み取り後クリア） |

### MusicWidgetPlugin.java の isAppAlive 管理

```java
private static boolean isAppAlive = false;

@Override
public void load() {
    isAppAlive = true;
}

// App.vue の beforeUnmount から呼ばれる（またはアプリ破棄時）
@PluginMethod
public void setAppAlive(PluginCall call) {
    isAppAlive = call.getBoolean("alive", false);
    call.resolve();
}
```

### App.vue の修正内容

```js
onMounted(async () => {
  MusicWidgetPlugin.setAppAlive({ alive: true })

  // ウィジェットボタンのイベント受信（バックグラウンド中）
  MusicWidgetPlugin.addListener('widgetAction', ({ action }) => {
    if (action === 'play') playerBarRef.value?.togglePlay()
    if (action === 'prev') goToPrevTrack()
    if (action === 'next') goToNextTrack()
  })

  // コールドスタート時のpending action処理
  const { action } = await MusicWidgetPlugin.getPendingAction()
  if (action) {
    // 前回のトラック情報を復元して自動再生
    const state = await MusicWidgetPlugin.getLastState()
    // state.albumPaths と state.currentIndex から selectTrack を呼ぶ
  }
})

onUnmounted(() => {
  MusicWidgetPlugin.setAppAlive({ alive: false })
})
```

### 前曲/次曲をネイティブ側で解決する理由

`widget_album_paths` と `widget_current_index` を保存しておくことで、  
ネイティブ側が prev/next の `trackIndex` を計算して pendingAction に含められる。  
Vue側はインデックスを受け取り、そのトラックに直接ジャンプするだけでよい。

> **注意**: トラックオブジェクト（Dropbox メタデータ）は JS 側にしか存在しない。  
> ネイティブ側は `path_lower` しか持たないため、Vue側で `albumTracks.find(t => t.path_lower === path)` で復元する。  
> アプリ新規起動時は `HomeView` のトラックリストを再ロードしてから該当トラックを開く必要がある（少し時間がかかる）。

---

## ファイル一覧まとめ

| # | ファイル | 新規/修正 |
|---|----------|----------|
| 1 | `android/.../res/layout/music_widget.xml` | 新規 |
| 2 | `android/.../res/xml/music_widget_info.xml` | 新規 |
| 3 | `android/.../MusicWidgetProvider.java` | 新規 |
| 4 | `android/.../MusicWidgetPlugin.java` | 新規 |
| 5 | `android/.../AndroidManifest.xml` | 修正 |
| 6 | `android/.../MainActivity.java` | 修正 |
| 7 | `src/plugins/musicWidget.js` | 新規 |
| 8 | `src/views/TrackDetailView.vue` | 修正 |
| 9 | `src/components/track/PlayerBar.vue` | 修正 |
