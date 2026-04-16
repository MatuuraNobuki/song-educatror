import { callClaude } from './client'
import validateAnswerPromptBase from '../../prompts/validateAnswer.txt?raw'

/**
 * ユーザーが「この答えを正解とする」で申請した回答をAIが検証する。
 * @param {string} question - 問題文
 * @param {string[]} existingAnswers - 現在の正解リスト
 * @param {string} userAnswer - ユーザーが申請した回答
 * @param {object} [context] - { hint?: string, transcribedText?: string }
 * @returns {Promise<{ accepted: boolean, reason?: string }>}
 */
export async function validateAcceptAnswer(question, existingAnswers, userAnswer, context = {}) {

  const sections = []
  if (context.transcribedText) {
    sections.push(`【楽曲の解説・背景情報】\n${context.transcribedText}`)
  }
  sections.push(`【問題】\n${question}`)
  if (context.hint) {
    sections.push(`【ヒント】\n${context.hint}`)
  }
  sections.push(`【既存の正解】\n${existingAnswers.join('、')}`)
  sections.push(`【申請された回答】\n${userAnswer}`)

  const prompt = validateAnswerPromptBase.replace('{{SECTIONS}}', sections.join('\n\n'))

  const message = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].text.trim()
  try {
    return JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*?\}/)
    if (match) return JSON.parse(match[0])
    return { accepted: false, reason: 'AIによる検証に失敗しました。' }
  }
}
