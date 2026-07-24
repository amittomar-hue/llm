import type { Metadata } from "next";

// Auth pages don't need to be indexed — they're functional surfaces,
// not content. Search results for "Reverb sign in" should land on the
// homepage which has the CTAs, not on the raw form.
export const metadata: Metadata = {
  title: "Sign In",
  robots: { index: false, follow: false },
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
