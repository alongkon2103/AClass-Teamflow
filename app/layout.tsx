import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, IBM_Plex_Sans_Thai } from "next/font/google";
import { THEME_COOKIE, themeClassFromCookie } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Thai copy must not fall back to a system default (SPEC 6.2).
const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TeamFlow",
  description: "ระบบจัดการงานของทีม",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value;

  return (
    <html
      lang="th"
      className={`${themeClassFromCookie(themeCookie)} ${inter.variable} ${plexThai.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
