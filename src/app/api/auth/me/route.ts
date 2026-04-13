import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

// Always dynamic — reads cookies at request time
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 })
    }
    return NextResponse.json({ user: session })
  } catch {
    return NextResponse.json({ user: null }, { status: 500 })
  }
}
