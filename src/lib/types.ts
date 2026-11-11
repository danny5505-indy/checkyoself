export type FamilyRole = "parent" | "kid";

export type Profile = {
  id: string;
  family_id: string;
  display_name: string;
  role: FamilyRole;
  color: string;
  created_at: string;
};

export type Family = {
  id: string;
  name: string;
};

// Colors people can pick for their profile.
export const PROFILE_COLORS = [
  "#4f46e5", // indigo
  "#0891b2", // cyan
  "#059669", // emerald
  "#65a30d", // lime
  "#d97706", // amber
  "#dc2626", // red
  "#db2777", // pink
  "#9333ea", // purple
  "#475569", // slate
] as const;

// Result returned by forms that use useActionState.
// `values` echoes typed fields back after an error, because React clears forms on submit.
export type FormState =
  | { error?: string; success?: string; values?: Record<string, string> }
  | undefined;
