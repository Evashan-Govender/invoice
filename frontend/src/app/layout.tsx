import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ZeroTouch AP™ - Intelligent Invoice Processing | Sambe Consulting',
  description: 'AI-powered invoice data extraction and ERP integration — powered by Sambe Consulting',
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
    <html lang="en">
      {/* h-full on html+body allows sidebar children to stretch to full viewport height */}
      <body className="antialiased h-full">
        <div className="min-h-screen h-full bg-sb-blue/10">
          {children}
        </div>
      </body>
    </html>
  )
}
