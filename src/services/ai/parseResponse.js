/**
 * AIレスポンスのテキストから JSON を抽出する。
 * コードブロックで囲まれていた場合も対応。
 * @param {string} rawText
 * @returns {any} パース済みJSON
 */
export function parseJson(rawText) {
  let jsonText = rawText.trim()
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) jsonText = fenceMatch[1].trim()

  try {
    return JSON.parse(jsonText)
  } catch {
    const arrayMatch = jsonText.match(/\[[\s\S]*\]/)
    if (arrayMatch) return JSON.parse(arrayMatch[0])
    const objectMatch = jsonText.match(/\{[\s\S]*?\}/)
    if (objectMatch) return JSON.parse(objectMatch[0])
    throw new Error('JSONの解析に失敗しました。')
  }
}
