import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Лавка — учёт магазина",
  description: "Товары, деньги и результат вашего магазина.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}

