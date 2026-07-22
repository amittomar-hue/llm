import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Calendar, Clock, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getResource, listResources } from "@/lib/resources";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return listResources().map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const r = getResource(slug);
  if (!r) return { title: "Resource not found — DMOOP" };

  return {
    title: `${r.title} — DMOOP`,
    description: r.summary,
    alternates: { canonical: `/resources/${r.slug}` },
    openGraph: {
      title: r.title,
      description: r.summary,
      url: `/resources/${r.slug}`,
      type: "article",
      publishedTime: r.publishedAt,
      authors: [r.author],
    },
    twitter: {
      card: "summary_large_image",
      title: r.title,
      description: r.summary,
    },
  };
}

const CHIP_COLOR = {
  Blog: "bg-sky-50 text-sky-700",
  "Case Study": "bg-emerald-50 text-emerald-700",
  Whitepaper: "bg-violet-50 text-violet-700",
  Guide: "bg-[#fbf3ee] text-[var(--dmoop-accent-rich)]",
} as const;

export default async function ResourcePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getResource(slug);
  if (!article) notFound();

  const related = listResources().filter((r) => r.slug !== article.slug).slice(0, 3);
  const published = new Date(article.publishedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.summary,
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    wordCount: article.content.split(/\s+/).filter(Boolean).length,
    timeRequired: `PT${article.readMinutes}M`,
    inLanguage: "en-US",
    articleSection: article.category,
    author: { "@type": "Organization", name: article.author, url: "https://www.dmoop.com" },
    publisher: {
      "@type": "Organization",
      name: "DMOOP",
      url: "https://www.dmoop.com",
      logo: { "@type": "ImageObject", url: "https://www.dmoop.com/dmoop-logo.png" },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://www.dmoop.com/resources/${article.slug}` },
  };

  // BreadcrumbList helps AI Overviews / Google understand the site
  // hierarchy and is one of the highest-rewarded schema patterns for
  // AEO citation — included for every article reader page.
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.dmoop.com" },
      { "@type": "ListItem", position: 2, name: "Resources", item: "https://www.dmoop.com/resources" },
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: `https://www.dmoop.com/resources/${article.slug}`,
      },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--dmoop-bg-app)" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Navbar */}
      <nav className="sticky top-0 z-30 border-b border-[var(--dmoop-border-soft)] backdrop-blur-xl bg-white/70">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <Image src="/dmoop-logo.png" alt="DMOOP" width={130} height={36} priority className="h-7 sm:h-8 w-auto" />
            <span className="hidden md:inline text-[10px] font-bold tracking-[0.14em] text-[var(--dmoop-accent)] uppercase px-1.5 py-0.5 rounded-md" style={{ background: "rgba(193,74,42,0.08)" }}>
              DMOOP
            </span>
          </Link>
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/resources" className="text-[12.5px] sm:text-[13px] font-medium text-[var(--dmoop-text-secondary)] hover:text-[var(--dmoop-text-primary)] transition-colors flex items-center gap-1">
              <ArrowLeft size={13} /> All resources
            </Link>
            <Link href="/chat" className="h-8 sm:h-9 px-3 sm:px-4 rounded-lg dmoop-btn-primary text-[12.5px] sm:text-[13px] font-semibold flex items-center gap-1.5 shrink-0">
              Open DMOOP <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Article */}
      <article className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-12 sm:pb-20 w-full">
        <div className="mb-6">
          <span className={`inline-block text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md ${CHIP_COLOR[article.category]}`}>
            {article.category}
          </span>
        </div>

        <h1 className="text-[28px] sm:text-[42px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] leading-[1.15] mb-5">
          {article.title}
        </h1>

        <p className="text-[15px] sm:text-[17px] text-[var(--dmoop-text-secondary)] leading-relaxed mb-6">
          {article.summary}
        </p>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-[var(--dmoop-text-tertiary)] pb-6 mb-8 border-b border-[var(--dmoop-border-soft)]">
          <span className="flex items-center gap-1.5"><User size={12} /> {article.author}</span>
          <span className="flex items-center gap-1.5"><Calendar size={12} /> {published}</span>
          <span className="flex items-center gap-1.5"><Clock size={12} /> {article.readMinutes} min read</span>
        </div>

        <div className="resource-prose">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {article.content}
          </ReactMarkdown>
        </div>

        {/* CTA strip */}
        <div className="mt-10 sm:mt-14 p-5 sm:p-6 rounded-2xl"
          style={{ background: "var(--dmoop-gradient-card)", border: "1px solid var(--dmoop-border-soft)" }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--dmoop-accent)] mb-1.5">
            Ready to try it?
          </p>
          <h3 className="text-[18px] sm:text-[20px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-2">
            Put DMOOP on your next campaign.
          </h3>
          <p className="text-[13px] sm:text-[14px] text-[var(--dmoop-text-secondary)] mb-4 leading-relaxed">
            Upload your brand docs, name your Brand Agent, and ship your first on-voice asset in under 5 minutes. No credit card.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl dmoop-btn-primary text-[13px] font-semibold"
          >
            Get started free <ArrowRight size={14} />
          </Link>
        </div>
      </article>

      {/* Related */}
      <section className="relative pb-16 sm:pb-24 border-t border-[var(--dmoop-border-soft)] pt-12 sm:pt-16 bg-gradient-to-b from-transparent to-[#fbf6ec]/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.14em] text-[var(--dmoop-accent)] uppercase mb-3 text-center">
            More resources
          </p>
          <h2 className="text-[22px] sm:text-[30px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] text-center mb-8 sm:mb-10">
            Keep reading.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/resources/${r.slug}`}
                className="group p-5 rounded-2xl bg-[var(--dmoop-gradient-card)] border border-[var(--dmoop-border-soft)] dmoop-card flex flex-col"
              >
                <span className={`self-start text-[9.5px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md mb-3 ${CHIP_COLOR[r.category]}`}>
                  {r.category}
                </span>
                <h3 className="text-[14.5px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-2 leading-snug">
                  {r.title}
                </h3>
                <p className="text-[12px] text-[var(--dmoop-text-secondary)] leading-relaxed mb-3 flex-1">
                  {r.summary}
                </p>
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--dmoop-accent)] group-hover:gap-2 transition-all">
                  Read <ArrowRight size={12} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-8 border-t border-[var(--dmoop-border-soft)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/dmoop-logo.png" alt="DMOOP" width={100} height={28} className="h-6 w-auto" />
            <span className="text-[11px] text-[var(--dmoop-text-tertiary)]">© {new Date().getFullYear()} DMOOP</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] font-medium text-[var(--dmoop-text-secondary)]">
            <Link href="/docs/api" className="hover:text-[var(--dmoop-text-primary)]">API</Link>
            <Link href="/privacy" className="hover:text-[var(--dmoop-text-primary)]">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--dmoop-text-primary)]">Terms</Link>
            <Link href="/resources" className="hover:text-[var(--dmoop-text-primary)] flex items-center gap-1">
              <ArrowLeft size={12} /> All resources
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
