import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GradeLens — AI 채점 어시스턴트',
  description: 'AI 기반 자동 채점과 성적 분석 대시보드',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  )
}
