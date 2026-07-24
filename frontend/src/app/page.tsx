import { redirect } from "next/navigation";

// This deployment is an app-only build (no marketing site).
// Route the root URL straight into the app. Authenticated users land on
// /chat; unauthenticated users are bounced to /signin by the middleware
// via the /chat protected-route redirect chain.
export default function RootPage() {
  redirect("/chat");
}
