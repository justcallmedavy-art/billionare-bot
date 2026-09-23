import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "Billinare Deal Option — Trade global markets",
  description:
    "Professional forex & fixed-time trading terminal with live charts, paper trading, and automated strategies. Demo-first by design.",
};

export const viewport: Viewport = {
  themeColor: "#0c1c52",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
