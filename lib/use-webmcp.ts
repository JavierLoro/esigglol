'use client'

import { useEffect, useRef } from 'react'
import { registerWebMCPTools, type WebMCPContext, type WebMCPTool } from './webmcp'

export function useWebMCP(tools: WebMCPTool[], scope: string) {
  const current = useRef(tools)
  useEffect(() => { current.current = tools })
  const names = tools.map(tool => tool.name).join(',')
  useEffect(() => {
    const context = (document as Document & { modelContext?: WebMCPContext }).modelContext
    if (!context) return
    const unregister = registerWebMCPTools(context, current.current.map(tool => ({
      ...tool,
      execute: (input, options) => {
        const latest = current.current.find(item => item.name === tool.name)
        return latest ? latest.execute(input, options) : Promise.resolve(JSON.stringify({ ok: false, code: 'UNAVAILABLE' }))
      },
    })))
    window.addEventListener('admin-session-expired', unregister)
    return () => { unregister(); window.removeEventListener('admin-session-expired', unregister) }
  }, [names, scope])
}

export function useWebMCPNavigationGuard(blocked: boolean) {
  useEffect(() => {
    const guard = (event: Event) => { if (blocked) event.preventDefault() }
    window.addEventListener('admin-webmcp-navigate', guard)
    return () => window.removeEventListener('admin-webmcp-navigate', guard)
  }, [blocked])
}
