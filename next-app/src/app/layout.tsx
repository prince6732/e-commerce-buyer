import type { Metadata, Viewport } from "next";
import "./globals.css";

import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { ProductSyncProvider } from "@/context/ProductSyncContext";
import { CartProvider } from "@/context/CartContext";
import { LikeProvider } from "@/context/LikeContext";
import { LoaderProvider } from "@/context/LoaderContext";

import GlobalLoader from "@/components/(sheared)/GlobarLoader";
import { Inter } from "next/font/google";

/**
 * Viewport configuration
 *
 * maximumScale is intentionally omitted so users can
 * zoom on mobile devices for better accessibility.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Inter font
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Global Metadata
 *
 * This metadata acts as the default metadata for the website.
 *
 * IMPORTANT:
 * Do not define a global canonical URL here.
 * Individual pages should define their own canonical URL
 * using generateMetadata() or page-level metadata.
 */
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://zelton.in"
  ),

  title: {
    default: "Zelton | Premium Online Shopping & Lifestyle Store",
    template: "%s | Zelton",
  },

  description:
    "Shop the latest lifestyle products, electronics, fashion, footwear, and trending essentials at Zelton with exclusive offers and fast delivery.",

  keywords: [
    "Zelton",
    "online shopping",
    "lifestyle products",
    "fashion",
    "electronics",
    "footwear",
    "accessories",
    "e-commerce India",
  ],

  /**
   * Robots
   *
   * Allows search engines to index and follow
   * publicly accessible pages.
   *
   * Private pages such as login, checkout, account,
   * admin, etc. should override this with noindex.
   */
  robots: {
    index: true,
    follow: true,

    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  /**
   * Open Graph metadata
   *
   * Default metadata for social sharing.
   * Individual product/category pages should override
   * these values with their own dynamic metadata.
   */
  openGraph: {
    title: "Zelton | Premium Online Shopping & Lifestyle Store",

    description:
      "Shop the latest lifestyle products, electronics, fashion, footwear, and trending essentials at Zelton with exclusive offers and fast delivery.",

    siteName: "Zelton",

    url: "https://zelton.in",

    locale: "en_US",

    type: "website",

    images: [
      {
        url: "/about-showcase.png",
        width: 1200,
        height: 630,
        alt: "Zelton Store - Premium Online Shopping",
      },
    ],
  },

  /**
   * Twitter / X Card metadata
   */
  twitter: {
    card: "summary_large_image",

    title: "Zelton | Premium Online Shopping & Lifestyle Store",

    description:
      "Shop the latest lifestyle products, electronics, fashion, footwear, and trending essentials at Zelton.",

    images: ["/about-showcase.png"],
  },

  /**
   * Favicon
   */
  icons: {
    icon: "/favicon.ico",
  },
};

/**
 * Root Layout
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-body overflow-x-hidden">
        <LoaderProvider>
          <GlobalLoader />

          <AuthProvider>
            <ProductSyncProvider>
              <NotificationProvider>
                <LikeProvider>
                  <CartProvider>{children}</CartProvider>
                </LikeProvider>
              </NotificationProvider>
            </ProductSyncProvider>
          </AuthProvider>
        </LoaderProvider>
      </body>
    </html>
  );
}
