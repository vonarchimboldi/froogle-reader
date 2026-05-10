import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Writer Reader",
  description: "A compact reader for following individual writers"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
