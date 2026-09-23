import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { authCallbackDestination } from "@/lib/auth/return-path";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const response = NextResponse.redirect(new URL(authCallbackDestination(requestUrl, false), request.url));
  response.headers.set("cache-control", "no-store");
  const code = requestUrl.searchParams.get("code");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!code || !url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headersToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headersToSet).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });
  const flowId = requestUrl.searchParams.get("sb_flow_id");
  const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
  if (!error) response.headers.set("location", new URL(authCallbackDestination(requestUrl, true), request.url).toString());
  return response;
}
