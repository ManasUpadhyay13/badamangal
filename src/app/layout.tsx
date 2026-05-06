import type { Metadata } from "next";
import { Inter, Tiro_Devanagari_Hindi } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import Footer from "@/components/Footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-inter",
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
    <html lang="en" className={`${inter.variable} ${tiroDeva.variable}`}>
      <body className="flex flex-col min-h-screen">
        <div className="flex-1">{children}</div>
        <Toaster richColors position="bottom-center" />
        <Footer />
      </body>
    </html>
  );
}
