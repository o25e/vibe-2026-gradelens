import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import db from '@/lib/db'

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

  const row = await db
    .prepare('SELECT guideline_file_name, guideline_file_blob, guideline_file_mime FROM assignments WHERE id = ?')
    .get(params.id) as { guideline_file_name: string | null; guideline_file_blob: Buffer | null; guideline_file_mime: string | null } | undefined

  if (!row?.guideline_file_blob || !row?.guideline_file_name) {
    return NextResponse.json({ error: 'No guideline file' }, { status: 404 })
  }

  const bytes = new Uint8Array(row.guideline_file_blob)
  const ext = row.guideline_file_name.split('.').pop()?.toLowerCase() ?? ''

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': row.guideline_file_mime ?? MIME[ext] ?? 'application/octet-stream',
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

  const assignment = await db
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

  const buf = Buffer.from(await file.arrayBuffer())

  await db.prepare('UPDATE assignments SET guideline_file_name = ?, guideline_file_blob = ?, guideline_file_mime = ?, guideline_file_path = NULL WHERE id = ?')
    .run(file.name, buf, file.type || null, params.id)

  return NextResponse.json({ ok: true, file_name: file.name })
}
