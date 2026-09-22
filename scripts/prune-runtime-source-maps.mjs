import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Next's route-level exclusions do not cover instrumentation or middleware.
// Vercel adds the instrumentation trace to every Node function. Its adapter
// packages output before a shell postbuild runs, so use Next's compiler hook.
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

export async function archiveRuntimeSourceMaps(buildDirectory) {
  const serverDirectory = path.resolve(buildDirectory, 'server')
  const archiveDirectory = path.resolve(buildDirectory, 'debug-source-maps', 'server')
  const changes = await pruneRuntimeSourceMaps(buildDirectory)
  let archived = 0
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(file)
      else if (entry.name.endsWith('.map')) {
        const destination = path.join(archiveDirectory, path.relative(serverDirectory, file))
        await mkdir(path.dirname(destination), { recursive: true })
        await rename(file, destination)
        archived++
      }
    }
  }
  // Webpack/Sentry uploads have completed. Move debugging artifacts outside
  // runtime output before Next's final tracing and Vercel's packaging run.
  // Runtime JS, debug IDs and third-party dependency files remain unchanged.
  await visit(serverDirectory)
  return { archived, traces: changes }
}
