import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { refreshStaleFeeds } from "@/lib/calendar/data";
import { runNudges } from "@/lib/push/nudges";

// Called every 15 minutes by a Supabase scheduled job with the private CRON_SECRET.
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 20) return false;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  // Local testing only: ALLOW_TEST_CLOCK=1 (never set in production) lets a test pick the time.
  const testNow = process.env.ALLOW_TEST_CLOCK === "1" ? request.nextUrl.searchParams.get("now") : null;
  const [report, feedsRefreshed] = await Promise.all([
    runNudges(testNow ? new Date(testNow) : undefined),
    // Keep calendar copies fresh so pages never wait on a download.
    refreshStaleFeeds(45),
  ]);
  return NextResponse.json({ ok: true, ...report, feedsRefreshed });
}

export const GET = handle;
export const POST = handle;
