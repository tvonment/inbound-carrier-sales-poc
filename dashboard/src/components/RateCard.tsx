import { fmtPct, fmtUsd, type Metrics } from "../api";

/** The margin story: what we agree to pay vs what the load was listed at. */
export function RateCard({ metrics }: { metrics: Metrics }) {
  const delta = metrics.avg_rate_delta;
  const sign = delta != null && delta > 0 ? "+" : "";

  return (
    <div className="card chart-card">
      <h2>Agreed vs listed rate</h2>
      {delta == null ? (
        <p className="empty">No booked loads yet</p>
      ) : (
        <div className="rate-body">
          <div className="rate-delta">
            <span className={`rate-delta-value ${delta > 0 ? "neg" : "pos"}`}>
              {sign}
              {fmtUsd(delta)}
            </span>
            <span className="rate-delta-pct">
              {sign}
              {fmtPct(metrics.avg_rate_delta_pct, 1)} vs loadboard
            </span>
          </div>
          <dl className="rate-rows">
            <div>
              <dt>Avg agreed rate</dt>
              <dd>{fmtUsd(metrics.avg_final_rate)}</dd>
            </div>
            <div>
              <dt>Avg loadboard rate</dt>
              <dd>{fmtUsd(metrics.avg_loadboard_rate)}</dd>
            </div>
          </dl>
          <p className="rate-note">Average across booked loads. Lower is better for margin.</p>
        </div>
      )}
    </div>
  );
}
