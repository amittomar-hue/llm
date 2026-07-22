import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integrations",
  robots: { index: false, follow: false },
};

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
