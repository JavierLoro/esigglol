'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AutoRefresh({ interval = 30 }: { interval?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), interval * 1000)
    return () => clearInterval(id)
  }, [router, interval])
  return null
}
