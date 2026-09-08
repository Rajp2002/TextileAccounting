import {expect,it,vi} from 'vitest'
import {clearFreeLegacyResponses} from '../lib/free-browser-cache'
it('removes unscoped business responses while preserving static assets and unrelated cross-origin entries',async()=>{
 const remove=vi.fn(),removeRequest=vi.fn()
 const storage={keys:async()=>['pages','pages-rsc-v1','apis','cross-origin','weavly-static-assets-v2'],delete:remove,open:async()=>({keys:async()=>[new Request('https://local.test/rest/v1/workers'),new Request('https://fonts.test/font.woff2')],delete:removeRequest})} as unknown as CacheStorage
 await clearFreeLegacyResponses(storage)
 expect(remove.mock.calls.map(call=>call[0])).toEqual(['pages','pages-rsc-v1','apis'])
 expect(removeRequest).toHaveBeenCalledTimes(1)
 expect(removeRequest.mock.calls[0][0].url).toContain('/rest/v1/workers')
})
