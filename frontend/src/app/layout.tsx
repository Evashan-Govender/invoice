import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import './globals.css'

const outfit = Outfit({ 
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AFA ZeroTouch AP™ - Intelligent Invoice Processing',
  description: 'AI-powered invoice data extraction and ERP integration using Gemini Vision',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={outfit.variable}>
      <body className={`${outfit.className} antialiased`}>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-slate-100">
          {children}
        </div>
      </body>
    </html>
  )
}
