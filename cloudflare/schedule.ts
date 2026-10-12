import { getRuntime } from './context'

export async function scheduleWork(when = Date.now() + 1000): Promise<void> {
  const { storage } = getRuntime().state
  const existing = await storage.getAlarm()
  if (existing === null || existing > when) await storage.setAlarm(when)
}
