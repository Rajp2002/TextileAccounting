/** Local component/SQL integration harness; never an application auth bypass.
 * Requires the disposable database retained by STOCK_TEST_KEEP=1 test:stock-db.
 */
import { createServer } from 'vite'
import pg from 'pg'
import path from 'node:path'
const url = new URL(process.env.STOCK_TEST_DATABASE_URL || '')
if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname) || !/^\/weavly_stock_test_\d+$/.test(url.pathname)) throw new Error('Only the disposable local stock-test database is permitted.')
const root = path.resolve('scripts/qa/stock-browser')
const actualActions = path.resolve('app/(dashboard)/owner/stock/actions.ts')
const server = await createServer({ root, configFile: false, esbuild: { jsx: 'automatic' },
    resolve: { alias: [{find: actualActions,replacement:path.join(root,'actions.ts')},{find:'@',replacement:process.cwd()},{find:'next/navigation',replacement:path.join(root,'navigation.ts')},{find:'next/link',replacement:path.join(root,'link.tsx')}] },
    plugins: [{name:'local-stock-actions',enforce:'pre',resolveId(source, importer) {
        if(source==='./actions' && importer?.endsWith('/owner/stock/QualityStockClient.tsx')) return path.join(root,'actions.ts')
    }},{name:'local-stock-db',configureServer(vite) { vite.middlewares.use('/local-stock',async(req,res)=>{
        if(req.method!=='POST'){res.statusCode=405;res.end();return}
        const db=new pg.Client({connectionString:url.href})
        try {
            let raw='';for await(const chunk of req)raw+=chunk
            const input=JSON.parse(raw||'{}');await db.connect();await db.query('set role authenticated')
            await db.query("select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false),set_config('request.jwt.claims','{\"role\":\"authenticated\",\"sub\":\"10000000-0000-4000-8000-000000000001\"}',false)")
            let output
            if(req.url==='/read'){
                const data=(await db.query('select public.get_quality_stock_board($1,$2,$3) result',[input.qualityId??null,input.cursor?.at??null,input.cursor?.id??null])).rows[0].result
                const hasMore=data.movements.length>50;data.movements=data.movements.slice(0,50);const last=data.movements.at(-1);data.nextCursor=hasMore?{at:last.created_at,id:last.id}:null;output={data}
            }else if(req.url==='/adjust'){
                const result=(await db.query('select public.record_quality_stock_adjustment($1,$2,$3,$4,$5,$6) result',[input.qualityLabel,input.meters,input.kind,input.reason,input.clientRequestId,input.expectedMeters??null])).rows[0].result
                output={success:true,duplicate:result.duplicate}
            }else throw new Error('Unknown local stock test endpoint')
            res.setHeader('Content-Type','application/json');res.end(JSON.stringify(output))
        }catch(error){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:error.message,errorKey:error.message.includes('Opening stock')?'openingRecorded':error.code==='40001'?'staleSave':'retrySame'}))}
        finally {await db.end()}
    })} }], server: {host:'127.0.0.1',port:4179,strictPort:true,fs:{allow:[process.cwd()]}} })
await server.listen();console.log('Local stock harness: http://127.0.0.1:4179')
