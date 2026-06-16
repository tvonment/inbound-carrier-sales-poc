import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faMoneyBillTrendUp,
  faPiggyBank,
  faSackDollar,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useTranslation } from "react-i18next";
import { fmtUsd, type Metrics } from "../api";

/** The two numbers a broker cares about most: total dollars booked by the
 * agent, and the cumulative margin saved versus the loadboard list price. */
export function MoneyStrip({ metrics }: { metrics: Metrics }) {
  const { t } = useTranslation();
  const saved = metrics.total_margin_saved;
  // Saving (booked below list) is the win → green; overspending → amber. The
  // card colour follows the sign so it never reads as a win when it isn't.
  const saving = saved == null || saved >= 0;

  const items: {
    label: string;
    hint: string;
    value: string;
    icon: IconDefinition;
    gradient: string;
  }[] = [
    {
      label: t("money.revenue"),
      hint: t("money.revenueHint"),
      value: fmtUsd(metrics.total_booked_revenue),
      icon: faSackDollar,
      gradient: "from-blue-600 to-indigo-600",
    },
    {
      label: saving ? t("money.saved") : t("money.over"),
      hint: t("money.savedHint"),
      // Show the sign so a negative (booked over list) reads honestly.
      value:
        saved == null ? "—" : `${saved >= 0 ? "+" : "−"}${fmtUsd(Math.abs(saved))}`,
      icon: saving ? faPiggyBank : faMoneyBillTrendUp,
      gradient: saving ? "from-emerald-600 to-green-600" : "from-amber-500 to-orange-600",
    },
  ];

  return (
    <div className="mb-3.5 grid gap-3.5 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${item.gradient} p-5 text-white shadow-sm`}
        >
          <FontAwesomeIcon
            icon={item.icon}
            className="absolute -right-3 -top-2 text-7xl text-white/10"
          />
          <div className="relative">
            <div className="flex items-center gap-2 text-sm font-medium text-white/80">
              <FontAwesomeIcon icon={item.icon} />
              {item.label}
            </div>
            <div className="mt-1.5 text-4xl font-bold tracking-tight">{item.value}</div>
            <div className="mt-1 text-xs text-white/70">{item.hint}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
