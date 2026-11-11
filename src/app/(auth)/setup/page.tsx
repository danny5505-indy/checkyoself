import { redirect } from "next/navigation";
import { needsSetup } from "../actions";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Set up your family" };

export default async function SetupPage() {
  if (!(await needsSetup())) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Set up your family</h1>
        <p className="mt-1 text-muted">
          You&apos;ll be the first parent. You can add everyone else from the Parent dashboard.
        </p>
      </div>
      <SetupForm />
    </div>
  );
}
