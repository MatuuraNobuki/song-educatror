import Anthropic from "@anthropic-ai/sdk";

const STORAGE_KEY = "claude_api_key";

export function saveApiKey(apiKey) {
  localStorage.setItem(STORAGE_KEY, apiKey);
}

export function loadApiKey() {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function clearApiKey() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Anthropic クライアントを生成して返す。
 * APIキーが未設定の場合は null を返す。
 */
export function createClient() {
  const apiKey = loadApiKey();
  if (!apiKey) return null;

  return new Anthropic({
    apiKey,
    // Capacitor（ブラウザ環境）から直接呼び出すため必要
    dangerouslyAllowBrowser: true,
  });
}

/**
 * Blob URL を base64 に変換する
 */
async function blobUrlToBase64(blobUrl) {
  const resp = await fetch(blobUrl);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(",")[1];

      // マジックバイトから実際の形式を判定（blob.type は信頼しない）
      const binary = atob(base64.slice(0, 16));
      const bytes = Array.from(binary).map((c) => c.charCodeAt(0));
      let mediaType;
      if (bytes[0] === 0xff && bytes[1] === 0xd8) {
        mediaType = "image/jpeg";
      } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        mediaType = "image/png";
      } else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
        mediaType = "image/gif";
      } else if (
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
      ) {
        mediaType = "image/webp";
      } else {
        mediaType = blob.type || "image/jpeg";
      }

      resolve({ base64, mediaType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** 難易度別システムプロンプト */
const DIFFICULTY_PROMPTS = {
  low: `5問すべてを以下の形式の歌詞穴埋め問題にしてください。
- "穴埋め：\\n\\nあの(________)のすきとおった風、\\n夏でも底に冷たさをもつ(________)"
  - 歌詞は原文ママで表示し、原文ママで回答させること
  - 複数箇所の穴埋めを求めるときはカンマ区切りで回答させる`,

  medium: `5問すべてを解説・画像から重要単語[重要単語]を答えさせる問題にしてください。`,

  high: `5問すべてを解説・画像から重要単語[重要単語]の説明を求めたり理由を確認する、中程度の文章で回答させる問題にしてください。`,
}

/**
 * 楽曲メタデータをもとに Claude でクイズ5問を生成する。
 * @param {object} meta - { title, artist, lyrics, transcribedTextPreview, extraPictures }
 * @param {Array} [previousQuestions] - 再生成時に除外させる既存の問題一覧
 * @param {'low'|'medium'|'high'} [difficulty] - 難易度
 * @returns {Promise<Array>} QuizQuestion[]
 */
export async function generateQuizQuestions(meta, previousQuestions = null, difficulty = 'medium') {
  const client = createClient();
  if (!client) throw new Error("APIキーが設定されていません。設定画面からAPIキーを登録してください。");

  // テキスト情報を組み立て
  const textParts = [];
  if (meta.lyrics) textParts.push(`【歌詞】\n${meta.lyrics}`);
  if (difficulty !== 'low' && meta.transcribedTextPreview) textParts.push(`【解説・楽曲情報】\n${meta.transcribedTextPreview}`);
  if (previousQuestions?.length) {
    const prevList = previousQuestions.map((q, i) => `${i + 1}. ${q.question}`).join("\n");
    textParts.push(`【作成済みの問題（これらとは異なる問題を作成すること）】\n${prevList}`);
  }

  const userText = textParts.length ? textParts.join("\n\n") : "楽曲情報が提供されていません。一般的な音楽理論の問題を5問作成してください。";

  // メッセージのコンテンツブロックを組み立て
  const contentBlocks = [];

  // 画像（最大10枚）low難易度では使用しない
  if (difficulty !== 'low' && meta.extraPictures?.length) {
    for (const picUrl of meta.extraPictures.slice(0, 10)) {
      try {
        const { base64, mediaType } = await blobUrlToBase64(picUrl);
        // Anthropic が受け付けるメディアタイプのみ
        const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!allowed.includes(mediaType)) continue;
        contentBlocks.push({
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64 },
        });
      } catch {
        // 変換失敗は無視
      }
    }
  }

  contentBlocks.push({ type: "text", text: userText });

  const difficultyInstruction = DIFFICULTY_PROMPTS[difficulty] ?? DIFFICULTY_PROMPTS.medium

  const systemPrompt = `あなたは音楽教育アプリのクイズ作成AIです。
提供された楽曲情報（歌詞・解説・画像など）をもとに、学習に役立つ入力式クイズを正確に5問作成してください。

${difficultyInstruction}

[重要単語]:解説資料でアスタリスクに囲まれている太字箇所や#始まりのヘッダーに記載されているもの

以下のJSON配列形式のみで出力してください。マークダウンコードブロックや余分な説明は不要です:
[
  {
    "id": 1,
    "question": "問題文",
    "answers": ["正解1", "正解2", "表記ゆれ例"],
    "hint": "ヒント（短く）"
  }
]

answersフィールドのルール:
- 必ず配列で指定する（1つだけでも配列にする）
- 表記ゆれ・別表記・略称など、正解とみなすべきすべてのバリエーションを列挙する
  例: 漢字・ひらがな・カタカナ・ローマ字・英語・数字表記など
  例: "ドミソ" → ["ドミソ", "どみそ", "C major", "Cメジャー"]
- 大文字小文字・全角半角の違いはシステム側で吸収するので列挙不要

その他の条件:
- 問題は楽曲の内容・歌詞・背景知識・画像の内容から出題する
- 問題同士で回答が重複しないようにする
- 同じ問いを繰り返さない
- 別の問題同士で回答を重複させない
- idは1〜5の連番にする
- JSONのみ出力する`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: contentBlocks }],
  });

  const rawText = message.content[0].text.trim();

  // JSON パース（コードブロックで囲まれていた場合も考慮）
  let jsonText = rawText;
  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonText = fenceMatch[1].trim();

  let questions;
  try {
    questions = JSON.parse(jsonText);
  } catch {
    const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
    if (!arrayMatch) throw new Error("クイズの生成に失敗しました。もう一度お試しください。");
    questions = JSON.parse(arrayMatch[0]);
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("クイズの生成に失敗しました。もう一度お試しください。");
  }

  return questions;
}

/**
 * 楽曲メタデータから視覚的・インタラクティブな HTML を生成する。
 * @param {object} meta - { title, artist, lyrics, transcribedTextPreview, extraPictures }
 * @returns {Promise<string>} HTML文字列
 */
export async function generateVisualHtml(meta) {
  const client = createClient();
  if (!client) throw new Error("APIキーが設定されていません。設定画面からAPIキーを登録してください。");

  const contentBlocks = [];
  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];

  // メイン画像（配色参照用、最大3枚）
  let hasPictures = false;
  if (meta.pictures?.length) {
    for (const picUrl of meta.pictures.slice(0, 3)) {
      try {
        const { base64, mediaType } = await blobUrlToBase64(picUrl);
        if (!allowed.includes(mediaType)) continue;
        contentBlocks.push({
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64 },
        });
        hasPictures = true;
      } catch {
        // 変換失敗は無視
      }
    }
  }

  // 解説画像（最大10枚）
  if (meta.extraPictures?.length) {
    for (const picUrl of meta.extraPictures.slice(0, 10)) {
      try {
        const { base64, mediaType } = await blobUrlToBase64(picUrl);
        if (!allowed.includes(mediaType)) continue;
        contentBlocks.push({
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64 },
        });
      } catch {
        // 変換失敗は無視
      }
    }
  }

  const textParts = [];
  if (meta.lyrics) textParts.push(`【歌詞】\n${meta.lyrics}`);
  if (meta.transcribedTextPreview) textParts.push(`【解説】\n${meta.transcribedTextPreview}`);

  contentBlocks.push({ type: "text", text: textParts.join("\n\n") });

  const colorInstruction = hasPictures
    ? `冒頭のメイン画像の色調を読み取り、その雰囲気に合った値を設定してください（可読性は必ず確保すること）。`
    : `落ち着いたダークトーンになるよう値を設定してください。`;

  // 歌詞を空行区切りで分割してブロック一覧を作成
  const lyricBlocks = (meta.lyrics ?? "").trim().split(/\n\n+/).map((b) => b.trim()).filter(Boolean);

  const systemPrompt = `あなたは教育アプリのビジュアルデザイナーAIです。
提供された歌詞・解説・画像をもとに、以下のJSONのみを出力してください。

## 出力するJSONの仕様

\`\`\`json
{
  "cssVars": {
    "--color-bg": "#...",
    "--color-bg2": "#...",
    "--color-text": "#...",
    "--color-text-sub": "#...",
    "--color-accent": "#...",
    "--color-accent2": "#...",
    "--color-accent3": "#...",
    "--color-block-bg": "#...",
    "--color-intro-bg": "#...",
    "--color-chorus-bg": "#...",
    "--color-tooltip-bg": "#...",
    "--color-tooltip-text": "#...",
    "--color-underline": "#..."
  },
  "introNote": "楽曲背景の1〜2文（不要なら空文字）",
  "blockLabels": [
    { "blockIndex": 0, "label": "サビ", "isChorus": true },
    { "blockIndex": 1, "label": "Aメロ", "isChorus": false }
  ],
  "annotations": [
    { "word": "共通フレーム", "key": "kyotsu_frame" }
  ],
  "tooltipData": {
    "kyotsu_frame": { "title": "共通フレーム", "body": "1〜2文の説明。" }
  }
}
\`\`\`

## cssVars の指定方針
${colorInstruction}

## blockLabels の指定方針
- 歌詞は空行区切りで ${lyricBlocks.length} ブロックに分かれている（インデックス 0〜${lyricBlocks.length - 1}）
- 各ブロックに「サビ」「Aメロ」「Bメロ」「アウトロ」等のラベルを付ける
- サビ（繰り返しブロック）は isChorus: true にする
- ラベル不要なブロックは blockLabels に含めなくてよい

## annotations の指定方針
- 解説に登場するキーワード・重要語句が歌詞中にあれば列挙する
- 曲のために短縮・変形されているものもあるが、解説と照らし合わせて推測すること
- 同じ語句は1つだけ登録すれば全ブロックに適用される

## tooltipData の指定方針
- key は annotations の key と一致させる
- body は解説から抜き出した簡潔な説明（1〜2文）

## 出力要件
- JSONのみ出力する。コードブロック・マークダウン・余分な説明は不要`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: "user", content: contentBlocks }],
  });

  const rawText = message.content[0].text.trim();
  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenceMatch ? fenceMatch[1].trim() : rawText;
  const aiData = JSON.parse(jsonText);

  return buildVisualHtml(lyricBlocks, aiData);
}

/**
 * 歌詞ブロック配列 + AIデータから { cssVars, bodyHtml, tooltipData } を組み立てる。
 * @param {string[]} lyricBlocks - 空行区切りで分割済みの歌詞ブロック
 * @param {{ cssVars, introNote, blockLabels, annotations, tooltipData }} aiData
 * @returns {{ cssVars: object, bodyHtml: string, tooltipData: object }}
 */
function buildVisualHtml(lyricBlocks, { cssVars = {}, blockLabels = [], annotations = [], tooltipData = {} }) {
  // アノテーション適用：長い語句優先・単一パスで二重ラップなし
  const sortedAnnotations = [...annotations].sort((a, b) => b.word.length - a.word.length);

  function annotateText(text) {
    const out = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (sortedAnnotations.length === 0) return out;

    // HTML エスケープ済みの語句→key マップ
    const escapedToKey = new Map(
      sortedAnnotations.map(({ word, key }) => [
        word.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
        key,
      ])
    );

    // 全語句を OR で繋いだ単一正規表現（左から順に試すので長い語句が先にマッチ）
    const pattern = [...escapedToKey.keys()]
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");

    return out.replace(new RegExp(pattern, "g"), (match) => {
      const key = escapedToKey.get(match);
      return `<span class="annotated" data-key="${key}">${match}</span>`;
    });
  }

  // blockLabels をインデックスで引けるマップに
  const labelMap = Object.fromEntries(blockLabels.map((b) => [b.blockIndex, b]));

  // 歌詞ブロック → HTML
  const blocksHtml = lyricBlocks.map((block, i) => {
    const blockMeta = labelMap[i];
    const isChorus = blockMeta?.isChorus ?? false;
    const label = blockMeta?.label ?? "";
    const lines = block.split("\n");
    const labelHtml = label ? `\n  <span class="block-label">${label}</span>` : "";
    const linesHtml = lines.map((l) => `  <span class="lyric-line">${annotateText(l)}</span>`).join("\n");
    return `<div class="${isChorus ? "lyric-block chorus" : "lyric-block"}">${labelHtml}\n${linesHtml}\n</div>`;
  }).join("\n");

  return { cssVars, bodyHtml: blocksHtml, tooltipData };
}

/**
 * AIなしでプレーンな歌詞HTMLを即時生成する（初期表示用）。
 * デフォルト配色・アノテーションなし。
 * @param {object} meta - { title, lyrics }
 * @returns {string} HTML文字列
 */
export function buildPlainVisualHtml(meta) {
  const lyricBlocks = (meta.lyrics ?? "").trim().split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  return buildVisualHtml(lyricBlocks, {});
}

/**
 * ユーザーが「この答えを正解とする」で申請した回答をAIが検証する。
 * 表記ゆれ・別表記レベルなら許容、明らかな誤答・無関係な回答は棄却。
 * @param {string} question - 問題文
 * @param {string[]} existingAnswers - 現在の正解リスト
 * @param {string} userAnswer - ユーザーが申請した回答
 * @param {object} [context] - { hint?: string, transcribedText?: string }
 * @returns {Promise<{ accepted: boolean, reason?: string }>}
 */
export async function validateAcceptAnswer(question, existingAnswers, userAnswer, context = {}) {
  const client = createClient();
  if (!client) throw new Error("APIキーが設定されていません。");

  const sections = [];
  if (context.transcribedText) {
    sections.push(`【楽曲の解説・背景情報】\n${context.transcribedText}`);
  }
  sections.push(`【問題】\n${question}`);
  if (context.hint) {
    sections.push(`【ヒント】\n${context.hint}`);
  }
  sections.push(`【既存の正解】\n${existingAnswers.join("、")}`);
  sections.push(`【申請された回答】\n${userAnswer}`);

  const prompt = `以下のクイズ問題に対して、ユーザーが「この答えも正解にしてほしい」と申請しました。
楽曲の解説・背景情報、問題文、ヒントをもとに問題の出題意図を正確に把握したうえで判定してください。

${sections.join("\n\n")}

判定基準:
- 許容: 既存の正解と同じ概念を指す表記ゆれ・別表記・略称・同義語
- 棄却: 意味が異なる・問題の出題意図に合わない・内容的に誤り・明らかに適当な入力

以下のJSON形式のみで回答してください（余分な説明は不要）:
許容する場合: {"accepted": true, "reason": "許容の理由（日本語、1〜2文）"}
棄却する場合: {"accepted": false, "reason": "棄却の理由（日本語、1〜2文）"}`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].text.trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*?\}/);
    if (match) return JSON.parse(match[0]);
    return { accepted: false, reason: "AIによる検証に失敗しました。" };
  }
}
