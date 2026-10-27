import type { Metadata, Viewport } from "next";
import { Anuphan, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { LangProvider } from "@/components/LangProvider";
import { LANG_COOKIE, type Lang } from "@/lib/i18n";
import "./globals.css";

const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "LINE OA Webchat",
  description: "Reply to LINE Official Account messages from the web.",
};

export const viewport: Viewport = {
  themeColor: "#0d1117",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const stored = (await cookies()).get(LANG_COOKIE)?.value;
  const lang: Lang = stored === "en" ? "en" : "th";
  return (
    <html lang={lang} className={`${anuphan.variable} ${jetbrains.variable}`}>
      <body>
        <LangProvider initial={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
