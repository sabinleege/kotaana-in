import AuthClient from "@/components/AuthClient";

export default function AuthPage() {
  // Google is only offered when its credentials are configured on the server.
  return <AuthClient googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} />;
}
