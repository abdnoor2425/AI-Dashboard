// Stripe: money that came in, failed payments, subscriptions and the next payout. Read only.
// The rk_ prefix identifies the key type. Only Stripe shows the permissions assigned to a key.
// NOTE: written against Stripe's public API docs and not yet run against a live account.
import { getSecrets } from "./store.ts";
import { DAY, startOfDay } from "../rand.ts";

const BASE = "https://api.stripe.com/v1";
/** Currencies Stripe counts in whole units rather than cents. */
const ZERO = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);
export const major = (amount: number, currency: string) => (ZERO.has(String(currency).toLowerCase()) ? amount : amount / 100);

/** The page in Stripe that makes the read-only key, with the name and the four read boxes already filled in. */
export const STRIPE_KEY_URL = "https://dashboard.stripe.com/apikeys/create?name=AI-Dashboard" + ["rak_charge_read", "rak_customer_read", "rak_subscription_read", "rak_payout_read"].map((p) => "&permissions%5B%5D=" + p).join("");

/** Says why a pasted key is not acceptable, or null when it looks right. */
export function keyProblem(token: string) {
  const t = String(token || "").trim();
  if (/^sk_/.test(t)) return "That is a full secret key, which can move money. For safety the dashboard requires a restricted key with operator-reviewed read permissions. It starts with rk_.";
  if (/^pk_/.test(t)) return "That is a publishable key, which cannot read payments. Use the restricted read-only key. It starts with rk_.";
  if (!/^rk_(live|test)_[A-Za-z0-9]{10,}$/.test(t)) return "That does not look like a Stripe restricted key. It starts with rk_live_.";
  return null;
}

type Fetcher = (path: string) => Promise<any>;
function fetcher(wsId: string): Fetcher {
  const key = getSecrets(wsId).stripe;
  const token = key?.token;
  if (!token) throw new Error("Stripe is not connected.");
  if (key.scopesReviewed !== true) throw new Error("Review the existing key permissions in Stripe, then reconnect. The saved key has been retained.");
  const bad = keyProblem(token);
  if (bad) throw new Error(bad);
  return async (path: string) => {
    const r = await fetch(BASE + path, { method: "GET", redirect: "error", headers: { authorization: "Bearer " + token } });
    const j: any = await r.json().catch(() => ({}));
    if (r.status === 401) throw new Error("Stripe did not accept the key. Make a new restricted key and paste it again.");
    if (r.status === 403) throw new Error("The key is missing a read box. In Stripe, give it Read for Charges, Customers, Subscriptions and Payouts.");
    if (!r.ok) throw new Error(j.error?.message ? String(j.error.message).slice(0, 160) : `Stripe answered ${r.status}.`);
    return j;
  };
}

async function list(get: Fetcher, path: string, pages: number) {
  const out: any[] = [];
  let after = "";
  for (let i = 0; i < pages; i++) {
    const j = await get(path + (path.includes("?") ? "&" : "?") + "limit=100" + (after ? "&starting_after=" + after : ""));
    out.push(...(j.data || []));
    if (!j.has_more || !j.data?.length) break;
    after = j.data[j.data.length - 1].id;
  }
  return out;
}

/** What one subscription is worth per month, in the currency's main unit. */
export function monthly(sub: any) {
  let total = 0;
  for (const it of sub.items?.data || []) {
    const p = it.price || it.plan || {};
    const every = p.recurring?.interval || p.interval, n = p.recurring?.interval_count || p.interval_count || 1;
    const per = every === "year" ? 12 * n : every === "week" ? (7 * n) / (365 / 12) : every === "day" ? n / (365 / 12) : n;
    total += (major(p.unit_amount ?? p.amount ?? 0, p.currency || sub.currency) * (it.quantity ?? 1)) / per;
  }
  return total;
}

/** Turns Stripe's raw lists into the small record the dashboard keeps. Kept apart from the fetching so it can be tested. */
export function shapeMoney(charges: any[], subs: any[], payouts: any[], now: number, test = false) {
  const count: Record<string, number> = {};
  for (const c of charges) if (c.status === "succeeded") count[c.currency] = (count[c.currency] || 0) + 1;
  const currency = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] || subs[0]?.currency || payouts[0]?.currency || "usd";
  const mine = charges.filter((c) => c.currency === currency);
  const who = (c: any) => String((typeof c.customer === "object" && c.customer ? c.customer.name || c.customer.email : "") || c.billing_details?.name || c.billing_details?.email || c.receipt_email || "").trim();
  const link = (c: any) => `https://dashboard.stripe.com/${test ? "test/" : ""}payments/${typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id || c.id}`;
  const byDay = new Map<number, number>(), byCust = new Map<string, number>();
  const paid = mine.filter((c) => c.status === "succeeded" && c.paid !== false);
  for (const c of paid) {
    const amount = major((c.amount_captured ?? c.amount) - (c.amount_refunded || 0), currency), t = startOfDay(c.created * 1000);
    byDay.set(t, (byDay.get(t) || 0) + amount);
    const name = who(c); if (name) byCust.set(name, (byCust.get(name) || 0) + amount);
  }
  // A failed payment counts as recovered once the same payment, or the same customer for the same amount, went through later.
  const recovered = (f: any) => paid.some((p) => p.created > f.created && ((f.payment_intent && (p.payment_intent?.id || p.payment_intent) === (f.payment_intent?.id || f.payment_intent)) || (who(f) && who(p) === who(f) && p.amount === f.amount)));
  const recent = mine.filter((c) => (c.status === "succeeded" || c.status === "failed") && c.created * 1000 >= now - 45 * DAY).sort((a, b) => b.created - a.created).slice(0, 60);
  const next = payouts.filter((p) => (p.status === "pending" || p.status === "in_transit") && p.currency === currency).sort((a, b) => a.arrival_date - b.arrival_date)[0];
  const live = subs.filter((s) => (s.status === "active" || s.status === "past_due") && (s.currency || currency) === currency);
  return {
    currency, when: now,
    daily: [...byDay].sort((a, b) => a[0] - b[0]).map(([t, gross]) => ({ t, gross: Math.round(gross * 100) / 100 })),
    payments: recent.map((c) => ({
      id: c.id, at: c.created * 1000, amount: major(c.status === "succeeded" ? (c.amount_captured ?? c.amount) - (c.amount_refunded || 0) : c.amount, currency), customer: who(c), desc: String(c.description || c.calculated_statement_descriptor || "").slice(0, 80),
      status: c.status === "succeeded" ? "paid" : "failed", reason: c.status === "failed" ? String(c.failure_message || c.outcome?.seller_message || "The payment failed").slice(0, 120) : "", url: link(c), recovered: c.status === "failed" ? recovered(c) : false,
    })),
    customers: [...byCust].map(([name, v]) => ({ name, paid: Math.round(v) })).sort((a, b) => b.paid - a.paid).slice(0, 40),
    mrr: live.length ? Math.round(live.reduce((a, s) => a + monthly(s), 0)) : subs.length ? 0 : null, subs: live.length,
    payout: next ? { amount: major(next.amount, currency), at: next.arrival_date * 1000 } : null,
  };
}

/** Reads the last twelve months from Stripe. Nothing is ever written back. */
export async function syncStripe(wsId: string, now: number) {
  const get = fetcher(wsId);
  const from = Math.floor((startOfDay(now) - 366 * DAY) / 1000);
  const charges = await list(get, `/charges?created%5Bgte%5D=${from}&expand%5B%5D=data.customer`, 40);
  // A denied or failed required read must not become a fabricated empty dataset.
  const [subs, payouts] = await Promise.all([list(get, "/subscriptions?status=all", 5), list(get, "/payouts", 1)]);
  return shapeMoney(charges, subs, payouts, now, /^rk_test_/.test(getSecrets(wsId).stripe?.token || ""));
}
