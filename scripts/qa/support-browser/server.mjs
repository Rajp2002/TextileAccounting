// Synthetic component transport only; no auth, provider or database connections.
import {createServer} from 'vite'
import path from 'node:path'
if(!process.argv.includes('--enable-synthetic-fixtures'))throw new Error('Explicit --enable-synthetic-fixtures required')
const root=path.resolve('scripts/qa/support-browser')
const server=await createServer({root,configFile:false,mode:'development',esbuild:{jsx:'automatic'},resolve:{alias:[{find:'@',replacement:process.cwd()},{find:'next/link',replacement:path.join(root,'link.tsx')}]},server:{host:'127.0.0.1',port:4186,strictPort:true,fs:{allow:[process.cwd()]}}})
await server.listen()
console.info('Synthetic support component fixture: http://127.0.0.1:4186 (no authentication evidence)')
