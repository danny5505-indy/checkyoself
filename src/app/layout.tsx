import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Check Yo Self", template: "%s · Check Yo Self" },
  description: "Our family's goals, plans, lists and calendar in one place.",
  applicationName: "Check Yo Self",
  appleWebApp: { capable: true, title: "Check Yo Self", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1412" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
