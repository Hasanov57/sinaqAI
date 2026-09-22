import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
});

const manrope = Manrope({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: {
    default: "sinaqai — DİM imtahanlarına ağıllı hazırlıq",
    template: "%s | sinaqai",
  },
  description:
    "İmtahanları həll et, nəticəni gör və zəif mövzularını müəyyənləşdir.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az" data-scroll-behavior="smooth">
      <body className={`${inter.variable} ${manrope.variable}`}>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
