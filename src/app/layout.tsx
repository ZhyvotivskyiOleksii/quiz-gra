import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { ReactNode } from 'react'
import { ConditionalChrome } from '@/components/shared/conditional-chrome'
import 'react-phone-input-2/lib/style.css'
import { ThemeProvider } from '@/components/shared/theme-provider'

export const metadata: Metadata = {
  title: 'QuizTime',
  description: 'Sprawdź swoją wiedzę i przewiduj przyszłość',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ConditionalChrome>{children}</ConditionalChrome>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
