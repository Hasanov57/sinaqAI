import { createHmac } from "node:crypto";

export function anonymousAiVisitorHash(request: Request): string | null {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  // Vercel overwrites x-forwarded-for, so the visitor cannot spoof this value there.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHmac("sha256", secret).update(`sinaqai-ai:${ip}`).digest("hex");
}
