import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Froogle Reader",
  description: "A focused reader for following individual writers across RSS feeds and author pages"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
