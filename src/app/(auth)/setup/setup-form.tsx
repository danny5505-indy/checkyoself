"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { setUpFamily } from "../actions";

export function SetupForm() {
  const [state, action] = useActionState(setUpFamily, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Family name" name="family_name" defaultValue={state?.values?.family_name} placeholder="The Gross Family" required />
      <Field label="Your name" name="display_name" defaultValue={state?.values?.display_name} placeholder="Dan" required />
      <Field label="Your email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} required />
      <Field
        label="Choose a password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        hint="At least 8 characters."
        required
      />
      <FormMessage state={state} />
      <SubmitButton pendingText="Setting up…">Create family</SubmitButton>
    </form>
  );
}
