import { fmtPct, type Metrics } from "../api";

export function Kpis({ metrics }: { metrics: Metrics }) {
  const items = [
    { label: "Total calls", value: String(metrics.total_calls) },
    { label: "Loads booked", value: String(metrics.booked_count) },
    {
      label: "Conversion rate",
      value: fmtPct(metrics.conversion_rate * 100),
    },
    {
      label: "Avg negotiation rounds",
      value:
        metrics.avg_negotiation_rounds == null
          ? "—"
          : metrics.avg_negotiation_rounds.toFixed(1),
    },
  ];
  return (
    <div className="kpi-row">
      {items.map((item) => (
        <div className="card kpi" key={item.label}>
          <span className="kpi-value">{item.value}</span>
          <span className="kpi-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
