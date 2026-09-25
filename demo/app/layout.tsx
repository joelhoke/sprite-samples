import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Joel — Here. Almost.",
  description: "A photographic portrait that follows your point of view.",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
