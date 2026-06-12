import {
  faArrowTrendDown,
  faArrowTrendUp,
  faInbox,
  faMoneyBillTrendUp,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { fmtPct, fmtUsd, type Metrics } from "../api";
import { Card, EmptyState } from "./Card";

/** The margin story: what we agree to pay vs what the load was listed at. */
export function RateCard({ metrics }: { metrics: Metrics }) {
  const delta = metrics.avg_rate_delta;
  const overListed = delta != null && delta > 0;
  const sign = overListed ? "+" : "";

  return (
    <Card title="Agreed vs listed rate" icon={faMoneyBillTrendUp} className="min-h-[290px]">
      {delta == null ? (
        <EmptyState icon={faInbox}>No booked loads yet</EmptyState>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-0.5 py-2.5">
            <span
              className={`flex items-center gap-2 text-3xl font-bold tracking-tight ${
                overListed ? "text-red-600" : "text-green-600"
              }`}
            >
              <FontAwesomeIcon
                icon={overListed ? faArrowTrendUp : faArrowTrendDown}
                className="text-xl"
              />
              {sign}
              {fmtUsd(delta)}
            </span>
            <span className="text-sm text-slate-500">
              {sign}
              {fmtPct(metrics.avg_rate_delta_pct, 1)} vs loadboard
            </span>
          </div>
          <dl className="flex flex-col gap-1.5">
            <div className="flex justify-between">
              <dt className="text-sm text-slate-500">Avg agreed rate</dt>
              <dd className="text-sm font-semibold">{fmtUsd(metrics.avg_final_rate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-slate-500">Avg loadboard rate</dt>
              <dd className="text-sm font-semibold">{fmtUsd(metrics.avg_loadboard_rate)}</dd>
            </div>
          </dl>
          <p className="text-xs text-slate-400">
            Average across booked loads. Lower is better for margin.
          </p>
        </div>
      )}
    </Card>
  );
}
