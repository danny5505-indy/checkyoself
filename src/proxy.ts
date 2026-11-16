import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  try {
    return await updateSession(request);
  } catch (error) {
    // Usually a setup problem (missing or wrong Supabase settings in Vercel).
    // Show a readable page instead of a bare "Internal Server Error".
    // Messages here name the setting that's wrong; they never include key values.
    const message = error instanceof Error ? error.message : String(error);
    console.error("Proxy failed:", message);
    return new NextResponse(setupProblemPage(message), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }
}

function setupProblemPage(message: string) {
  const safe = message.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Check Yo Self: setup problem</title></head>
<body style="font-family:-apple-system,system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5">
<h1 style="font-size:1.4rem">Check Yo Self can't start yet</h1>
<p>There's a problem with the app's settings:</p>
<pre style="white-space:pre-wrap;background:#f3f4f6;padding:.75rem;border-radius:.5rem">${safe}</pre>
<p>Check the Environment Variables in Vercel, then redeploy.</p>
</body></html>`;
}

export const config = {
  matcher: [
    // Everything except static files, images and the app icons/manifest.
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
