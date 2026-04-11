import { getDropboxClient } from './dropboxAuth'

function normalizePath(p) {
  return p === '/' ? '' : p.replace(/\/+$/, '')
}

/**
 * 指定パス以下の MP3 ファイルをすべて再帰取得してフラットに返す
 * @param {string} folderPath
 * @returns {object[]} Dropbox file entries（.mp3 のみ）
 */
export async function listAllTracks(folderPath) {
  const dbx = getDropboxClient()
  if (!dbx) throw new Error('Dropbox に接続されていません')

  const tracks = []
  let cursor = null
  let hasMore = true

  while (hasMore) {
    let res
    try {
      res = cursor
        ? await dbx.filesListFolderContinue({ cursor })
        : await dbx.filesListFolder({ path: normalizePath(folderPath), recursive: true })
    } catch (e) {
      const detail = e?.error?.error_summary ?? e?.error ?? e?.message ?? String(e)
      console.error('[Dropbox] filesListFolder error:', detail, '| path:', folderPath)
      throw new Error(`Dropbox エラー: ${detail}`)
    }

    for (const entry of res.result.entries) {
      if (entry['.tag'] === 'file' && entry.name.toLowerCase().endsWith('.mp3')) {
        tracks.push(entry)
      }
    }

    cursor = res.result.cursor
    hasMore = res.result.has_more
  }

  tracks.sort((a, b) => a.path_lower.localeCompare(b.path_lower))
  return tracks
}
