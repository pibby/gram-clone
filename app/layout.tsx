import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { getStats, getTopTags } from "@/lib/posts";
import { getBio } from "@/lib/profile";
import { isAdmin } from "@/lib/session";
import { site } from "@/lib/site";
import { Avatar } from "./components/Avatar";
import { TagBar } from "./components/TagBar";
import "./globals.css";

const sans = Geist({ variable: "--font-geist", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { default: site.name, template: `%s · ${site.name}` },
    description: (await getBio()) || undefined,
    openGraph: { images: [{ url: site.avatar.src2x, width: 192, height: 192 }] },
  };
}

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

const compact = new Intl.NumberFormat("en", { notation: "compact" });

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [stats, admin, tags, bio] = await Promise.all([getStats(), isAdmin(), getTopTags(30), getBio()]);

  return (
    <html lang="en" className={sans.variable}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="topbar">
          <div className="topbar__inner">
            <Link href="/" className="topbar__avatar" tabIndex={-1} aria-hidden="true">
              <Avatar author={site} size="md" />
            </Link>
            <div className="topbar__id">
              <Link href="/" className="topbar__name">
                {site.name}
              </Link>
              <p className="topbar__stats">
                <span>
                  <strong>{compact.format(stats.posts)}</strong> {stats.posts === 1 ? "post" : "posts"}
                </span>
              </p>
            </div>
            {admin && (
              <Link href="/admin" className="button button--secondary button--sm topbar__action">
                New post
              </Link>
            )}
            {bio && <p className="topbar__bio">{bio}</p>}
          </div>
          <Suspense>
            <TagBar tags={tags} />
          </Suspense>
        </header>
        <main id="main" className="page">
          {children}
        </main>
      </body>
    </html>
  );
}
