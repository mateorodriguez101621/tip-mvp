import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "TIP · Copiloto de tesorería",
  description: "Tesorería inteligente para PyMEs importadoras: proyección de caja, alertas y escenarios.",
};

export const viewport: Viewport = {
  themeColor: "#5449DD",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${poppins.variable} antialiased`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
