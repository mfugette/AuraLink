// DB-backed subscription + billing repository. Source of truth for a user's tier
// (the API's enforcement boundary; client TierService is UX only) and their
// billing history. Mirrors Subscription / BillingRecord in the client's
// subscription.service.ts. Same conventions as account.store.ts.
//
// NOTE (testing phase): tier is stored but not yet used for enforcement — the
// server applies fixed tester caps (see config/access.ts). These methods still
// read/write the real tier so the UI and billing history work end-to-end.

import { supabaseAdmin } from './supabase';

export type Tier = 'free' | 'plus' | 'pro';
export type BillingInterval = 'monthly' | 'annual';
export type BillingKind = 'plan' | 'adapter' | 'bundle';
export type FulfillmentStatus = 'active' | 'processing' | 'shipped' | 'delivered' | 'refunded';

export interface Subscription {
  tier: Tier;
  interval: BillingInterval;
  canceled: boolean;
  startedAt: string;
  renewsAt: string | null;
}

export interface BillingRecord {
  id: string;
  date: string;            // charged_at
  label: string;
  amount: number;
  kind: BillingKind;
  status: FulfillmentStatus;
  cardLast4: string | null;
}

interface SubscriptionRow {
  user_id: string;
  tier: Tier;
  interval: BillingInterval;
  canceled: boolean;
  started_at: string;
  renews_at: string | null;
}

interface BillingRow {
  id: string;
  user_id: string;
  charged_at: string;
  label: string;
  amount: number | string;
  kind: BillingKind;
  status: FulfillmentStatus;
  card_last4: string | null;
}

function toSubscription(r: SubscriptionRow): Subscription {
  return {
    tier: r.tier,
    interval: r.interval,
    canceled: r.canceled,
    startedAt: r.started_at,
    renewsAt: r.renews_at,
  };
}

function toBilling(r: BillingRow): BillingRecord {
  return {
    id: r.id,
    date: r.charged_at,
    label: r.label,
    amount: Number(r.amount),
    kind: r.kind,
    status: r.status,
    cardLast4: r.card_last4,
  };
}

export const subscriptionsStore = {
  async get(userId: string): Promise<Subscription | null> {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data ? toSubscription(data as SubscriptionRow) : null;
  },

  // The bare tier — used by access resolution when billing is honored. Defaults
  // to 'free' if no row exists yet.
  async getTier(userId: string): Promise<Tier> {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('tier')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return (data?.tier as Tier) ?? 'free';
  },

  // Set/replace the subscription (called by the checkout flow server-side once
  // billing is wired; today the client records purchases and this is the seam).
  async upsert(userId: string, sub: Subscription): Promise<Subscription> {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          tier: sub.tier,
          interval: sub.interval,
          canceled: sub.canceled,
          started_at: sub.startedAt,
          renews_at: sub.renewsAt,
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return toSubscription(data as SubscriptionRow);
  },

  async listBilling(userId: string): Promise<BillingRecord[]> {
    const { data, error } = await supabaseAdmin
      .from('billing_history')
      .select('*')
      .eq('user_id', userId)
      .order('charged_at', { ascending: false });
    if (error) throw error;
    return (data as BillingRow[]).map(toBilling);
  },

  async addBilling(userId: string, rec: Omit<BillingRecord, 'id'>): Promise<BillingRecord> {
    const { data, error } = await supabaseAdmin
      .from('billing_history')
      .insert({
        user_id: userId,
        charged_at: rec.date,
        label: rec.label,
        amount: rec.amount,
        kind: rec.kind,
        status: rec.status,
        card_last4: rec.cardLast4,
      })
      .select('*')
      .single();
    if (error) throw error;
    return toBilling(data as BillingRow);
  },
};
