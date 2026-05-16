import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Money Maker",
  description: "Where your money is going.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="mx-auto max-w-3xl px-5 py-8 md:py-12">
          <header className="mb-10 flex items-baseline justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--color-accent)] text-sm font-bold text-white">
                $
              </div>
              <div>
                <div className="text-base font-bold leading-none">Money Maker</div>
                <div className="text-xs text-[color:var(--color-text-mute)] mt-1">Your money, your week.</div>
              </div>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
