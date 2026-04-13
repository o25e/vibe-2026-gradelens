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

// GET /api/submissions/[id]/file — 교수가 학생 제출 파일 다운로드
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req)
  if (!session || session.role !== 'instructor') {
    return NextResponse.json({ error: 'Instructor only' }, { status: 403 })
  }

  const row = await db
    .prepare('SELECT file_name, file_blob, file_mime FROM submissions WHERE id = ?')
    .get(params.id) as { file_name: string | null; file_blob: Buffer | null; file_mime: string | null } | undefined

  if (!row?.file_blob || !row?.file_name) {
    return NextResponse.json({ error: 'No file attached' }, { status: 404 })
  }

  const bytes = new Uint8Array(row.file_blob)
  const ext = row.file_name.split('.').pop()?.toLowerCase() ?? ''

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': row.file_mime ?? MIME[ext] ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
      'Cache-Control': 'no-store',
    },
  })
}

// POST /api/submissions/[id]/file — 학생이 제출 후 실제 파일 바이너리 업로드
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req)
  if (!session || session.role !== 'student') {
    return NextResponse.json({ error: 'Student only' }, { status: 403 })
  }

  const submission = await db
    .prepare('SELECT id FROM submissions WHERE id = ? AND student_id = ?')
    .get(params.id, session.id)
  if (!submission) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: '파일 데이터를 읽을 수 없습니다.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())

  await db.prepare('UPDATE submissions SET file_blob = ?, file_mime = ?, file_path = NULL WHERE id = ?')
    .run(buf, file.type || null, params.id)

  return NextResponse.json({ ok: true })
}
