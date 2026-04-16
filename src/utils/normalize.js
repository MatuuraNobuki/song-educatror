/**
 * 回答比較用の正規化。
 * トリム→空白除去→小文字化→全角英数を半角に変換する。
 */
export function normalize(str) {
  return str
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
}
