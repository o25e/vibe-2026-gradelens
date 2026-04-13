import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

// ── 파일 크기 제한: 10 MB ──────────────────────────────────────────────────────
const MAX_BYTES = 10 * 1024 * 1024

// ── TXT: BOM 제거 후 UTF-8 디코딩 ─────────────────────────────────────────────
function parseTxt(buf: Buffer): string {
  // UTF-8 BOM 제거
  const start = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? 3 : 0
  return buf.subarray(start).toString('utf-8')
}

// ── PDF: pdf-parse-fork (Node.js only) ─────────────────────────────────────────────
async function parsePdf(buf: Buffer): Promise<string> {
  // pdf-parse의 의존성 버그가 해결된 pdf-parse-fork 패키지 사용
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse-fork');
  const data = await pdfParse(buf);
  return data.text;
}

// ── DOCX: mammoth ─────────────────────────────────────────────────────────────
async function parseDocx(buf: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth: { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> } = require('mammoth')
  const result = await mammoth.extractRawText({ buffer: buf })
  return result.value
}

// ── HWP: 휴리스틱 텍스트 추출 ─────────────────────────────────────────────────
// HWP5 파일은 OLE Compound Document 포맷으로, 완전 파싱은 복잡합니다.
// 바이너리에서 연속된 한글(UTF-16 LE)·ASCII 블록을 스캔합니다.
function parseHwp(buf: Buffer): string {
  const MAGIC = 'HWP Document File'
  const header = buf.slice(0, 17).toString('ascii')
  if (!header.startsWith(MAGIC)) {
    // HWP가 아니면 UTF-8로 시도
    return buf.toString('utf-8').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
  }

  // UTF-16 LE로 디코딩 후 한글·영문·숫자·공백만 유지
  const utf16 = buf.toString('utf16le')
  const cleaned = utf16
    .replace(/[^\uAC00-\uD7A3\u3131-\u318E\u0020-\u007E\u00A0\n\r\t]/g, ' ')
    .replace(/ {3,}/g, '  ')
    .trim()

  // 의미있는 내용이 충분하면 반환
  if (cleaned.replace(/\s/g, '').length > 50) return cleaned

  // 그래도 적으면 청크 스캔 — 연속 한글 2자 이상인 구간만 추출
  const chunks: string[] = []
  const re = /[\uAC00-\uD7A3]{2,}[\w\s\uAC00-\uD7A3.,():\-]*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(cleaned)) !== null) chunks.push(m[0].trim())
  return chunks.join(' ')
}

// ── 공통 정제 ──────────────────────────────────────────────────────────────────
function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')  // 연속 빈줄 3줄 이상 → 3줄로
    .replace(/[ \t]{3,}/g, '  ')    // 과도한 공백 압축
    .trim()
}

// ── API Handler ────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: '파일 데이터를 읽을 수 없습니다.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `파일 크기가 10MB를 초과합니다. (${(file.size / 1024 / 1024).toFixed(1)}MB)` }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const arrayBuffer = await file.arrayBuffer()
  const buf = Buffer.from(arrayBuffer)

  console.log(`[parse-file] 파일: ${file.name} (${ext}, ${(file.size / 1024).toFixed(0)} KB)`)

  let text = ''

  try {
    if (ext === 'txt') {
      text = parseTxt(buf)
    } else if (ext === 'pdf') {
      text = await parsePdf(buf)
    } else if (ext === 'docx' || ext === 'doc') {
      text = await parseDocx(buf)
    } else if (ext === 'hwp') {
      text = parseHwp(buf)
    } else {
      // 알 수 없는 형식 → UTF-8 시도
      text = buf.toString('utf-8')
    }
  } catch (err) {
    console.error(`[parse-file] 파싱 오류 (${ext}):`, err)
    return NextResponse.json({
      error: `${ext.toUpperCase()} 파일 파싱에 실패했습니다. 텍스트를 직접 붙여넣기 해주세요.`,
    }, { status: 422 })
  }

  const clean = cleanText(text)
  console.log(`[parse-file] 추출 완료 — ${clean.length}자`)

  if (clean.length < 20) {
    return NextResponse.json({
      error: '파일에서 텍스트를 충분히 추출하지 못했습니다. 스캔된 이미지 PDF이거나 암호화된 파일일 수 있습니다. 텍스트를 직접 입력해주세요.',
    }, { status: 422 })
  }

  return NextResponse.json({ text: clean, chars: clean.length })
}
