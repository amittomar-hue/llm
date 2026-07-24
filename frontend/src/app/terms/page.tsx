import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";

const EFFECTIVE_DATE = "June 17, 2026";

export const metadata: Metadata = {
  title: "Terms of Service — Reverb",
  description:
    "The terms and conditions that govern your use of Reverb. Effective " + EFFECTIVE_DATE + ".",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service — Reverb",
    description: "The terms and conditions that govern your use of Reverb.",
    url: "/terms",
    type: "website",
  },
};

export default function TermsPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://llm-amits-projects-d3468251.vercel.app" },
      { "@type": "ListItem", position: 2, name: "Terms of Service", item: "https://llm-amits-projects-d3468251.vercel.app/terms" },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--reverb-bg-app)" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <nav className="sticky top-0 z-30 border-b border-[var(--reverb-border-soft)] backdrop-blur-xl bg-white/70">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <Image src="/reverb-logo.png" alt="Reverb" width={130} height={36} priority className="h-7 sm:h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/" className="text-[12.5px] sm:text-[13px] font-medium text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-text-primary)] flex items-center gap-1">
              <ArrowLeft size={13} /> Home
            </Link>
            <Link href="/chat" className="h-8 sm:h-9 px-3 sm:px-4 rounded-lg reverb-btn-primary text-[12.5px] sm:text-[13px] font-semibold flex items-center gap-1.5 shrink-0">
              Open Reverb <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </nav>

      <article className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-12 sm:pb-20 w-full">
        <p className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.14em] text-[var(--reverb-accent)] uppercase mb-3">
          Legal
        </p>
        <h1 className="text-[28px] sm:text-[42px] font-semibold tracking-tight text-[var(--reverb-text-primary)] leading-[1.15] mb-3">
          Terms of Service
        </h1>
        <p className="text-[13px] text-[var(--reverb-text-tertiary)] mb-8 pb-6 border-b border-[var(--reverb-border-soft)]">
          Effective {EFFECTIVE_DATE}
        </p>

        <div className="resource-prose">
          <p>
            These Terms of Service (&quot;Terms&quot;) form a binding agreement between you (&quot;you&quot;,
            &quot;Customer&quot;) and Reverb (&quot;Reverb&quot;, &quot;we&quot;, &quot;us&quot;) governing your access to and use of
            the Reverb platform, including
            <Link href="/" className="text-[var(--reverb-accent)] font-medium"> www.reverb.com </Link>
            and the related Brand Agent, chat, and analytics tools (collectively, the
            &quot;Service&quot;). By creating an account or otherwise using the Service, you accept
            these Terms. If you do not accept them, do not use the Service.
          </p>

          <h2>1. Eligibility and account</h2>
          <p>
            You must be at least 18 years old (or the age of majority in your jurisdiction) and able to
            enter into a binding contract to use the Service. If you use the Service on behalf of an
            organization, you represent that you have authority to bind that organization to these
            Terms, and &quot;you&quot; refers to that organization. You are responsible for keeping your
            credentials confidential and for all activity under your account.
          </p>

          <h2>2. The Service</h2>
          <p>
            Reverb provides an AI-assisted marketing intelligence platform that helps you draft, plan,
            and analyze marketing assets and campaigns. The Service uses third-party large language
            models, automated tools, and live web sources to generate outputs based on your prompts
            and uploaded materials. The Service may evolve over time; we may add, change, or
            discontinue features at our discretion, with reasonable notice for material changes.
          </p>

          <h2>3. Permitted use</h2>
          <p>You may use the Service for lawful business and personal purposes only. You agree NOT to:</p>
          <ul>
            <li>Use the Service to generate or distribute content that is illegal, fraudulent,
              defamatory, infringing, harassing, hateful, sexually explicit involving minors, or
              violates a third party&apos;s rights.</li>
            <li>Use the Service to develop a competing product, reverse engineer the Service, or scrape
              the Service in bulk.</li>
            <li>Attempt to bypass authentication, rate limits, or other access controls.</li>
            <li>Upload content you do not have the right to use, or content containing personal data of
              third parties without lawful basis.</li>
            <li>Interfere with the Service&apos;s operation or other users&apos; enjoyment of the Service.</li>
            <li>Use the Service to make decisions producing legal or similarly significant effects on
              individuals (e.g., employment, credit, insurance) without appropriate human review.</li>
          </ul>

          <h2>4. Your content</h2>
          <p>
            You retain all ownership of materials you upload to the Service (&quot;Customer Content&quot;).
            You grant Reverb a worldwide, non-exclusive, royalty-free license to host, process, transmit,
            and modify Customer Content solely as necessary to provide the Service to you and to
            improve the Service in aggregated, de-identified form. We do not use Customer Content to
            train third-party AI models without your explicit consent.
          </p>

          <h2>5. AI-generated output</h2>
          <p>
            The Service generates output using probabilistic AI models. Output may contain
            inaccuracies, omissions, or content that does not reflect current facts. You are solely
            responsible for reviewing output before relying on it, publishing it, or using it for any
            business or legal purpose. To the extent permitted by law, Reverb assigns to you whatever
            rights it has in the output generated specifically in response to your prompts, subject
            to the limitations of underlying AI providers&apos; terms. The same or similar output may
            be generated for other users, and we make no exclusivity guarantee with respect to AI
            output.
          </p>

          <h2>6. Intellectual property</h2>
          <p>
            Except for Customer Content and AI-generated output as described above, Reverb and its
            licensors retain all right, title, and interest in and to the Service, including all
            software, designs, trademarks, and documentation. No rights are granted to you by
            implication, estoppel, or otherwise.
          </p>

          <h2>7. Fees and billing</h2>
          <p>
            The Service may include free and paid tiers. Fees, billing cycles, and refund policies
            for paid tiers will be presented at sign-up for the relevant plan and are incorporated
            into these Terms by reference. You authorize us and our payment processor to charge the
            payment method on file for all fees due. Late or unpaid amounts may result in suspension
            or termination of the Service.
          </p>

          <h2>8. Privacy</h2>
          <p>
            Our collection and use of personal data is described in our{" "}
            <Link href="/privacy" className="text-[var(--reverb-accent)] font-medium">
              Privacy Policy
            </Link>
            , which is incorporated into these Terms by reference. By using the Service you also agree
            to that Policy.
          </p>

          <h2>9. Confidentiality</h2>
          <p>
            Each party agrees to protect the other&apos;s confidential information with at least the
            same degree of care it uses to protect its own confidential information, and not less
            than reasonable care. Confidential information does not include information that is
            publicly available, already known, independently developed, or rightfully received from a
            third party.
          </p>

          <h2>10. Disclaimers</h2>
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;. TO THE FULLEST EXTENT
            PERMITTED BY LAW, Reverb DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY,
            INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND
            NON-INFRINGEMENT. Reverb DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE,
            SECURE, OR THAT AI OUTPUT WILL BE ACCURATE, COMPLETE, OR APPROPRIATE FOR ANY PURPOSE.
          </p>

          <h2>11. Limitation of liability</h2>
          <p>
            TO THE FULLEST EXTENT PERMITTED BY LAW, IN NO EVENT WILL Reverb, ITS AFFILIATES, OFFICERS,
            EMPLOYEES, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
            OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT
            OF OR RELATED TO THESE TERMS OR YOUR USE OF THE SERVICE. Reverb&apos;S AGGREGATE LIABILITY
            FOR ANY CLAIM ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE WILL NOT EXCEED THE
            GREATER OF (A) THE AMOUNT YOU PAID TO Reverb IN THE TWELVE MONTHS PRECEDING THE CLAIM, OR
            (B) ONE HUNDRED U.S. DOLLARS (USD 100).
          </p>

          <h2>12. Indemnification</h2>
          <p>
            You agree to defend, indemnify, and hold harmless Reverb and its affiliates, officers,
            employees, and agents from any claim, demand, loss, or expense (including reasonable
            attorneys&apos; fees) arising out of or relating to: (i) your Customer Content; (ii) your
            use of the Service in violation of these Terms or applicable law; or (iii) your violation
            of any third-party right, including any intellectual property or privacy right.
          </p>

          <h2>13. Termination</h2>
          <p>
            You may terminate your account at any time from your settings or by emailing us. We may
            suspend or terminate your access to the Service if you breach these Terms, fail to pay
            applicable fees, or use the Service in a way that could subject Reverb to liability. Upon
            termination, your right to use the Service ends immediately. Sections that by their nature
            should survive termination will survive (including ownership, disclaimers, limitations of
            liability, and indemnification).
          </p>

          <h2>14. Changes to these Terms</h2>
          <p>
            We may update these Terms from time to time. If we make material changes, we will notify
            you by email or by a prominent notice within the Service before the changes take effect.
            Your continued use of the Service after changes take effect constitutes acceptance of the
            updated Terms.
          </p>

          <h2>15. Governing law and disputes</h2>
          <p>
            These Terms are governed by the laws of the State of Delaware, USA, without regard to its
            conflict-of-laws principles. Any dispute arising out of or related to these Terms or the
            Service will be resolved exclusively in the state or federal courts located in Delaware,
            and you and Reverb consent to the personal jurisdiction of those courts. If you are based
            in India, you may alternatively bring suit in the courts of Bengaluru, Karnataka, India.
            Nothing in this section prevents either party from seeking injunctive relief in any court
            of competent jurisdiction.
          </p>

          <h2>16. Miscellaneous</h2>
          <p>
            These Terms (together with the Privacy Policy and any order forms) are the entire
            agreement between you and Reverb regarding the Service. If any provision is found
            unenforceable, the remainder of the Terms remain in effect. Our failure to enforce any
            right is not a waiver. You may not assign these Terms without our written consent; we may
            assign them to an affiliate or successor in connection with a merger, acquisition, or sale
            of assets.
          </p>

          <h2>17. Contact</h2>
          <p>
            Questions about these Terms? Email us at{" "}
            <a href="mailto:legal@reverb.com" className="text-[var(--reverb-accent)] font-medium">
              legal@reverb.com
            </a>
            .
          </p>
        </div>
      </article>

      <footer className="relative py-8 border-t border-[var(--reverb-border-soft)] mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/reverb-logo.png" alt="Reverb" width={100} height={28} className="h-6 w-auto" />
            <span className="text-[11px] text-[var(--reverb-text-tertiary)]">© {new Date().getFullYear()} Reverb</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/docs/api" className="text-[12px] font-medium text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-text-primary)]">
              API
            </Link>
            <Link href="/privacy" className="text-[12px] font-medium text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-text-primary)]">
              Privacy
            </Link>
            <Link href="/" className="text-[12px] font-medium text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-text-primary)] flex items-center gap-1">
              <ArrowLeft size={12} /> Back to home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
