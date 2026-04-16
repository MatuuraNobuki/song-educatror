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
 * Claude Messages API を直接 fetch で呼び出す。
 * @param {object} payload - messages.create 相当のボディ
 * @returns {Promise<object>} APIレスポンス
 */
export async function callClaude(payload) {
  const apiKey = loadApiKey()
  if (!apiKey) throw new Error('APIキーが設定されていません。設定画面からAPIキーを登録してください。')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Claude API エラー (${res.status}): ${text}`)
  }

  return res.json()
}
