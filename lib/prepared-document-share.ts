type FileShareNavigator = Pick<Navigator, 'share' | 'canShare'>

export type PreparedDocumentShareResult = 'shared' | 'cancelled' | 'unsupported'

/** Only offer file sharing when the device confirms it supports this file. */
export function canSharePreparedFile(file: File, device: FileShareNavigator = navigator) {
  try {
    return typeof device.share === 'function' && typeof device.canShare === 'function' && device.canShare({ files: [file] })
  } catch {
    return false
  }
}

function wasCancelled(error: unknown) {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
}

/** Call directly from a user gesture; no asynchronous preparation precedes share. */
export async function sharePreparedDocument(
  data: ShareData & { files: File[] },
  device: FileShareNavigator = navigator,
): Promise<PreparedDocumentShareResult> {
  if (!data.files.length || !data.files.every(file => canSharePreparedFile(file, device))) return 'unsupported'
  try {
    // This call happens synchronously, before the first await yields the gesture.
    await device.share(data)
    return 'shared'
  } catch (error) {
    if (wasCancelled(error)) return 'cancelled'
    throw error
  }
}
