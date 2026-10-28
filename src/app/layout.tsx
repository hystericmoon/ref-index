import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const body = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const code = IBM_Plex_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const description =
  "Websites and apps picked by 13 design galleries in one place, one search box for 21 galleries, and a private, taggable library of UI screenshots.";

export const metadata: Metadata = {
  metadataBase: new URL("https://ref-index.vercel.app"),
  title: { default: "Ref Index", template: "%s · Ref Index" },
  description,
  openGraph: { type: "website", siteName: "Ref Index", title: "Ref Index", description, url: "/" },
  twitter: { card: "summary_large_image", title: "Ref Index", description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#111613" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable} ${code.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader />
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
