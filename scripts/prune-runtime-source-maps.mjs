import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Next's route-level exclusions do not cover instrumentation or middleware.
// Vercel adds the instrumentation trace to every Node function. Run only after
// next build (and Sentry's uploads) completes. Keep maps on disk for debugging;
// remove only generated server-map references from deployment trace manifests.
export async function pruneRuntimeSourceMaps(buildDirectory) {
  const serverDirectory = path.resolve(buildDirectory, 'server')
  const changes = []
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === 'cache' || entry.name === 'dev') continue
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(file)
      } else if (entry.name.endsWith('.nft.json')) {
        const manifest = JSON.parse(await readFile(file, 'utf8'))
        if (!Array.isArray(manifest.files) || manifest.files.some(item => typeof item !== 'string')) {
          throw new Error(`Invalid output trace: ${file}`)
        }
        const kept = manifest.files.filter(relative => {
          const resolved = path.resolve(path.dirname(file), relative)
          return !(resolved.startsWith(`${serverDirectory}${path.sep}`) && resolved.endsWith('.map'))
        })
        if (kept.length !== manifest.files.length) {
          changes.push({ trace: path.relative(buildDirectory, file), removed: manifest.files.length - kept.length })
          await writeFile(file, JSON.stringify({ ...manifest, files: kept }))
        }
      }
    }
  }
  await visit(path.resolve(buildDirectory))
  return changes
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log('[build] Excluded generated server source maps from runtime traces:',
    await pruneRuntimeSourceMaps(path.resolve('.next')))
}
