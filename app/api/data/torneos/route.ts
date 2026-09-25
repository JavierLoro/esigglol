import { getTournaments } from '@/lib/competitions'
export const dynamic = 'force-dynamic'
export function GET() { return Response.json(getTournaments()) }
