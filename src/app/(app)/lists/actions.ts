"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";

type Result = { error?: string };
const uuid = z.string().uuid();

const listSchema = z.object({
  title: z.string().trim().min(1, "Give the list a name").max(60),
  emoji: z.string().min(1).max(8),
  kind: z.enum(["checklist", "wishlist", "todo"]),
  shares: z.array(z.string().uuid()).max(20),
  per_person: z.boolean(),
});

function readListForm(formData: FormData) {
  return listSchema.safeParse({
    title: formData.get("title"),
    emoji: formData.get("emoji") || "📝",
    kind: formData.get("kind") || "checklist",
    shares: formData.getAll("shares").map(String),
    per_person: formData.get("per_person") === "on",
  });
}

async function setShares(listId: string, ownerId: string, shares: string[]) {
  const supabase = await createClient();
  const wanted = [...new Set(shares.filter((id) => id !== ownerId))];
  await supabase.from("list_shares").delete().eq("list_id", listId);
  if (wanted.length) {
    const { error } = await supabase
      .from("list_shares")
      .insert(wanted.map((profile_id) => ({ list_id: listId, profile_id })));
    if (error) return error.message;
  }
  return null;
}

export async function createList(_prev: FormState, formData: FormData): Promise<FormState> {
  const { profile } = await requireMember();
  const parsed = readListForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const { shares, ...fields } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lists")
    .insert({
      ...fields,
      per_person: fields.kind === "checklist" && fields.per_person,
      family_id: profile.family_id,
      owner_id: profile.id,
    })
    .select("id")
    .single();
  if (error || !data) return { error: `Couldn't create the list: ${error?.message}` };
  const shareError = await setShares(data.id as string, profile.id, shares);
  if (shareError) return { error: `List created, but sharing failed: ${shareError}` };
  redirect(`/lists/${data.id}`);
}

export async function updateList(_prev: FormState, formData: FormData): Promise<FormState> {
  const { profile } = await requireMember();
  const listId = String(formData.get("list_id") ?? "");
  if (!uuid.safeParse(listId).success) return { error: "Something went wrong." };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("lists").select("kind, owner_id").eq("id", listId).maybeSingle();
  if (!existing || existing.owner_id !== profile.id) return { error: "Only the list's owner can change it." };

  const parsed = readListForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const { error } = await supabase
    .from("lists")
    .update({
      title: parsed.data.title,
      emoji: parsed.data.emoji,
      per_person: existing.kind === "checklist" && parsed.data.per_person,
    })
    .eq("id", listId);
  if (error) return { error: `Couldn't save: ${error.message}` };
  if (existing.kind !== "grocery") {
    const shareError = await setShares(listId, profile.id, parsed.data.shares);
    if (shareError) return { error: `Saved, but sharing failed: ${shareError}` };
  }
  refresh();
  return { success: "Saved." };
}

export async function deleteList(listId: string): Promise<Result> {
  await requireMember();
  if (!uuid.safeParse(listId).success) return { error: "Something went wrong." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("lists").delete().eq("id", listId).select("id");
  if (error || !data?.length) return { error: "You can't delete this list." };
  redirect("/lists");
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

const itemSchema = z.object({
  text: z.string().trim().min(1, "Type something to add").max(200),
  quantity: z.string().trim().max(30).nullable(),
  notes: z.string().trim().max(300).nullable(),
  link: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null)),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export type ItemFields = z.input<typeof itemSchema>;

const blankToNull = (v: string | null | undefined) => (v && v.trim() ? v : null);

export async function addItem(listId: string, fields: ItemFields): Promise<Result> {
  await requireMember();
  if (!uuid.safeParse(listId).success) return { error: "Something went wrong." };
  const parsed = itemSchema.safeParse({
    text: fields.text,
    quantity: blankToNull(fields.quantity),
    notes: blankToNull(fields.notes),
    link: blankToNull(fields.link),
    due_date: blankToNull(fields.due_date),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check that item." };
  const supabase = await createClient();
  const { error } = await supabase.from("list_items").insert({ ...parsed.data, list_id: listId });
  if (error) return { error: /row-level/i.test(error.message) ? "You can't add to this list." : error.message };
  refresh();
  return {};
}

export async function updateItem(itemId: string, fields: ItemFields): Promise<Result> {
  await requireMember();
  if (!uuid.safeParse(itemId).success) return { error: "Something went wrong." };
  const parsed = itemSchema.safeParse({
    text: fields.text,
    quantity: blankToNull(fields.quantity),
    notes: blankToNull(fields.notes),
    link: blankToNull(fields.link),
    due_date: blankToNull(fields.due_date),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check that item." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("list_items").update(parsed.data).eq("id", itemId).select("id");
  if (error || !data?.length) return { error: "You can't change this item." };
  refresh();
  return {};
}

// Checks or unchecks an item. On "everyone checks their own" lists, only your copy changes.
export async function setItemDone(itemId: string, done: boolean): Promise<Result> {
  const { profile } = await requireMember();
  if (!uuid.safeParse(itemId).success) return { error: "Something went wrong." };
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("list_items")
    .select("id, lists!inner(per_person)")
    .eq("id", itemId)
    .maybeSingle<{ id: string; lists: { per_person: boolean } }>();
  if (!item) return { error: "That item is gone." };

  if (item.lists.per_person) {
    const { error } = done
      ? await supabase.from("item_checks").upsert({ item_id: itemId, profile_id: profile.id }, { ignoreDuplicates: true })
      : await supabase.from("item_checks").delete().eq("item_id", itemId).eq("profile_id", profile.id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase.from("list_items").update({ done }).eq("id", itemId).select("id");
    if (error || !data?.length) return { error: "You can't change this item." };
  }
  refresh();
  return {};
}

export async function deleteItem(itemId: string): Promise<Result> {
  await requireMember();
  if (!uuid.safeParse(itemId).success) return { error: "Something went wrong." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("list_items").delete().eq("id", itemId).select("id");
  if (error || !data?.length) return { error: "You can't remove this item." };
  refresh();
  return {};
}

export async function clearDone(listId: string): Promise<Result> {
  await requireMember();
  if (!uuid.safeParse(listId).success) return { error: "Something went wrong." };
  const supabase = await createClient();
  const { error } = await supabase.from("list_items").delete().eq("list_id", listId).eq("done", true);
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function setClaim(itemId: string, claim: boolean): Promise<Result> {
  const { profile } = await requireMember();
  if (!uuid.safeParse(itemId).success) return { error: "Something went wrong." };
  const supabase = await createClient();
  const { error } = claim
    ? await supabase.from("wishlist_claims").insert({ item_id: itemId, claimed_by: profile.id })
    : await supabase.from("wishlist_claims").delete().eq("item_id", itemId).eq("claimed_by", profile.id);
  if (error) {
    return { error: /duplicate|unique/i.test(error.message) ? "Someone already marked this one bought." : "You can't mark this one." };
  }
  refresh();
  return {};
}
