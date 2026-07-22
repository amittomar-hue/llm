import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Clock, Newspaper, BarChartHorizontal, FileBadge, GraduationCap } from "lucide-react";
import { listResources, type ResourceCategory } from "@/lib/resources";

export const metadata: Metadata = {
  title: "Resources — DMOOP",
  description:
    "Blogs, case studies, whitepapers and guides from the DMOOP team — for marketers shipping campaigns, not benchmark posts.",
  alternates: { canonical: "/resources" },
  openGraph: {
    title: "Resources — DMOOP",
    description:
      "Blogs, case studies, whitepapers and guides from the DMOOP team.",
    url: "/resources",
    type: "website",
  },
};

const ICON_FOR: Record<ResourceCategory, React.ComponentType<{ size: number; className?: string; strokeWidth?: number }>> = {
  Blog: Newspaper,
  "Case Study": BarChartHorizontal,
  Whitepaper: FileBadge,
  Guide: GraduationCap,
};

const CHIP_COLOR: Record<ResourceCategory, string> = {
  Blog: "bg-sky-50 text-sky-700",
  "Case Study": "bg-emerald-50 text-emerald-700",
  Whitepaper: "bg-violet-50 text-violet-700",
  Guide: "bg-[#fbf3ee] text-[var(--dmoop-accent-rich)]",
};

const TILE_COLOR: Record<ResourceCategory, { bg: string; fg: string }> = {
  Blog: { bg: "bg-sky-50", fg: "text-sky-600" },
  "Case Study": { bg: "bg-emerald-50", fg: "text-emerald-600" },
  Whitepaper: { bg: "bg-violet-50", fg: "text-violet-600" },
  Guide: { bg: "bg-[#fbf3ee]", fg: "text-[var(--dmoop-accent)]" },
};

export default function ResourcesIndexPage() {
  const items = listResources();

  // CollectionPage tells search engines this page is a curated listing
  // of related Article items — improves AI Overviews citation for
  // "best marketing resources" / "B2B marketing blog" queries and
  // teaches the model the relationship between this index and the
  // per-article reader pages.
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": "https://www.dmoop.com/resources#collection",
    name: "DMOOP Resources — marketing strategy, playbooks, benchmarks",
    description:
      "Blogs, case studies, whitepapers, and guides from the DMOOP team. Marketing strategy for B2B SaaS leaders shipping campaigns in 2026.",
    url: "https://www.dmoop.com/resources",
    inLanguage: "en-US",
    isPartOf: { "@type": "WebSite", "@id": "https://www.dmoop.com#website" },
    publisher: { "@type": "Organization", name: "DMOOP", url: "https://www.dmoop.com" },
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      numberOfItems: items.length,
      itemListElement: items.map((r, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `https://www.dmoop.com/resources/${r.slug}`,
        name: r.title,
      })),
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.dmoop.com" },
      { "@type": "ListItem", position: 2, name: "Resources", item: "https://www.dmoop.com/resources" },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--dmoop-bg-app)" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Navbar */}
      <nav className="sticky top-0 z-30 border-b border-[var(--dmoop-border-soft)] backdrop-blur-xl bg-white/70">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <Image src="/dmoop-logo.png" alt="DMOOP" width={130} height={36} priority className="h-7 sm:h-8 w-auto" />
            <span className="hidden md:inline text-[10px] font-bold tracking-[0.14em] text-[var(--dmoop-accent)] uppercase px-1.5 py-0.5 rounded-md" style={{ background: "rgba(193,74,42,0.08)" }}>
              DMOOP
            </span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <Link href="/" className="text-[12.5px] sm:text-[13px] font-medium text-[var(--dmoop-text-secondary)] hover:text-[var(--dmoop-text-primary)] transition-colors flex items-center gap-1">
              <ArrowLeft size={13} /> Home
            </Link>
            <Link href="/chat" className="h-8 sm:h-9 px-3 sm:px-4 rounded-lg dmoop-btn-primary text-[12.5px] sm:text-[13px] font-semibold flex items-center gap-1.5 shrink-0">
              Open DMOOP <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[700px] h-[400px] pointer-events-none opacity-60"
          style={{ background: "radial-gradient(ellipse at top, rgba(193,74,42,0.12) 0%, transparent 70%)" }} />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-8 sm:pb-12 text-center">
          <p className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.14em] text-[var(--dmoop-accent)] uppercase mb-3">
            Resources
          </p>
          <h1 className="text-[32px] sm:text-[52px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-4 leading-tight">
            Marketing intelligence,
            <br />
            <span style={{
              background: "var(--dmoop-gradient-accent)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              in writing.
            </span>
          </h1>
          <p className="text-[14px] sm:text-[16px] text-[var(--dmoop-text-secondary)] max-w-2xl mx-auto px-2">
            Blogs, case studies, whitepapers and field guides from the DMOOP team — for marketers shipping campaigns, not benchmark posts.
          </p>
        </div>
      </section>

      {/* Grid */}
      <section className="relative pb-16 sm:pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {items.map((r) => {
              const Icon = ICON_FOR[r.category];
              const tile = TILE_COLOR[r.category];
              const published = new Date(r.publishedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <Link
                  key={r.slug}
                  href={`/resources/${r.slug}`}
                  className="group relative p-5 rounded-2xl bg-[var(--dmoop-gradient-card)] border border-[var(--dmoop-border-soft)] overflow-hidden dmoop-card flex flex-col"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl ${tile.bg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}
                      style={{ boxShadow: "var(--dmoop-shadow-xs)" }}>
                      <Icon size={17} className={tile.fg} strokeWidth={2.2} />
                    </div>
                    <span className={`text-[9.5px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md ${CHIP_COLOR[r.category]}`}>
                      {r.category}
                    </span>
                  </div>

                  <h2 className="text-[16px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-1.5 leading-snug">
                    {r.title}
                  </h2>
                  <p className="text-[12.5px] text-[var(--dmoop-text-secondary)] leading-relaxed mb-4 flex-1">
                    {r.summary}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-[var(--dmoop-text-tertiary)] pt-3 border-t border-[var(--dmoop-border-soft)]">
                    <span className="flex items-center gap-1.5">
                      <Clock size={10} /> {r.readMinutes} min read
                    </span>
                    <span className="truncate ml-2">{published}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10.5px] font-medium text-[var(--dmoop-text-tertiary)] truncate">By {r.author}</span>
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--dmoop-accent)] group-hover:gap-2 transition-all">
                      Read <ArrowRight size={12} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-8 border-t border-[var(--dmoop-border-soft)] mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/dmoop-logo.png" alt="DMOOP" width={100} height={28} className="h-6 w-auto" />
            <span className="text-[11px] text-[var(--dmoop-text-tertiary)]">© {new Date().getFullYear()} DMOOP</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] font-medium text-[var(--dmoop-text-secondary)]">
            <Link href="/docs/api" className="hover:text-[var(--dmoop-text-primary)]">API</Link>
            <Link href="/privacy" className="hover:text-[var(--dmoop-text-primary)]">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--dmoop-text-primary)]">Terms</Link>
            <Link href="/" className="hover:text-[var(--dmoop-text-primary)] flex items-center gap-1">
              <ArrowLeft size={12} /> Back to home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
