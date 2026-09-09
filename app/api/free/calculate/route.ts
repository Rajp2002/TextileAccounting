import { z } from 'zod'
import { calculateFreeSubmission, freeError } from '@/lib/free-service'
import { freeJsonBody } from '@/lib/free-http'
const submission = z.object({estimate:z.unknown(),label:z.string().trim().min(1).max(120).optional(),requestToken:z.string().max(3000).optional(),warningsAcknowledged:z.boolean().optional()}).strict()
export async function POST(request: Request) {
  try {
    const parsed = submission.safeParse(await freeJsonBody(request))
    if (!parsed.success) throw new Error('FREE_INVALID_INPUT')
    return Response.json(await calculateFreeSubmission({...parsed.data,estimate:parsed.data.estimate}),{headers:{'Cache-Control':'private, no-store, max-age=0'}})
  } catch(error) { return freeError(error) }
}
