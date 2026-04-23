/**
 * В карте/XML в docBinaryText.mediaTypeCode — MEDIATYPENAME (MIME), как в таблице MEDIATYPE и в ответе API (поле name).
 * Расширение для имени файла при скачивании — MEDIATYPECODE: useMediaTypeOptions.getCodeByName(mime).
 */

const MIME_TO_FILE_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/tiff': 'tif',
  'image/gif': 'gif',
  'text/plain': 'txt',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
}

/** MEDIATYPENAME (MIME) из карты → Content-Type для Blob */
export function blobMimeTypeFromDocBinaryMediaTypeCode(stored?: string | null): string {
  const t = stored?.trim()
  if (t && t.includes('/')) return t
  return 'application/octet-stream'
}

export function binaryDownloadSuggestExtension(mime: string): string {
  if (mime === 'application/octet-stream') return 'bin'
  const mapped = MIME_TO_FILE_EXT[mime]
  if (mapped) return mapped
  if (mime.includes('/')) {
    const sub = mime.split('/')[1] ?? 'bin'
    const cleaned = sub.replace(/^vnd\./i, '').replace(/[^a-z0-9]+/gi, '_').slice(0, 16)
    return cleaned || 'bin'
  }
  return 'bin'
}

/**
 * @param storedMediatypeName MEDIATYPENAME (MIME)
 * @param dictionaryCode MEDIATYPECODE из getCodeByName(storedMediatypeName)
 */
export function binaryDownloadFileName(
  storedMediatypeName?: string | null,
  uploadedFileName?: string,
  dictionaryCode?: string | null,
): string {
  const up = uploadedFileName?.trim()
  if (up) return up
  const t = storedMediatypeName?.trim()
  if (!t) return 'document.bin'
  const ext = dictionaryCode?.trim().toLowerCase()
  if (ext) return `document.${ext}`
  if (t.includes('/')) return `document.${binaryDownloadSuggestExtension(t)}`
  return 'document.bin'
}
