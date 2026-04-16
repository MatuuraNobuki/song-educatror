import { callClaude } from './client'
import { parseJson } from './parseResponse'
import { blobUrlToBase64 } from '../../utils/blobToBase64'
import quizDifficulty from '../../prompts/quizDifficulty.json'
import quizSystemBase from '../../prompts/quizSystem.txt?raw'

/**
 * 楽曲メタデータをもとに Claude でクイズ5問を生成する。
 * @param {object} meta - { title, artist, lyrics, transcribedTextPreview, extraPictures, tooltipData }
 * @param {Array} [previousQuestions] - 再生成時に除外させる既存の問題一覧
 * @param {'low'|'medium'|'high'} [difficulty] - 難易度
 * @returns {Promise<Array>} QuizQuestion[]
 */
export async function generateQuizQuestions(meta, previousQuestions = null, difficulty = 'medium') {

  // テキスト情報を組み立て
  const textParts = []
  if (difficulty === 'low' && meta.lyrics) textParts.push(`【歌詞】\n${meta.lyrics}`)
  if (difficulty === 'high' && meta.transcribedTextPreview) textParts.push(`【解説・楽曲情報】\n${meta.transcribedTextPreview}`)
  if (meta.tooltipData && Object.keys(meta.tooltipData).length) {
    const tooltipLines = Object.values(meta.tooltipData)
      .map(({ title, body }) => `・${title}：${body}`)
      .join('\n')
    if (difficulty === 'medium') textParts.push(`【重要キーワード解説】\n${tooltipLines}`)
  }
  if (previousQuestions?.length) {
    const prevList = previousQuestions.map((q, i) => `${i + 1}. ${q.question}`).join('\n')
    textParts.push(`【作成済みの問題（これらとは異なる問題を作成すること）】\n${prevList}`)
  }

  const userText = textParts.length
    ? textParts.join('\n\n')
    : '楽曲情報が提供されていません。一般的な音楽理論の問題を5問作成してください。'

  // メッセージのコンテンツブロックを組み立て
  const contentBlocks = []

  // 画像（最大10枚）high 難易度のみ
  if (difficulty === 'high' && meta.extraPictures?.length) {
    for (const picUrl of meta.extraPictures.slice(0, 10)) {
      try {
        const { base64, mediaType } = await blobUrlToBase64(picUrl)
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

  const difficultyInstruction = quizDifficulty[difficulty] ?? quizDifficulty.medium
  const systemPrompt = quizSystemBase.replace('{{DIFFICULTY_INSTRUCTION}}', difficultyInstruction)

  const message = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: contentBlocks }],
  })

  const questions = parseJson(message.content[0].text)

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('クイズの生成に失敗しました。もう一度お試しください。')
  }

  return questions
}
