import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Летописец — ИИ-мастер D&D",
  description: "Локальный сервис для ролевых игр D&D 5e с ИИ-гейм-мастером, долгой памятью и базой знаний.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
