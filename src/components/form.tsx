"use client";

import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/types";

export function Field({
  label,
  hint,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <input
        {...input}
        className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25"
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-brand text-white hover:bg-brand-strong",
    secondary: "border border-line bg-surface text-ink hover:bg-canvas",
    danger: "border border-danger/40 bg-surface text-danger hover:bg-danger/5",
  }[variant];
  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full rounded-xl px-4 py-2.5 text-base font-semibold transition disabled:opacity-60 ${styles}`}
    >
      {pending ? (pendingText ?? "Saving…") : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state?.error && !state?.success) return null;
  const isError = Boolean(state.error);
  return (
    <p
      role={isError ? "alert" : "status"}
      className={`rounded-xl px-3 py-2 text-sm ${
        isError ? "bg-danger/10 text-danger" : "bg-brand/10 text-brand-strong"
      }`}
    >
      {state.error ?? state.success}
    </p>
  );
}
