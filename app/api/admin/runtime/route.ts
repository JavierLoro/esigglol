import { requireAdminSession } from '@/lib/auth'
import { runtimeServices } from '@/lib/runtime-services'

export async function GET() {
  const denied = await requireAdminSession()
  if (denied) return denied
  const runtime = runtimeServices()
  return Response.json(runtime ? await runtime.deploymentInfo() : { runtime: 'node', storage: 'sqlite-wal' }, { headers: { 'Cache-Control': 'private, no-store' } })
}
