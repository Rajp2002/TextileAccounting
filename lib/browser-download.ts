export type BrowserDownloadResult = {
  filename: string
  objectUrl: string
}

/**
 * Starts a browser download and defers URL cleanup until the click has been
 * dispatched. Returning the filename/object URL makes completion observable
 * to callers and deterministic in regression tests.
 */
export function downloadBlob(blob: Blob, filename: string): BrowserDownloadResult {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.hidden = true
  document.body.appendChild(anchor)

  try {
    anchor.click()
  } finally {
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
  }

  return { filename, objectUrl }
}

export function downloadJson(payload: unknown, filename: string) {
  return downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    filename,
  )
}
