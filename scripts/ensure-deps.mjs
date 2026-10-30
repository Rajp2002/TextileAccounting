#!/usr/bin/env node
// Runs before `npm run dev` (predev). Each checkout and worktree keeps its own node_modules, and
// nothing reinstalls them when package.json gains a dependency, so `next dev` fails later with
// "Module not found". This compares every direct dependency against package-lock.json and runs
// `npm ci` when one is missing or at the wrong version. Set WEAVLY_SKIP_DEPS_CHECK=1 to skip.
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

if (process.env.WEAVLY_SKIP_DEPS_CHECK === '1') process.exit(0)

const root = process.cwd()
const readJson = file => JSON.parse(readFileSync(path.join(root, file), 'utf8'))

const pkg = readJson('package.json')
const lock = readJson('package-lock.json')
const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })

const stale = names.filter(name => {
  const expected = lock.packages?.[`node_modules/${name}`]?.version
  const installedFile = path.join(root, 'node_modules', name, 'package.json')
  if (!existsSync(installedFile)) return true
  if (!expected) return false
  // Some packages publish their version as "v2.0.8", which npm still installs as 2.0.8.
  const installed = String(JSON.parse(readFileSync(installedFile, 'utf8')).version).replace(/^v/, '')
  return installed !== expected
})

if (stale.length === 0) process.exit(0)

console.log(`[ensure-deps] node_modules is out of date with package-lock.json (${stale.slice(0, 5).join(', ')}${stale.length > 5 ? ', …' : ''}). Running npm ci.`)
execSync('npm ci --no-audit --no-fund', { stdio: 'inherit' })
