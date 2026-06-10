import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/lib/toast/toast-context";
import ToastContainer from "@/components/reachmira/ToastContainer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReachMira | Modern B2B Outreach OS",
  description: "A manual-first CRM built for B2B agencies that value deep personalization over volume. Protect your domains, automate your research, and book more meetings.",
  keywords: ["B2B outreach", "cold email", "sales CRM", "AI personalization", "email deliverability"],
  openGraph: {
    title: "ReachMira | Modern B2B Outreach OS",
    description: "A manual-first CRM built for B2B agencies that value deep personalization over volume.",
    url: "https://reachmira.com",
    siteName: "ReachMira",
    images: [
      {
        url: "/hero_dashboard.png",
        width: 1200,
        height: 675,
        alt: "ReachMira Dashboard",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ReachMira | Modern B2B Outreach OS",
    description: "Protect your domains, automate your research, and book more meetings with our manual-first CRM.",
    images: ["/hero_dashboard.png"],
  },
  icons: {
    icon: "/reachmira-favicon.png",
    shortcut: "/reachmira-favicon.png",
    apple: "/reachmira-apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <ToastProvider>
          {children}
          <ToastContainer />
        </ToastProvider>
      </body>
    </html>
  );
}
