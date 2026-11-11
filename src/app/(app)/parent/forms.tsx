"use client";

import { useActionState } from "react";
import { ColorPicker } from "@/components/color-picker";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import type { Profile } from "@/lib/types";
import { addMember, renameFamily, resetMemberPassword, updateMember } from "./actions";

function RolePicker({ defaultValue = "kid", disabled }: { defaultValue?: string; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-2 text-sm font-medium text-ink">Role</legend>
      <div className="grid grid-cols-2 gap-2">
        {[
          { value: "kid", label: "Kid" },
          { value: "parent", label: "Parent" },
        ].map((r) => (
          <label key={r.value} className="cursor-pointer">
            <input
              type="radio"
              name="role"
              value={r.value}
              defaultChecked={r.value === defaultValue}
              className="peer sr-only"
            />
            <span className="block rounded-xl border border-line px-3 py-2 text-center font-medium text-ink transition peer-checked:border-brand peer-checked:bg-brand/10 peer-checked:text-brand-strong peer-disabled:opacity-60">
              {r.label}
            </span>
          </label>
        ))}
      </div>
      {disabled && (
        <p className="mt-1 text-xs text-muted">You can&apos;t change your own role.</p>
      )}
    </fieldset>
  );
}

export function AddMemberForm() {
  const [state, action] = useActionState(addMember, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Name" name="display_name" maxLength={40} defaultValue={state?.values?.display_name} required />
      <Field label="Email" name="email" type="email" autoComplete="off" defaultValue={state?.values?.email} required />
      <Field
        label="Starting password"
        name="password"
        type="text"
        autoComplete="off"
        minLength={8}
        hint="At least 8 characters."
        required
      />
      <RolePicker key={`role-${state?.values?.role}`} defaultValue={state?.values?.role} />
      <ColorPicker key={`color-${state?.values?.color}`} name="color" defaultValue={state?.values?.color ?? "#0891b2"} />
      <FormMessage state={state} />
      <SubmitButton pendingText="Adding…">Add member</SubmitButton>
    </form>
  );
}

export function MemberEditor({ member, isMe }: { member: Profile; isMe: boolean }) {
  const [state, action] = useActionState(updateMember, undefined);
  const [pwState, pwAction] = useActionState(resetMemberPassword, undefined);
  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4">
        <input type="hidden" name="member_id" value={member.id} />
        {/* A disabled radio isn't submitted, so send the current role for yourself. */}
        {isMe && <input type="hidden" name="role" value={member.role} />}
        <Field label="Name" name="display_name" defaultValue={member.display_name} maxLength={40} required />
        <RolePicker defaultValue={member.role} disabled={isMe} />
        <FormMessage state={state} />
        <SubmitButton>Save</SubmitButton>
      </form>
      {!isMe && (
        <form action={pwAction} className="space-y-4 border-t border-line pt-4">
          <input type="hidden" name="member_id" value={member.id} />
          <Field
            label={`New password for ${member.display_name}`}
            name="password"
            type="text"
            autoComplete="off"
            minLength={8}
            hint="Use this if they forgot their password."
            required
          />
          <FormMessage state={pwState} />
          <SubmitButton variant="secondary">Reset password</SubmitButton>
        </form>
      )}
    </div>
  );
}

export function FamilyNameForm({ name }: { name: string }) {
  const [state, action] = useActionState(renameFamily, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Name" name="family_name" defaultValue={name} maxLength={60} required />
      <FormMessage state={state} />
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}
