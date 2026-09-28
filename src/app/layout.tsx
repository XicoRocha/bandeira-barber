import type { Metadata, Viewport } from "next";
import { Geist, Oswald } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bandeira Barber — Marcações",
  description: "Marque o seu corte na Bandeira Barber em segundos.",
};

export const viewport: Viewport = { themeColor: "#0f0e0c" };

// Tudo depende da base de dados, nada deve ser pré-renderizado no build
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-PT" className={`${geist.variable} ${oswald.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
