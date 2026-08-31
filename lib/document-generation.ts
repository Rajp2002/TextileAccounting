/** Keeps asynchronous document work tied to the preview/session that started it. */
export function createDocumentGenerationGuard() {
  let revision = 0
  let currentKey: string | null = null
  return {
    update(key: string | null) {
      currentKey = key
      revision += 1
    },
    begin(key: string) {
      const ticket = { key, revision }
      return () => currentKey === ticket.key && revision === ticket.revision
    },
  }
}
