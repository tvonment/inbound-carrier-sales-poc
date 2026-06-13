import {
  faChartLine,
  faCircleCheck,
  faHandshake,
  faPhoneVolume,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useTranslation } from "react-i18next";
import { fmtPct, type Metrics } from "../api";
import { Card } from "./Card";

export function Kpis({ metrics }: { metrics: Metrics }) {
  const { t } = useTranslation();
  const items = [
    {
      label: t("kpi.totalCalls"),
      value: String(metrics.total_calls),
      icon: faPhoneVolume,
      tint: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    },
    {
      label: t("kpi.loadsBooked"),
      value: String(metrics.booked_count),
      icon: faCircleCheck,
      tint: "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400",
    },
    {
      label: t("kpi.conversionRate"),
      value: fmtPct(metrics.conversion_rate * 100),
      icon: faChartLine,
      tint: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
    },
    {
      label: t("kpi.avgRounds"),
      value:
        metrics.avg_negotiation_rounds == null
          ? "—"
          : metrics.avg_negotiation_rounds.toFixed(1),
      icon: faHandshake,
      tint: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
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
            <div className="text-xs text-slate-500 dark:text-slate-400">{item.label}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}
