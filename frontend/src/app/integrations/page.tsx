import type { Metadata } from "next";
import IntegrationsClient from "./IntegrationsClient";

export const metadata: Metadata = {
  title: "DMOOP integrations — HubSpot & Zoho CRM grounding for every message",
  description:
    "Connect HubSpot or Zoho to DMOOP and every generated email, message, and campaign uses live contact, deal, and touchpoint context.",
};

export default function IntegrationsMarketingPage() {
  return <IntegrationsClient />;
}
