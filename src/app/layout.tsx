import type { Metadata } from "next";
import "./globals.css";
import "./game.css";

export const metadata: Metadata = {
  title: "JOULE JACKPOT — The Energy Quiz Show",
  description: "A 3D energy quiz show hosted by an AI.",
  icons: { icon: "/brand/logo.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
