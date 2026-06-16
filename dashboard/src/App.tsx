import {
  faArrowsRotate,
  faCircleNotch,
  faTriangleExclamation,
  faTruckFast,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchMetrics, type Metrics } from "./api";
import { CallsTable } from "./components/CallsTable";
import { CarrierBreakdown } from "./components/CarrierBreakdown";
import { FunnelCard } from "./components/FunnelCard";
import { HeaderControls } from "./components/HeaderControls";
import { Kpis } from "./components/Kpis";
import { MoneyStrip } from "./components/MoneyStrip";
import { OutcomeChart } from "./components/OutcomeChart";
import { RangeFilter, type RangeValue } from "./components/RangeFilter";
import { RateCard } from "./components/RateCard";
import { SentimentChart } from "./components/SentimentChart";
import { TrendChart } from "./components/TrendChart";
import { localeFor } from "./i18n";

// The lane map bundles a US topology; load it after first paint so the rest
// of the dashboard stays light.
const LaneMap = lazy(() =>
  import("./components/LaneMap").then((m) => ({ default: m.LaneMap })),
);

const REFRESH_MS = 15_000;

export default function App() {
  const { t, i18n } = useTranslation();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  // Default to the last 30 days: covers recent activity without fetching the
  // entire history on first load.
  const [range, setRange] = useState<RangeValue>(30);

  const refresh = useCallback(async () => {
    try {
      setMetrics(await fetchMetrics(range));
      setError(false);
      setUpdatedAt(new Date());
    } catch {
      setError(true);
    }
  }, [range]);

  // Re-fetch immediately when the range changes (and keep polling on it).
  useEffect(() => {
    setMetrics(null);
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-6xl px-5 pb-12 pt-6">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-blue-600 text-lg text-white shadow-sm">
              <FontAwesomeIcon icon={faTruckFast} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Acme Logistics</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("app.subtitle")}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <RangeFilter value={range} onChange={setRange} />
              <HeaderControls />
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {error ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-700 dark:bg-red-500/15 dark:text-red-400">
                  <FontAwesomeIcon icon={faTriangleExclamation} />
                  {t("app.error")}
                </span>
              ) : (
                updatedAt && (
                  <span className="inline-flex items-center gap-1.5">
                    <FontAwesomeIcon icon={faArrowsRotate} />
                    {t("app.updated", {
                      time: new Intl.DateTimeFormat(localeFor(i18n.language), {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      }).format(updatedAt),
                    })}
                  </span>
                )
              )}
            </div>
          </div>
        </header>

        {metrics === null ? (
          <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <FontAwesomeIcon icon={faCircleNotch} spin />
            {error ? t("app.waiting") : t("app.loading")}
          </p>
        ) : (
          <>
            <MoneyStrip metrics={metrics} />
            <Kpis metrics={metrics} />
            <div className="mb-3.5 grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
              <OutcomeChart distribution={metrics.outcome_distribution} />
              <SentimentChart distribution={metrics.sentiment_distribution} />
              <RateCard metrics={metrics} />
            </div>
            <div className="mb-3.5 grid gap-3.5 xl:grid-cols-3">
              <FunnelCard metrics={metrics} />
              <div className="xl:col-span-2">
                <TrendChart data={metrics.daily_calls} />
              </div>
            </div>
            <div className="mb-3.5">
              <Suspense fallback={null}>
                <LaneMap lanes={metrics.lanes} />
              </Suspense>
            </div>
            <div className="mb-3.5">
              <CarrierBreakdown carriers={metrics.carriers} />
            </div>
            <CallsTable calls={metrics.recent_calls} />
          </>
        )}
      </div>
    </div>
  );
}
