// Presentation-only fixture: no auth, API calls, business modules or production data.
import { createServer } from 'vite'
import path from 'node:path'
const root = path.resolve('scripts/qa/navigation-browser')
const server = await createServer({ root, configFile:false, esbuild:{jsx:'automatic'},
 resolve:{alias:[
  {find:'next/navigation',replacement:path.join(root,'router.tsx')},
  {find:'next/link',replacement:path.join(root,'link.tsx')},
  {find:'next/image',replacement:path.join(root,'image.tsx')},
  {find:'@/components/auth/logout-button',replacement:path.join(root,'logout.tsx')},
  {find:'@',replacement:process.cwd()},
 ]}, server:{host:'127.0.0.1',port:4187,strictPort:true,fs:{allow:[process.cwd()]}} })
await server.listen()
console.log('Navigation-only fixture: http://127.0.0.1:4187/owner/stock')
