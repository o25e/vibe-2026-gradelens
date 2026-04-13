import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import db from '@/lib/db'
import fs from 'fs'
import path from 'path'

const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads', 'assignments')

const MIME: Record<string, string> = {
  pdf:  'application/pdf',
  doc:  'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt:  'text/plain; charset=utf-8',
  hwp:  'application/x-hwp',
}

// GET /api/assignments/[id]/guideline — 학생·교수 모두 다운로드 가능
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = db
    .prepare('SELECT guideline_file_name, guideline_file_path FROM assignments WHERE id = ?')
    .get(params.id) as { guideline_file_name: string | null; guideline_file_path: string | null } | undefined

  if (!row?.guideline_file_path || !row?.guideline_file_name) {
    return NextResponse.json({ error: 'No guideline file' }, { status: 404 })
  }

  const filePath = path.join(UPLOADS_DIR, row.guideline_file_path)
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found on server' }, { status: 404 })
  }

  const buf = fs.readFileSync(filePath)
  const ext = row.guideline_file_name.split('.').pop()?.toLowerCase() ?? ''

  return new NextResponse(buf, {
    headers: {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(row.guideline_file_name)}`,
      'Cache-Control': 'no-store',
    },
  })
}

// POST /api/assignments/[id]/guideline — 교수가 가이드라인 파일 업로드
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req)
  if (!session || session.role !== 'instructor') {
    return NextResponse.json({ error: 'Instructor only' }, { status: 403 })
  }

  const assignment = db
    .prepare('SELECT id FROM assignments WHERE id = ? AND instructor_id = ?')
    .get(params.id, session.id)
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: '파일 데이터를 읽을 수 없습니다.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const storedName = `${params.id}.${ext}`
  const filePath = path.join(UPLOADS_DIR, storedName)

  const buf = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(filePath, buf)

  db.prepare('UPDATE assignments SET guideline_file_name = ?, guideline_file_path = ? WHERE id = ?')
    .run(file.name, storedName, params.id)

  return NextResponse.json({ ok: true, file_name: file.name })
}
