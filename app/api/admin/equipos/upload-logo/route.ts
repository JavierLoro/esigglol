import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { UPLOADS_DIR } from '@/lib/env'
import { getTeamById, updateTeamLogo } from '@/lib/data'
import { getUploadFilename, resolveUploadPath, uploadUrl } from '@/lib/upload-files'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { randomUUID } from 'crypto'
import logger from '@/lib/logger'

const log = logger.child({ module: 'upload-logo' })

export const runtime = 'nodejs'

const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

function isFile(value: FormDataEntryValue | null): value is File {
  return value !== null && typeof value !== 'string' && typeof value.arrayBuffer === 'function'
}

async function removeFileQuietly(filePath: string, filename: string, reason: string): Promise<void> {
  try {
    await unlink(filePath)
  } catch (err) {
    const code = typeof err === 'object' && err !== null && 'code' in err ? err.code : undefined
    if (code !== 'ENOENT') {
      log.error({ err: err instanceof Error ? err.message : 'Error desconocido', filename, reason }, 'Unable to clean up logo file')
    }
  }
}

export async function POST(req: Request) {
  const denied = await requireAdminSession()
  if (denied) return denied

  let newFilePath: string | undefined
  let newFileNeedsCleanup = false
  let filename = ''
  let teamIdForLog = ''

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const teamId = formData.get('teamId')

    if (typeof teamId !== 'string' || !teamId) {
      return NextResponse.json({ error: 'Se requiere teamId' }, { status: 400 })
    }
    teamIdForLog = teamId

    // Resolve the team before touching the filesystem. An unknown ID must
    // never be able to create an upload, even temporarily.
    const team = getTeamById(teamId)
    if (!team) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })
    }

    if (!isFile(file)) {
      return NextResponse.json({ error: 'No se recibió imagen' }, { status: 400 })
    }

    const ext = ALLOWED_TYPES[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: 'Tipo de imagen no soportado. Usa PNG, JPG, WebP o SVG.' },
        { status: 400 },
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'La imagen no puede superar 2 MB' },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    await mkdir(UPLOADS_DIR, { recursive: true })

    filename = `logo-${randomUUID()}.${ext}`
    newFilePath = resolveUploadPath(filename) ?? undefined
    if (!newFilePath) throw new Error('No se pudo resolver el archivo de logo')
    newFileNeedsCleanup = true
    await writeFile(newFilePath, buffer, { flag: 'wx' })

    const publicPath = uploadUrl(filename)
    const persistedTeam = updateTeamLogo(teamId, publicPath)
    if (!persistedTeam) {
      await removeFileQuietly(newFilePath, filename, 'team-disappeared')
      newFileNeedsCleanup = false
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })
    }
    newFileNeedsCleanup = false

    // Only delete files owned by this application. Existing external/static
    // logo URLs remain untouched, and invalid persisted paths are ignored.
    const previousFilename = typeof team.logo === 'string' ? getUploadFilename(team.logo) : null
    const previousFilePath = previousFilename ? resolveUploadPath(previousFilename) : null
    if (previousFilename && previousFilePath && previousFilePath !== newFilePath) {
      await removeFileQuietly(previousFilePath, previousFilename, 'replaced-logo')
    }

    log.info({ teamId, filename }, 'Logo uploaded')

    return NextResponse.json({ path: publicPath })
  } catch (err) {
    if (newFileNeedsCleanup && newFilePath) {
      await removeFileQuietly(newFilePath, filename, 'association-failed')
    }
    const message = err instanceof Error ? err.message : 'Error desconocido'
    log.error({ err: message, teamId: teamIdForLog, filename }, 'Error uploading logo')
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
