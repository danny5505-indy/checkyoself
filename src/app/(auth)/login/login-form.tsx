"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { signIn } from "../actions";

export function LoginForm() {
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state?.values?.email}
        required
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <FormMessage state={state} />
      <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
