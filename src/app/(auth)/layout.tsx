import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { PageSkeleton } from "@/components/page-skeleton";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <Logo />
      <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
    </main>
  );
}
