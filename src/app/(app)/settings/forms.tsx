"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { ColorPicker } from "@/components/color-picker";
import { changeMyPassword, updateMyProfile } from "./actions";

export function ProfileForm({ name, color }: { name: string; color: string }) {
  const [state, action] = useActionState(updateMyProfile, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field
        label="Name"
        name="display_name"
        defaultValue={state?.values?.display_name ?? name}
        maxLength={40}
        required
      />
      <ColorPicker name="color" defaultValue={state?.values?.color ?? color} />
      <FormMessage state={state} />
      <SubmitButton>Save profile</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changeMyPassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field
        label="Current password"
        name="current_password"
        type="password"
        autoComplete="current-password"
        required
      />
      <Field
        label="New password"
        name="new_password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        hint="At least 8 characters."
        required
      />
      <FormMessage state={state} />
      <SubmitButton>Change password</SubmitButton>
    </form>
  );
}
