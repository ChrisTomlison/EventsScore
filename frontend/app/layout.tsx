import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "EventsScore - Encrypted Event Rating System",
  description: "Privacy-preserving event rating system using FHEVM",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">
        <div className="fixed inset-0 w-full h-full bg-black z-[-20]"></div>
        <main className="flex flex-col max-w-screen-2xl mx-auto pb-20 px-4">
          <nav className="flex w-full h-fit py-8 justify-between items-center border-b border-luxury-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-luxury-green rounded-lg flex items-center justify-center">
                <span className="text-luxury-gold text-xl font-bold">E</span>
              </div>
              <h1 className="text-3xl font-bold">
                <span className="text-luxury-gold">Events</span>
                <span className="text-luxury-green">Score</span>
              </h1>
            </div>
            <div className="text-sm text-gray-400">
              Encrypted Event Rating System
            </div>
          </nav>
          <Providers>{children}</Providers>
        </main>
      </body>
    </html>
  );
}

