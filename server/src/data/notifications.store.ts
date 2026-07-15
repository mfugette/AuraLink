// DB-backed notifications repository (Supabase Postgres). Backs the in-app inbox
// (client InboxService), the per-category SMS opt-in prefs (SmsPrefs), and the
// outbound delivery audit log (notify.route.ts). Same conventions as
// account.store.ts: snake_case rows, to* mappers, every method scoped to userId.

import { supabaseAdmin } from './supabase';

export type NotificationCategory = 'maintenance' | 'health' | 'billing' | 'aura';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  read: boolean;
  ctaLabel: string | null;
  ctaRoute: string | null;
  createdAt: string;
}

export type SmsPrefs = Record<NotificationCategory, boolean>;

export type DeliveryChannel = 'sms' | 'email';
export type DeliveryStatus = 'stub' | 'sent' | 'failed';

// ── Row shapes ──────────────────────────────────────────────────────────────
interface NotificationRow {
  id: string;
  user_id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  read: boolean;
  cta_label: string | null;
  cta_route: string | null;
  created_at: string;
}

interface SmsPrefsRow {
  user_id: string;
  maintenance: boolean;
  health: boolean;
  billing: boolean;
  aura: boolean;
}

function toNotification(r: NotificationRow): AppNotification {
  return {
    id: r.id,
    category: r.category,
    title: r.title,
    body: r.body,
    read: r.read,
    ctaLabel: r.cta_label,
    ctaRoute: r.cta_route,
    createdAt: r.created_at,
  };
}

function toSmsPrefs(r: SmsPrefsRow): SmsPrefs {
  return {
    maintenance: r.maintenance,
    health: r.health,
    billing: r.billing,
    aura: r.aura,
  };
}

export const notificationsStore = {
  // ── Inbox ──────────────────────────────────────────────────────────────────
  async list(userId: string): Promise<AppNotification[]> {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as NotificationRow[]).map(toNotification);
  },

  async markRead(userId: string, id: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id');
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  },

  async markAllRead(userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw error;
  },

  // Create a notification (used by server-side producers: maintenance checks,
  // billing events, Aura insights). Not exposed as a client write endpoint.
  async create(
    userId: string,
    input: {
      category: NotificationCategory;
      title: string;
      body?: string;
      ctaLabel?: string | null;
      ctaRoute?: string | null;
    },
  ): Promise<AppNotification> {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        category: input.category,
        title: input.title,
        body: input.body ?? '',
        cta_label: input.ctaLabel ?? null,
        cta_route: input.ctaRoute ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return toNotification(data as NotificationRow);
  },

  // ── SMS prefs ────────────────────────────────────────────────────────────────
  async getSmsPrefs(userId: string): Promise<SmsPrefs | null> {
    const { data, error } = await supabaseAdmin
      .from('notification_sms_prefs')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data ? toSmsPrefs(data as SmsPrefsRow) : null;
  },

  async setSmsPref(
    userId: string,
    category: NotificationCategory,
    on: boolean,
  ): Promise<SmsPrefs | null> {
    // Upsert so a missing row (shouldn't happen post-bootstrap) is created.
    const { data, error } = await supabaseAdmin
      .from('notification_sms_prefs')
      .upsert({ user_id: userId, [category]: on }, { onConflict: 'user_id' })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? toSmsPrefs(data as SmsPrefsRow) : null;
  },

  // ── Delivery audit log ───────────────────────────────────────────────────────
  // Record an outbound send. `status` defaults to 'stub' while Twilio/SendGrid
  // are unwired (notify.route.ts). service-role only — no client write path.
  async logDelivery(
    userId: string,
    input: { channel: DeliveryChannel; recipient: string; body: string; status?: DeliveryStatus },
  ): Promise<void> {
    const { error } = await supabaseAdmin.from('notification_deliveries').insert({
      user_id: userId,
      channel: input.channel,
      recipient: input.recipient,
      body: input.body,
      status: input.status ?? 'stub',
    });
    if (error) throw error;
  },
};
