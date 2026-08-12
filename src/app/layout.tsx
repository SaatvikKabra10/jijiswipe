import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JijiSwipe — Your closet, styled",
  description: "Build better outfits from the clothes you already own.",
  applicationName: "JijiSwipe",
  appleWebApp: { capable: true, title: "JijiSwipe", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
