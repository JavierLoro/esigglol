import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({ UPLOADS_DIR: 'C:/test-uploads' }))

import { getUploadFilename, resolveUploadPath, uploadUrl } from '@/lib/upload-files'

describe('upload file path safety', () => {
  it('rejects traversal and absolute path forms', () => {
    expect(resolveUploadPath('../secret.png')).toBeNull()
    expect(resolveUploadPath('..\\secret.png')).toBeNull()
    expect(resolveUploadPath('C:/secret.png')).toBeNull()
    expect(resolveUploadPath('CON.png')).toBeNull()
    expect(resolveUploadPath('logo.png.')).toBeNull()
    expect(getUploadFilename('/api/uploads/../secret.png')).toBeNull()
  })

  it('accepts generated names and maps only managed URLs', () => {
    expect(resolveUploadPath('logo-123.png')).toContain('test-uploads')
    expect(getUploadFilename('/api/uploads/logo-123.png')).toBe('logo-123.png')
    expect(getUploadFilename('/static/logo.png')).toBeNull()
    expect(uploadUrl('logo-123.png')).toBe('/api/uploads/logo-123.png')
  })
})
