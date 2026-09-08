/** Bound request bodies before parsing; never log business content. */
export async function freeJsonBody(request: Request): Promise<unknown> {
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) throw new Error('FREE_ACCESS_DENIED')
  if (Number(request.headers.get('content-length')) > 100_000) throw new Error('FREE_INVALID_INPUT')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('FREE_INVALID_INPUT')
  const chunks: Uint8Array[] = []; let length=0
  try {
    for (;;) { const {done,value}=await reader.read(); if(done) break; length+=value.byteLength
      if(length>100_000) { await reader.cancel(); throw new Error('FREE_INVALID_INPUT') }; chunks.push(value) }
    const bytes=new Uint8Array(length); let offset=0
    for(const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.byteLength }
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch { throw new Error('FREE_INVALID_INPUT') } finally { reader.releaseLock() }
}
