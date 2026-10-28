// Local pure-module benchmark loader. Uses installed dependencies; no services.
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { compileFunction } from 'node:vm'
import ts from 'typescript'

const requirePackage = createRequire(import.meta.url)
export function createTypeScriptLoader(readSource = file => readFileSync(file, 'utf8')) {
    const loaded = new Map()
    function load(file) {
        if (loaded.has(file)) return loaded.get(file).exports
        const compiledModule = { exports: {} }
        loaded.set(file, compiledModule)
        const { outputText } = ts.transpileModule(readSource(file), {
            compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
        })
        compileFunction(outputText, ['require', 'module', 'exports'], { filename: file })(
            name => {
                if (!name.startsWith('.')) return requirePackage(name)
                const base = resolve(dirname(file), name)
                return load(existsSync(`${base}.ts`) ? `${base}.ts` : resolve(base, 'index.ts'))
            },
            compiledModule, compiledModule.exports,
        )
        return compiledModule.exports
    }
    return load
}
