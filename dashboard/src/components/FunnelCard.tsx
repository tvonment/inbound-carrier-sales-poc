import { faFilter, faInbox } from "@fortawesome/free-solid-svg-icons";
import { useTranslation } from "react-i18next";
import type { Metrics } from "../api";
import { Card, EmptyState } from "./Card";

/** The carrier-sales funnel, reconstructed from outcome counts. Each stage
 * subtracts the calls we know dropped for that reason, so it stays monotonic:
 * a matched load is a prerequisite for negotiating, which precedes booking. */
export function FunnelCard({ metrics }: { metrics: Metrics }) {
  const { t } = useTranslation();
  const total = metrics.total_calls;
  const d = metrics.outcome_distribution;
  const get = (k: string) => d[k] ?? 0;

  const eligible = total - get("carrier_not_eligible");
  const matched = eligible - get("no_matching_load");
  const negotiated = get("booked") + get("negotiation_failed");
  const booked = get("booked");

  const stages = [
    { key: "handled", value: total, color: "#3b82f6" },
    { key: "eligible", value: eligible, color: "#6366f1" },
    { key: "matched", value: matched, color: "#8b5cf6" },
    { key: "negotiated", value: negotiated, color: "#0d9488" },
    { key: "booked", value: booked, color: "#16a34a" },
  ];

  return (
    <Card title={t("funnel.title")} icon={faFilter} className="min-h-[290px]">
      {total === 0 ? (
        <EmptyState icon={faInbox}>{t("funnel.empty")}</EmptyState>
      ) : (
        <div className="flex flex-col gap-2.5 pt-1">
          {stages.map((stage) => {
            const pct = total > 0 ? (stage.value / total) * 100 : 0;
            return (
              <div key={stage.key} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    {t(`funnel.stage.${stage.key}`)}
                  </span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">
                    {stage.value}
                    <span className="ml-1.5 text-slate-400 dark:text-slate-500">
                      {pct.toFixed(0)}%
                    </span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${Math.max(pct, stage.value > 0 ? 4 : 0)}%`,
                      backgroundColor: stage.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
