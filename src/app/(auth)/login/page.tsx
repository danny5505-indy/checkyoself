import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { needsSetup } from "../actions";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentMember()) redirect("/");
  const firstRun = await needsSetup();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
        <p className="mt-1 text-muted">Sign in to see today&apos;s plan.</p>
      </div>
      <LoginForm />
      {firstRun ? (
        <p className="text-sm text-muted">
          First time here?{" "}
          <Link href="/setup" className="font-semibold text-brand-strong underline">
            Set up your family
          </Link>
        </p>
      ) : (
        <p className="text-sm text-muted">Forgot your password? Ask a parent to reset it.</p>
      )}
    </div>
  );
}
