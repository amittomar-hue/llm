import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Keys",
  robots: { index: false, follow: false },
};

export default function ApiKeysLayout({ children }: { children: React.ReactNode }) {
  return children;
}
