import jsmediatags from 'jsmediatags'
import { getDropboxClient } from './dropboxAuth'

export async function getDownloadUrl(path) {
  const dbx = getDropboxClient()
  const res = await dbx.filesGetTemporaryLink({ path })
  return res.result.link
}

/** URL から ID3 タグを jsmediatags でパース（テキスト系メタ） */
function parseId3(url) {
  return new Promise((resolve, reject) => {
    jsmediatags.read(url, {
      onSuccess: (tag) => resolve(tag.tags),
      onError: (err) => reject(new Error(err.info ?? String(err))),
    })
  })
}

/** synchsafe integer → 通常の数値 */
function decodeSynchsafe(b0, b1, b2, b3) {
  return ((b0 & 0x7f) << 21) | ((b1 & 0x7f) << 14) | ((b2 & 0x7f) << 7) | (b3 & 0x7f)
}

/** encoding に応じた TextDecoder を返す */
function decoderFor(encoding) {
  if (encoding === 1) return new TextDecoder('utf-16')
  if (encoding === 2) return new TextDecoder('utf-16be')
  if (encoding === 3) return new TextDecoder('utf-8')
  return new TextDecoder('latin1')
}

/** encoding に応じたヌル終端をスキップして文字列と次の pos を返す */
function readNullTerminated(bytes, pos, end, encoding) {
  const isWide = encoding === 1 || encoding === 2
  const start = pos
  if (isWide) {
    while (pos + 1 < end && (bytes[pos] !== 0 || bytes[pos + 1] !== 0)) pos += 2
    const str = decoderFor(encoding).decode(bytes.slice(start, pos))
    return { str, next: pos + 2 }
  } else {
    while (pos < end && bytes[pos] !== 0) pos++
    const str = decoderFor(encoding).decode(bytes.slice(start, pos))
    return { str, next: pos + 1 }
  }
}

/**
 * ArrayBuffer から ID3v2 フレームをすべて走査し
 * APIC → ObjectURL[]、COMM → { descriptor, text }[] を返す
 */
function parseId3v2Frames(buffer) {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  const pictures = []
  const commFrames = []

  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return { pictures, commFrames }
  }

  const id3Size = decodeSynchsafe(bytes[6], bytes[7], bytes[8], bytes[9])
  const extendedHeader = (bytes[5] & 0x40) !== 0
  let offset = extendedHeader ? 10 + view.getUint32(10) : 10
  const end = 10 + id3Size
  const latin1 = new TextDecoder('latin1')

  while (offset + 10 <= end) {
    const frameId = String.fromCharCode(bytes[offset], bytes[offset+1], bytes[offset+2], bytes[offset+3])
    if (frameId === '\0\0\0\0') break

    const frameSize = view.getUint32(offset + 4)
    const dataStart = offset + 10
    const dataEnd = dataStart + frameSize

    // ── APIC ──────────────────────────────────────────────
    if (frameId === 'APIC' && frameSize > 4) {
      const encoding = bytes[dataStart]
      let pos = dataStart + 1

      // MIME type (always latin1, null-terminated)
      const mimeStart = pos
      while (pos < dataEnd && bytes[pos] !== 0) pos++
      const mimeType = latin1.decode(bytes.slice(mimeStart, pos))
      pos++ // skip null

      const pictureType = bytes[pos]
      pos++ // picture type byte

      // description
      const { next } = readNullTerminated(bytes, pos, dataEnd, encoding)
      pos = next

      const picData = bytes.slice(pos, dataEnd)
      const blob = new Blob([picData], { type: mimeType || 'image/jpeg' })
      pictures.push({ url: URL.createObjectURL(blob), pictureType })
    }

    // ── COMM ──────────────────────────────────────────────
    if (frameId === 'COMM' && frameSize > 4) {
      try {
        const encoding = bytes[dataStart]
        const lang = latin1.decode(bytes.slice(dataStart + 1, dataStart + 4))
        let pos = dataStart + 4

        // descriptor (short content description)
        const { str: descriptor, next } = readNullTerminated(bytes, pos, dataEnd, encoding)
        pos = next

        // text (rest of frame)
        const text = decoderFor(encoding).decode(bytes.slice(pos, dataEnd))

        commFrames.push({ descriptor, lang, text })
      } catch (e) {
        console.warn('[trackMetadata] COMM parse error:', e)
      }
    }

    offset = dataStart + frameSize
  }

  return { pictures, commFrames }
}

/** descriptor === "transcribedTextPreview" の COMM フレームの text を返す */
function getTranscribedTextPreview(commFrames) {
  try {
    const target = commFrames.find(
      (c) => c.descriptor === 'transcribedTextPreview' || c.description === 'transcribedTextPreview'
    )
    return target?.text || null
  } catch (e) {
    console.warn('[trackMetadata] transcribedTextPreview取得失敗:', e)
    return null
  }
}

/** Ranged fetch で ID3 タグ部分のみ取得（最大 4MB） */
async function fetchId3Buffer(url) {
  const res = await fetch(url, { headers: { Range: 'bytes=0-4194303' } })
  return res.arrayBuffer()
}

/**
 * トラックのメタデータをすべて取得
 */
export async function fetchTrackMetadata(path) {
  const url = await getDownloadUrl(path)

  const [tags, id3Buffer] = await Promise.all([
    parseId3(url).catch((e) => { console.warn('[trackMetadata] jsmediatags:', e.message); return {} }),
    fetchId3Buffer(url),
  ])

  const { pictures, commFrames } = parseId3v2Frames(id3Buffer)
  const transcribedTextPreview = getTranscribedTextPreview(commFrames)
  const lyrics = tags.lyrics?.lyrics ?? tags.USLT?.text ?? null

  // pictureType 3 = Front Cover（アルバムアート）、それ以外は追加画像
  const albumPictures = pictures.filter((p) => p.pictureType === 3).map((p) => p.url)
  const extraPictures = pictures.filter((p) => p.pictureType !== 3).map((p) => p.url)
  // アルバムアートがなければ全画像をアルバムアートとして扱う
  const finalAlbumPictures = albumPictures.length > 0 ? albumPictures : pictures.map((p) => p.url)
  const finalExtraPictures = albumPictures.length > 0 ? extraPictures : []

  return {
    title:                 tags.title  ?? null,
    artist:                tags.artist ?? null,
    album:                 tags.album  ?? null,
    date:                  tags.year   ?? null,
    trackNumber:           tags.track  ?? null,
    lyrics,
    pictures:              finalAlbumPictures,
    extraPictures:         finalExtraPictures,
    transcribedTextPreview,
    audioUrl:              url,
  }
}
