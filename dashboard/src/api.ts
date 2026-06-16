export interface CallRecord {
  id: number;
  created_at: string;
  outcome: string;
  mc_number: string | null;
  carrier_name: string | null;
  load_id: string | null;
  sentiment: string | null;
  negotiation_rounds: number | null;
  initial_offer: number | null;
  final_rate: number | null;
  loadboard_rate: number | null;
}

export interface DailyStat {
  date: string;
  total: number;
  booked: number;
}

export interface LaneStat {
  origin: string;
  destination: string;
  mc_number: string | null;
  carrier_name: string | null;
  calls: number;
  booked: number;
  revenue: number | null;
}

export interface CarrierStat {
  mc_number: string;
  carrier_name: string | null;
  calls: number;
  booked: number;
  conversion_rate: number;
  avg_rounds: number | null;
  avg_margin: number | null;
  revenue: number | null;
}

export interface Metrics {
  total_calls: number;
  booked_count: number;
  conversion_rate: number;
  avg_negotiation_rounds: number | null;
  outcome_distribution: Record<string, number>;
  sentiment_distribution: Record<string, number>;
  avg_final_rate: number | null;
  avg_loadboard_rate: number | null;
  avg_rate_delta: number | null;
  avg_rate_delta_pct: number | null;
  total_booked_revenue: number | null;
  total_margin_saved: number | null;
  daily_calls: DailyStat[];
  lanes: LaneStat[];
  carriers: CarrierStat[];
  recent_calls: CallRecord[];
}

/** `days` scopes the dashboard to a recent window; omit it for all of history. */
export async function fetchMetrics(days?: number): Promise<Metrics> {
  const url = days ? `/api/metrics?days=${days}` : "/api/metrics";
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`API error ${resp.status}`);
  return resp.json();
}

// Display labels for outcomes/sentiments live in the i18n bundles
// (src/i18n/locales/*); only the chart colors stay here.
export const OUTCOME_COLORS: Record<string, string> = {
  booked: "#16a34a",
  negotiation_failed: "#f59e0b",
  no_matching_load: "#3b82f6",
  carrier_not_eligible: "#dc2626",
  abandoned: "#94a3b8",
};

export const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#16a34a",
  neutral: "#94a3b8",
  negative: "#dc2626",
};

export const fmtUsd = (v: number | null | undefined) =>
  v == null ? "—" : `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export const fmtPct = (v: number | null | undefined, digits = 0) =>
  v == null ? "—" : `${v.toFixed(digits)}%`;
