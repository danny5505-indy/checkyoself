export type ListKind = "grocery" | "checklist" | "wishlist" | "todo";

export type List = {
  id: string;
  family_id: string;
  owner_id: string;
  title: string;
  emoji: string;
  kind: ListKind;
  shared_with_all: boolean;
  per_person: boolean;
  created_at: string;
};

export type ListItem = {
  id: string;
  list_id: string;
  text: string;
  quantity: string | null;
  notes: string | null;
  link: string | null;
  due_date: string | null;
  done: boolean;
  done_by: string | null;
  added_by: string | null;
  sort_order: number;
  created_at: string;
};

export const KIND_INFO: Record<ListKind, { label: string; emoji: string; blurb: string }> = {
  grocery: { label: "Groceries", emoji: "🛒", blurb: "The family grocery list" },
  checklist: { label: "Checklist", emoji: "✅", blurb: "Packing lists, chores, anything to tick off" },
  wishlist: { label: "Wish list", emoji: "🎁", blurb: "Christmas or birthday ideas. Others can secretly mark items bought." },
  todo: { label: "To-dos", emoji: "📌", blurb: "Things to get done, with optional due dates" },
};

export const LIST_EMOJIS = ["📝", "🧳", "🎄", "🎂", "🎁", "📌", "🏕️", "🏖️", "🏫", "🧹", "⚽", "🛍️"] as const;
