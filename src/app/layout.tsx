import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Fraunces, Tiro_Devanagari_Hindi } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import Footer from "@/components/Footer";
import "./globals.css";
import { Analytics } from '@vercel/analytics/next';


const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

const tiroDeva = Tiro_Devanagari_Hindi({
  subsets: ["devanagari", "latin"],
  weight: "400",
  variable: "--font-tiro-deva",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bhandara — Find a Badamangal near you",
  description: "Discover or share charitable food distribution events near you.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${fraunces.variable} ${tiroDeva.variable}`}
    >
      <body className="flex flex-col min-h-screen">
        <div className="flex-1">{children}</div>
        <Analytics />
        <Toaster richColors position="bottom-center" />
        <Footer />
      </body>
    </html>
  );
}
