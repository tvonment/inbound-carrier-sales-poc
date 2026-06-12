import {
  faChartLine,
  faCircleCheck,
  faHandshake,
  faPhoneVolume,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { fmtPct, type Metrics } from "../api";
import { Card } from "./Card";

export function Kpis({ metrics }: { metrics: Metrics }) {
  const items = [
    {
      label: "Total calls",
      value: String(metrics.total_calls),
      icon: faPhoneVolume,
      tint: "bg-blue-50 text-blue-600",
    },
    {
      label: "Loads booked",
      value: String(metrics.booked_count),
      icon: faCircleCheck,
      tint: "bg-green-50 text-green-600",
    },
    {
      label: "Conversion rate",
      value: fmtPct(metrics.conversion_rate * 100),
      icon: faChartLine,
      tint: "bg-violet-50 text-violet-600",
    },
    {
      label: "Avg negotiation rounds",
      value:
        metrics.avg_negotiation_rounds == null
          ? "—"
          : metrics.avg_negotiation_rounds.toFixed(1),
      icon: faHandshake,
      tint: "bg-amber-50 text-amber-600",
    },
  ];
  return (
    <div className="mb-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="flex items-center gap-3.5">
          <div
            className={`flex size-11 shrink-0 items-center justify-center rounded-lg text-lg ${item.tint}`}
          >
            <FontAwesomeIcon icon={item.icon} />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-bold tracking-tight">{item.value}</div>
            <div className="text-xs text-slate-500">{item.label}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}
