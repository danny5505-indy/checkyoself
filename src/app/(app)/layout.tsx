import { Suspense } from "react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { CheckMark } from "@/components/logo";
import { TabBar, TabBarView } from "@/components/tab-bar";
import { PageSkeleton } from "@/components/page-skeleton";
import { requireMember } from "@/lib/auth";
import { loadBalance } from "@/lib/points/data";

// The frame (header + tab bar) is static so it shows instantly. Anything that
// reads the signed-in user streams in behind a Suspense boundary.
// Signed-out visitors never get here: src/proxy.ts redirects them to /login.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2 font-bold text-ink">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
              <CheckMark className="h-5 w-5" />
            </span>
            Check Yo Self
          </Link>
          <Suspense fallback={<span className="h-8 w-8 rounded-full bg-line" />}>
            <ProfileButton />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-5">
        <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
      </main>
      <Suspense fallback={<TabBarView pathname={null} />}>
        <TabBar />
      </Suspense>
    </div>
  );
}

async function ProfileButton() {
  const { profile } = await requireMember();
  const points = await loadBalance(profile.id);
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/rewards"
        aria-label={`${points} points`}
        className="rounded-full bg-amber-500/15 px-2.5 py-1 text-sm font-bold text-amber-700 dark:text-amber-300"
      >
        ⭐ {points.toLocaleString()}
      </Link>
      <Link href="/settings" aria-label="Your profile and settings">
        <Avatar name={profile.display_name} color={profile.color} size="sm" />
      </Link>
    </div>
  );
}
