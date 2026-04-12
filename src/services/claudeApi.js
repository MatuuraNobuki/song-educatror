import Anthropic from '@anthropic-ai/sdk'

const STORAGE_KEY = 'claude_api_key'

export function saveApiKey(apiKey) {
  localStorage.setItem(STORAGE_KEY, apiKey)
}

export function loadApiKey() {
  return localStorage.getItem(STORAGE_KEY) ?? ''
}

export function clearApiKey() {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Anthropic クライアントを生成して返す。
 * APIキーが未設定の場合は null を返す。
 */
export function createClient() {
  const apiKey = loadApiKey()
  if (!apiKey) return null

  return new Anthropic({
    apiKey,
    // Capacitor（ブラウザ環境）から直接呼び出すため必要
    dangerouslyAllowBrowser: true,
  })
}

/**
 * Blob URL を base64 に変換する
 */
async function blobUrlToBase64(blobUrl) {
  const resp = await fetch(blobUrl)
  const blob = await resp.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1]
      resolve({ base64, mediaType: blob.type || 'image/jpeg' })
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * 楽曲メタデータをもとに Claude でクイズ10問を生成する。
 * @param {object} meta - { title, artist, lyrics, transcribedTextPreview, extraPictures }
 * @returns {Promise<Array>} QuizQuestion[]
 */
export async function generateQuizQuestions(meta) {
  const client = createClient()
  if (!client) throw new Error('APIキーが設定されていません。設定画面からAPIキーを登録してください。')

  // テキスト情報を組み立て
  const textParts = []
  if (meta.title)  textParts.push(`【曲名】${meta.title}`)
  if (meta.artist) textParts.push(`【アーティスト】${meta.artist}`)
  if (meta.lyrics) textParts.push(`【歌詞】\n${meta.lyrics}`)
  if (meta.transcribedTextPreview) textParts.push(`【解説・楽曲情報】\n${meta.transcribedTextPreview}`)

  const userText = textParts.length
    ? textParts.join('\n\n')
    : '楽曲情報が提供されていません。一般的な音楽理論の問題を10問作成してください。'

  // メッセージのコンテンツブロックを組み立て
  const contentBlocks = []

  // 画像（最大3枚）
  if (meta.extraPictures?.length) {
    for (const picUrl of meta.extraPictures.slice(0, 3)) {
      try {
        const { base64, mediaType } = await blobUrlToBase64(picUrl)
        // Anthropic が受け付けるメディアタイプのみ
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        if (!allowed.includes(mediaType)) continue
        contentBlocks.push({
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        })
      } catch {
        // 変換失敗は無視
      }
    }
  }

  contentBlocks.push({ type: 'text', text: userText })

  const systemPrompt = `あなたは音楽教育アプリのクイズ作成AIです。
提供された楽曲情報（歌詞・解説・画像など）をもとに、学習に役立つ入力式クイズを正確に10問作成してください。

以下のJSON配列形式のみで出力してください。マークダウンコードブロックや余分な説明は不要です:
[
  {
    "id": 1,
    "question": "問題文",
    "answer": "答え",
    "hint": "ヒント（短く）"
  }
]

条件:
- 問題は楽曲の内容・歌詞・背景知識・画像の内容から出題する
- 答えは短く明確（単語〜短文）にする
- 同じ問いを繰り返さない
- idは1〜10の連番にする
- JSONのみ出力する`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: contentBlocks }],
  })

  const rawText = message.content[0].text.trim()

  // JSON パース（コードブロックで囲まれていた場合も考慮）
  let jsonText = rawText
  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) jsonText = fenceMatch[1].trim()

  let questions
  try {
    questions = JSON.parse(jsonText)
  } catch {
    const arrayMatch = jsonText.match(/\[[\s\S]*\]/)
    if (!arrayMatch) throw new Error('クイズの生成に失敗しました。もう一度お試しください。')
    questions = JSON.parse(arrayMatch[0])
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('クイズの生成に失敗しました。もう一度お試しください。')
  }

  return questions
}
