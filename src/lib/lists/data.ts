import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { List, ListItem } from "./types";

const LIST_COLS = "id, family_id, owner_id, title, emoji, kind, shared_with_all, per_person, created_at";
const ITEM_COLS =
  "id, list_id, text, quantity, notes, link, due_date, done, done_by, added_by, sort_order, created_at";

export type ListSummary = List & { shares: string[]; open: number; total: number };

// Creates the family's shared grocery list and returns it (call when it's missing).
// Returns null if someone else created it at the same moment.
export async function createGroceryList(familyId: string, profileId: string): Promise<ListSummary | null> {
  const supabase = await createClient();
  // The unique index makes a race harmless: a second insert just fails.
  const { data } = await supabase
    .from("lists")
    .insert({ family_id: familyId, owner_id: profileId, title: "Groceries", emoji: "🛒", kind: "grocery" })
    .select(LIST_COLS)
    .maybeSingle<List>();
  return data ? { ...data, shares: [], open: 0, total: 0 } : null;
}

// Every list the signed-in person can see, with item counts.
export async function loadLists(): Promise<ListSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lists")
    .select(`${LIST_COLS}, list_shares(profile_id), list_items(done)`)
    .order("created_at");
  if (error) throw new Error(`Couldn't load lists: ${error.message}`);
  return (data ?? []).map((l) => {
    const { list_shares, list_items, ...list } = l as List & {
      list_shares: { profile_id: string }[];
      list_items: { done: boolean }[];
    };
    return {
      ...list,
      shares: list_shares.map((s) => s.profile_id),
      total: list_items.length,
      open: list_items.filter((i) => !i.done).length,
    };
  });
}

export type ListDetail = {
  list: List;
  shares: string[];
  items: ListItem[];
  checks: { item_id: string; profile_id: string }[];
  claims: { item_id: string; claimed_by: string }[];
};

export async function loadList(id: string): Promise<ListDetail | null> {
  const supabase = await createClient();
  const { data: list } = await supabase.from("lists").select(LIST_COLS).eq("id", id).maybeSingle<List>();
  if (!list) return null;
  const [shares, items] = await Promise.all([
    supabase.from("list_shares").select("profile_id").eq("list_id", id),
    supabase.from("list_items").select(ITEM_COLS).eq("list_id", id).order("sort_order").order("created_at").returns<ListItem[]>(),
  ]);
  const itemIds = (items.data ?? []).map((i) => i.id);
  const [checks, claims] = await Promise.all([
    list.per_person && itemIds.length
      ? supabase.from("item_checks").select("item_id, profile_id").in("item_id", itemIds)
      : Promise.resolve({ data: [] }),
    // The database hides claims from the list's owner; this returns nothing for them.
    list.kind === "wishlist" && itemIds.length
      ? supabase.from("wishlist_claims").select("item_id, claimed_by").in("item_id", itemIds)
      : Promise.resolve({ data: [] }),
  ]);
  return {
    list,
    shares: (shares.data ?? []).map((s) => s.profile_id as string),
    items: items.data ?? [],
    checks: (checks.data ?? []) as ListDetail["checks"],
    claims: (claims.data ?? []) as ListDetail["claims"],
  };
}

// The person's own to-dos that are due by `day` and not done.
export async function loadDueTodos(profileId: string, day: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("list_items")
    .select(`${ITEM_COLS}, lists!inner(id, title, emoji, kind, owner_id)`)
    .eq("lists.kind", "todo")
    .eq("lists.owner_id", profileId)
    .eq("done", false)
    .not("due_date", "is", null)
    .lte("due_date", day)
    .order("due_date")
    .returns<(ListItem & { lists: { id: string; title: string; emoji: string } })[]>();
  return data ?? [];
}
