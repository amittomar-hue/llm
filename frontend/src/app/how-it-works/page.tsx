import type { Metadata } from "next";
import HowItWorksClient from "./HowItWorksClient";

export const metadata: Metadata = {
  title: "How DMOOP works — brand agent, CRM grounding, live intel, exportable output",
  description:
    "The full data path behind a DMOOP response: prompt intake, brand voice retrieval, CRM contact lookup, live web + intel grounding, model generation, multi-format export.",
};

export default function HowItWorksPage() {
  return <HowItWorksClient />;
}
