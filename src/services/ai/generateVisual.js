import { callClaude } from './client'
import { parseJson } from './parseResponse'
import { escapeHtml } from '../../utils/escapeHtml'
import visualSystemPrompt from '../../prompts/visualSystem.txt?raw'

/**
 * 歌詞ブロック配列 + AIデータから { bodyHtml, tooltipData } を組み立てる。
 * @param {string[]} lyricBlocks - 空行区切りで分割済みの歌詞ブロック
 * @param {{ annotations?, tooltipData? }} aiData
 * @returns {{ bodyHtml: string, tooltipData: object }}
 */
function buildVisualHtml(lyricBlocks, { annotations = [], tooltipData = {} }) {
  const sortedAnnotations = [...annotations].sort((a, b) => b.word.length - a.word.length)

  function annotateText(text) {
    const out = escapeHtml(text)
    if (sortedAnnotations.length === 0) return out

    const escapedToKey = new Map(sortedAnnotations.map(({ word, key }) => [escapeHtml(word), key]))
    const pattern = [...escapedToKey.keys()].map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

    return out.replace(new RegExp(pattern, 'g'), match => {
      const key = escapedToKey.get(match)
      return `<span class="annotated" data-key="${key}">${match}</span>`
    })
  }

  const blocksHtml = lyricBlocks
    .map(block => {
      const lines = block.split('\n')
      const linesHtml = lines.map(l => `  <span class="lyric-line">${annotateText(l)}</span>`).join('\n')
      return `<div class="lyric-block">\n${linesHtml}\n</div>`
    })
    .join('\n')

  return { bodyHtml: blocksHtml, tooltipData }
}

/**
 * AIなしでプレーンな歌詞HTMLを即時生成する（初期表示用）。
 * @param {object} meta - { lyrics }
 * @returns {{ bodyHtml: string, tooltipData: object }}
 */
export function buildPlainVisualHtml(meta) {
  const lyricBlocks = (meta.lyrics ?? '')
    .trim()
    .split(/\n\n+/)
    .map(b => b.trim())
    .filter(Boolean)
  return buildVisualHtml(lyricBlocks, {})
}

/**
 * 楽曲メタデータから視覚的・インタラクティブな HTML を生成する。
 * @param {object} meta - { title, artist, lyrics, transcribedTextPreview }
 * @returns {Promise<{ bodyHtml: string, tooltipData: object }>}
 */
export async function generateVisualHtml(meta) {
  const textParts = []
  if (meta.lyrics) textParts.push(`【歌詞】\n${meta.lyrics}`)
  if (meta.transcribedTextPreview) textParts.push(`【解説】\n${meta.transcribedTextPreview}`)

  const lyricBlocks = (meta.lyrics ?? '')
    .trim()
    .split(/\n\n+/)
    .map(b => b.trim())
    .filter(Boolean)

  const message = await callClaude({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: visualSystemPrompt,
    messages: [{ role: 'user', content: textParts.join('\n\n') }],
  })

  const aiData = parseJson(message.content[0].text)
  return buildVisualHtml(lyricBlocks, aiData)
}
