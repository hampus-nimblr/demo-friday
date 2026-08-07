import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nimblr Inbox Overflow",
  description:
    "Sort spam, phishing, and legitimate mail before your inbox overflows.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head />
      <body className="flex h-full flex-col overflow-hidden bg-page">
        {children}
      </body>
    </html>
  );
}
