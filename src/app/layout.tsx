import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GradeLens — AI 자동 채점 및 성적 관리 시스템',
  description: 'AI 기반 자동 채점과 성적 분석 대시보드',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
