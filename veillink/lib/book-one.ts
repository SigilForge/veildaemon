import type { SupabaseClient } from "@supabase/supabase-js";

export type BookOnePurchase = {
  stripe_checkout_session_id: string;
  purchased_at: string | null;
};

/**
 * Paid Book One purchases visible to the signed-in user. Uses the user's own
 * client, so row-level security decides ownership: purchases bound to this
 * account, or made under this account's (confirmed) email before it existed.
 */
export async function listBookOnePurchases(supabase: unknown): Promise<BookOnePurchase[]> {
  // book_one_purchases is not in the generated Database types.
  const { data, error } = await (supabase as SupabaseClient)
    .from("book_one_purchases")
    .select("stripe_checkout_session_id,purchased_at")
    .eq("payment_status", "paid")
    .order("purchased_at", { ascending: false });
  if (error) throw error;
  return (data || []) as BookOnePurchase[];
}

/** Re-download through the canonical claim, which re-verifies payment and issues fresh links. */
export function bookOneClaimPath(sessionId: string) {
  return `/api/book-one/claim?session_id=${encodeURIComponent(sessionId)}`;
}
