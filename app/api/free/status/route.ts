import { freeStatus, freeError } from '@/lib/free-service'
export const dynamic = 'force-dynamic'
export async function GET() {
  try { return Response.json(await freeStatus(),{headers:{'Cache-Control':'private, no-store, max-age=0'}}) }
  catch(error) { return freeError(error) }
}
