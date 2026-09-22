import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { archiveRuntimeSourceMaps, pruneRuntimeSourceMaps } from '../scripts/prune-runtime-source-maps.mjs'

const temporaryDirectories: string[] = []
afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

it('keeps runtime files, dependency maps and on-disk upload maps while pruning generated server maps', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'runtime-traces-'))
  temporaryDirectories.push(root)
  const build = path.join(root, '.next')
  await mkdir(path.join(build, 'server'), { recursive: true })
  const sourceMap = path.join(build, 'server', 'instrumentation.js.map')
  await writeFile(sourceMap, 'upload artifact')
  const files = ['instrumentation.js', 'instrumentation.js.map', 'proxy.js.map',
    '../../node_modules/library/runtime.js', '../../node_modules/library/runtime.js.map',
    '../server-other/keep.map', 'manifest.json']
  const trace = path.join(build, 'server', 'instrumentation.js.nft.json')
  await writeFile(trace, JSON.stringify({ version: 1, files }))
  const rootTrace = path.join(build, 'next-server.js.nft.json')
  await writeFile(rootTrace, JSON.stringify({ version: 1, files: ['server/instrumentation.js.map', '../node_modules/next/server.js'] }))
  await pruneRuntimeSourceMaps(build)
  expect(JSON.parse(await readFile(trace, 'utf8'))).toEqual({ version: 1,
    files: files.filter(file => !['instrumentation.js.map', 'proxy.js.map'].includes(file)) })
  expect(JSON.parse(await readFile(rootTrace, 'utf8')).files).toEqual(['../node_modules/next/server.js'])
  expect(await readFile(sourceMap, 'utf8')).toBe('upload artifact')
  expect(await pruneRuntimeSourceMaps(build)).toEqual([])
  await writeFile(path.join(build, 'server', 'instrumentation.js'), 'runtime code')
  expect((await archiveRuntimeSourceMaps(build)).archived).toBe(1)
  expect(await readFile(path.join(build, 'debug-source-maps/server/instrumentation.js.map'), 'utf8')).toBe('upload artifact')
  await expect(readFile(sourceMap)).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readFile(path.join(build, 'server', 'instrumentation.js'), 'utf8')).toBe('runtime code')
  expect((await archiveRuntimeSourceMaps(build)).archived).toBe(0)
})
