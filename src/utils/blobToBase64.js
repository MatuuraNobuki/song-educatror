/**
 * Blob URL を base64 文字列と mediaType に変換する。
 * マジックバイトから実際の画像形式を判定する（blob.type は信頼しない）。
 * @param {string} blobUrl
 * @returns {Promise<{ base64: string, mediaType: string }>}
 */
export async function blobUrlToBase64(blobUrl) {
  const resp = await fetch(blobUrl)
  const blob = await resp.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result
      const base64 = dataUrl.split(',')[1]

      const binary = atob(base64.slice(0, 16))
      const bytes = Array.from(binary).map(c => c.charCodeAt(0))
      let mediaType
      if (bytes[0] === 0xff && bytes[1] === 0xd8) {
        mediaType = 'image/jpeg'
      } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        mediaType = 'image/png'
      } else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
        mediaType = 'image/gif'
      } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
                 bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
        mediaType = 'image/webp'
      } else {
        mediaType = blob.type || 'image/jpeg'
      }

      resolve({ base64, mediaType })
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
