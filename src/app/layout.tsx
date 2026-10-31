import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/brand";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const body = Geist({
  variable: "--font-body",
  subsets: ["latin"],
});

const code = Geist_Mono({
  variable: "--font-code",
  subsets: ["latin"],
});

const description = SITE_DESCRIPTION;

export const metadata: Metadata = {
  metadataBase: new URL("https://ref-index.vercel.app"),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description,
  openGraph: { type: "website", siteName: SITE_NAME, title: SITE_NAME, description, url: "/" },
  twitter: { card: "summary_large_image", title: SITE_NAME, description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#141414" },
  ],
};

export default function RootLayout({ children, modal }: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${body.variable} ${code.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader />
            {children}
          </div>
          {modal}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
