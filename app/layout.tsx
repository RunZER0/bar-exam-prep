import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

const inter = Inter({ subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ynai.onrender.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Ynai — Kenya Bar Exam Preparation Platform",
    template: "%s | Ynai",
  },
  description:
    "AI-powered Kenya Bar Exam preparation platform for Kenya School of Law students. Master ATP subjects, legal drafting, research, and advocacy skills for the Council of Legal Education examinations.",
  keywords: [
    "Kenya Bar Exam",
    "Kenya School of Law",
    "KSL exam preparation",
    "ATP examination",
    "Council of Legal Education",
    "CLE Kenya",
    "Advocates Training Programme",
    "Kenya legal education",
    "bar exam prep Kenya",
    "law student Kenya",
    "legal drafting Kenya",
    "Kenyan advocates exam",
    "Kenya bar examination",
    "KSL students",
    "ATP units",
    "Civil Litigation Kenya",
    "Criminal Litigation Kenya",
    "Conveyancing Kenya",
    "Commercial Transactions Kenya",
    "Family Law Kenya",
    "Probate Administration Kenya",
    "Professional Ethics Kenya",
  ],
  authors: [{ name: "Ynai" }],
  creator: "Ynai",
  publisher: "Ynai",
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
  openGraph: {
    type: "website",
    locale: "en_KE",
    url: siteUrl,
    siteName: "Ynai",
    title: "Ynai — Kenya Bar Exam Preparation Platform",
    description:
      "AI-powered preparation for Kenya School of Law students. Master ATP subjects and excel in CLE examinations.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Ynai - Kenya Bar Exam Preparation Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ynai — Kenya Bar Exam Preparation Platform",
    description:
      "AI-powered preparation for Kenya School of Law students. Master ATP subjects and excel in CLE examinations.",
    images: ["/og-image.png"],
    creator: "@ynai_ke",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ynai",
  },
  alternates: {
    canonical: siteUrl,
  },
  category: "Education",
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "Ynai",
        description: "Kenya Bar Exam Preparation Platform",
        publisher: { "@id": `${siteUrl}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/search?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Ynai",
        url: siteUrl,
        logo: {
          "@type": "ImageObject",
          url: `${siteUrl}/icons/icon-512x512.png`,
          width: 512,
          height: 512,
        },
        description:
          "AI-powered Kenya Bar Exam preparation platform for Kenya School of Law students preparing for Council of Legal Education examinations.",
        areaServed: {
          "@type": "Country",
          name: "Kenya",
        },
      },
      {
        "@type": "EducationalOrganization",
        "@id": `${siteUrl}/#educational`,
        name: "Ynai",
        description:
          "Online platform providing AI-powered preparation for the Kenya Bar Examination and Advocates Training Programme (ATP).",
        educationalCredentialAwarded: "Bar Exam Preparation Certificate",
        teaches: [
          "Civil Litigation",
          "Criminal Litigation",
          "Conveyancing",
          "Commercial Transactions",
          "Family Law",
          "Probate and Administration",
          "Professional Ethics",
          "Legal Research",
          "Legal Drafting",
        ],
        audience: {
          "@type": "EducationalAudience",
          educationalRole: "student",
          audienceType: "Kenya School of Law Students",
        },
      },
      {
        "@type": "Course",
        name: "Kenya Bar Exam Preparation",
        description:
          "Comprehensive AI-powered preparation for the Kenya Bar Examination covering all ATP units including Civil Litigation, Criminal Litigation, Conveyancing, and more.",
        provider: { "@id": `${siteUrl}/#organization` },
        educationalLevel: "Professional",
        teaches: "Advocates Training Programme (ATP) Curriculum",
        audience: {
          "@type": "EducationalAudience",
          educationalRole: "student",
        },
        hasCourseInstance: {
          "@type": "CourseInstance",
          courseMode: "online",
          courseWorkload: "Self-paced",
        },
      },
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="geo.region" content="KE" />
        <meta name="geo.placename" content="Nairobi" />
        <link rel="canonical" href={siteUrl} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme');
                const isDark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (isDark) document.documentElement.classList.add('dark');
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
