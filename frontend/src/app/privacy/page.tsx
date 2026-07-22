import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";

const EFFECTIVE_DATE = "June 17, 2026";

export const metadata: Metadata = {
  title: "Privacy Policy — DMOOP",
  description:
    "How DMOOP collects, uses, and protects your data. Effective " + EFFECTIVE_DATE + ".",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy — DMOOP",
    description: "How DMOOP collects, uses, and protects your data.",
    url: "/privacy",
    type: "website",
  },
};

export default function PrivacyPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.dmoop.com" },
      { "@type": "ListItem", position: 2, name: "Privacy Policy", item: "https://www.dmoop.com/privacy" },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--dmoop-bg-app)" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <nav className="sticky top-0 z-30 border-b border-[var(--dmoop-border-soft)] backdrop-blur-xl bg-white/70">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <Image src="/dmoop-logo.png" alt="DMOOP" width={130} height={36} priority className="h-7 sm:h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/" className="text-[12.5px] sm:text-[13px] font-medium text-[var(--dmoop-text-secondary)] hover:text-[var(--dmoop-text-primary)] flex items-center gap-1">
              <ArrowLeft size={13} /> Home
            </Link>
            <Link href="/chat" className="h-8 sm:h-9 px-3 sm:px-4 rounded-lg dmoop-btn-primary text-[12.5px] sm:text-[13px] font-semibold flex items-center gap-1.5 shrink-0">
              Open DMOOP <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </nav>

      <article className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-12 sm:pb-20 w-full">
        <p className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.14em] text-[var(--dmoop-accent)] uppercase mb-3">
          Legal
        </p>
        <h1 className="text-[28px] sm:text-[42px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] leading-[1.15] mb-3">
          Privacy Policy
        </h1>
        <p className="text-[13px] text-[var(--dmoop-text-tertiary)] mb-8 pb-6 border-b border-[var(--dmoop-border-soft)]">
          Effective {EFFECTIVE_DATE}
        </p>

        <div className="resource-prose">
          <p>
            This Privacy Policy explains how DMOOP (&quot;DMOOP&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;)
            collects, uses, discloses, and protects information when you use
            <Link href="/" className="text-[var(--dmoop-accent)] font-medium"> www.dmoop.com </Link>
            and the DMOOP marketing intelligence platform (collectively, the &quot;Service&quot;). By using the
            Service, you agree to this Policy. If you do not agree, do not use the Service.
          </p>

          <h2>1. Who we are</h2>
          <p>
            DMOOP is an AI-assisted marketing intelligence platform operated by Compunnel Inc. and its
            affiliates. For data-protection purposes, the operating entity acts as the
            &quot;controller&quot; of your personal data unless otherwise indicated.
          </p>

          <h2>2. Information we collect</h2>
          <h3>2.1 Information you provide</h3>
          <ul>
            <li><strong>Account details</strong> — name, email address, password (hashed), and any profile information you choose to add.</li>
            <li><strong>Brand assets and uploaded content</strong> — files, URLs, brand voice documents, campaign briefs, and other materials you upload to train your Brand Agent.</li>
            <li><strong>Chat interactions and prompts</strong> — messages, prompts, files, and instructions you send to the Service.</li>
            <li><strong>Payment information</strong> — if and when paid plans are introduced, billing details are processed by our payment processor and we do not store full card data.</li>
            <li><strong>Support correspondence</strong> — emails or messages you send us when requesting help.</li>
          </ul>
          <h3>2.2 Information collected automatically</h3>
          <ul>
            <li><strong>Usage data</strong> — pages viewed, features used, time spent, click paths, errors encountered.</li>
            <li><strong>Device and connection data</strong> — IP address (truncated for analytics), browser type, operating system, device identifiers, referring URL.</li>
            <li><strong>Cookies and similar technologies</strong> — for authentication sessions, preferences, and aggregate analytics. See &quot;Cookies&quot; below.</li>
          </ul>
          <h3>2.3 Information from third parties</h3>
          <p>
            If you sign in using LinkedIn (OpenID Connect), we receive your name, email address, and
            LinkedIn profile picture as authorized by you. We do not access your LinkedIn connections,
            messages, or any other LinkedIn data.
          </p>

          <h2>3. How we use information</h2>
          <ul>
            <li>To provide, maintain, and improve the Service, including training Brand Agents on the
              materials you upload.</li>
            <li>To generate AI output requested by you (e.g., marketing assets, drafts, analyses).</li>
            <li>To authenticate you, secure your account, and prevent fraud or abuse.</li>
            <li>To respond to support requests and communicate with you about the Service.</li>
            <li>To send service updates (e.g., security notices, feature announcements). You can opt out
              of non-essential emails at any time.</li>
            <li>To monitor and analyze usage to improve performance, reliability, and product quality.</li>
            <li>To comply with applicable law and enforce our Terms of Service.</li>
          </ul>

          <h2>4. Third-party processors and AI providers</h2>
          <p>
            We use carefully chosen third-party processors to operate the Service. We only share with
            them the data they need to perform their function, and they are contractually required to
            protect it.
          </p>
          <ul>
            <li><strong>Hosting and infrastructure</strong> — Vercel Inc.</li>
            <li><strong>Authentication and database</strong> — Supabase Inc.</li>
            <li><strong>Transactional email</strong> — Resend, Inc.</li>
            <li><strong>Large language model inference</strong> — OpenAI, LLC and Anthropic PBC. Prompts
              and uploaded content may be transmitted to these providers solely to generate the output
              you request. We send prompts using API access governed by zero-retention or
              short-retention agreements where available; we never use customer prompts to train any
              third-party model without your explicit consent.</li>
            <li><strong>Web search grounding</strong> — Tavily AI, when you ask DMOOP to research a topic on
              the live web.</li>
            <li><strong>Product analytics</strong> — internal analytics only; we do not currently use
              ad-tracking SDKs.</li>
          </ul>

          <h2>5. Sharing and disclosure</h2>
          <p>We do not sell your personal data. We may disclose it only in these limited circumstances:</p>
          <ul>
            <li>With your consent or at your direction.</li>
            <li>To service providers acting on our behalf (Section 4).</li>
            <li>To comply with law, legal process, or governmental requests, or to protect the rights,
              safety, or property of DMOOP, our users, or others.</li>
            <li>In connection with a merger, acquisition, financing, or sale of assets, with notice to
              you and continued protection of your data.</li>
          </ul>

          <h2>6. Data retention</h2>
          <p>
            We retain account data for as long as your account is active and for a reasonable period
            afterward to comply with legal obligations, resolve disputes, and enforce agreements.
            Uploaded brand documents and chat history are retained while your account is active and
            deleted on your request. Anonymized, aggregated usage data may be retained indefinitely.
          </p>

          <h2>7. Your rights</h2>
          <p>
            Depending on where you live, you may have rights under the EU/UK GDPR, the India DPDP Act,
            the California CCPA/CPRA, and similar laws, including the right to:
          </p>
          <ul>
            <li>Access the personal data we hold about you.</li>
            <li>Correct or update inaccurate data.</li>
            <li>Delete your account and associated data.</li>
            <li>Object to or restrict certain processing.</li>
            <li>Port your data in a machine-readable format.</li>
            <li>Withdraw consent at any time (where processing is based on consent).</li>
            <li>Lodge a complaint with your supervisory authority.</li>
          </ul>
          <p>
            To exercise any of these rights, email us at{" "}
            <a href="mailto:privacy@dmoop.com" className="text-[var(--dmoop-accent)] font-medium">
              privacy@dmoop.com
            </a>
            . We respond within the timeframes required by applicable law.
          </p>

          <h2>8. International data transfers</h2>
          <p>
            DMOOP and its providers may process data in the United States, India, and other countries
            where our infrastructure operates. Where required, we use safeguards such as standard
            contractual clauses to protect cross-border transfers.
          </p>

          <h2>9. Children</h2>
          <p>
            DMOOP is intended for business and professional use. The Service is not directed to
            children under 16, and we do not knowingly collect personal data from children. If you
            believe a child has provided us personal data, please contact{" "}
            <a href="mailto:privacy@dmoop.com" className="text-[var(--dmoop-accent)] font-medium">
              privacy@dmoop.com
            </a>{" "}
            and we will delete it.
          </p>

          <h2>10. Security</h2>
          <p>
            We use industry-standard administrative, technical, and physical safeguards including
            encryption in transit (HTTPS/TLS), encrypted storage at rest with our cloud providers,
            access controls, and audit logging. No security system is perfect; if you believe your
            account has been compromised, contact us immediately at{" "}
            <a href="mailto:security@dmoop.com" className="text-[var(--dmoop-accent)] font-medium">
              security@dmoop.com
            </a>
            .
          </p>

          <h2>11. Cookies</h2>
          <p>
            We use first-party cookies and similar technologies only for the following purposes:
          </p>
          <ul>
            <li><strong>Strictly necessary</strong> — to keep you signed in and remember your preferences.</li>
            <li><strong>Analytics</strong> — to measure aggregate usage and improve the Service.</li>
          </ul>
          <p>
            You can control cookies through your browser settings. Disabling strictly necessary
            cookies will prevent you from signing in.
          </p>

          <h2>12. Changes to this policy</h2>
          <p>
            We may update this Policy from time to time. If we make material changes, we will notify
            you by email or by a prominent notice within the Service before the changes take effect.
            The &quot;Effective&quot; date at the top of this page indicates when this Policy was last
            updated.
          </p>

          <h2>13. Contact us</h2>
          <p>
            For privacy questions or to exercise your rights, contact us at:
          </p>
          <p>
            DMOOP Privacy Team<br />
            Email:{" "}
            <a href="mailto:privacy@dmoop.com" className="text-[var(--dmoop-accent)] font-medium">
              privacy@dmoop.com
            </a>
          </p>
          <p>
            See also our{" "}
            <Link href="/terms" className="text-[var(--dmoop-accent)] font-medium">
              Terms of Service
            </Link>
            .
          </p>
        </div>
      </article>

      <footer className="relative py-8 border-t border-[var(--dmoop-border-soft)] mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/dmoop-logo.png" alt="DMOOP" width={100} height={28} className="h-6 w-auto" />
            <span className="text-[11px] text-[var(--dmoop-text-tertiary)]">© {new Date().getFullYear()} DMOOP</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/docs/api" className="text-[12px] font-medium text-[var(--dmoop-text-secondary)] hover:text-[var(--dmoop-text-primary)]">
              API
            </Link>
            <Link href="/terms" className="text-[12px] font-medium text-[var(--dmoop-text-secondary)] hover:text-[var(--dmoop-text-primary)]">
              Terms
            </Link>
            <Link href="/" className="text-[12px] font-medium text-[var(--dmoop-text-secondary)] hover:text-[var(--dmoop-text-primary)] flex items-center gap-1">
              <ArrowLeft size={12} /> Back to home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
