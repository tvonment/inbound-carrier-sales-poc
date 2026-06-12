import {
  faArrowsRotate,
  faCircleNotch,
  faTriangleExclamation,
  faTruckFast,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useState } from "react";
import { fetchMetrics, type Metrics } from "./api";
import { CallsTable } from "./components/CallsTable";
import { Kpis } from "./components/Kpis";
import { OutcomeChart } from "./components/OutcomeChart";
import { RateCard } from "./components/RateCard";
import { SentimentChart } from "./components/SentimentChart";

const REFRESH_MS = 15_000;

export default function App() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      setMetrics(await fetchMetrics());
      setError(null);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load metrics");
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-6xl px-5 pb-12 pt-6">
        <header className="mb-5 flex items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-blue-600 text-lg text-white shadow-sm">
              <FontAwesomeIcon icon={faTruckFast} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Acme Logistics</h1>
              <p className="text-sm text-slate-500">Inbound Carrier Sales — Live Metrics</p>
            </div>
          </div>
          <div className="pb-1 text-xs text-slate-500">
            {error ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-700">
                <FontAwesomeIcon icon={faTriangleExclamation} />
                {error}
              </span>
            ) : (
              updatedAt && (
                <span className="inline-flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faArrowsRotate} />
                  Updated {updatedAt.toLocaleTimeString()}
                </span>
              )
            )}
          </div>
        </header>

        {metrics === null ? (
          <p className="flex items-center gap-2 text-slate-500">
            <FontAwesomeIcon icon={faCircleNotch} spin />
            {error ? "Waiting for the API…" : "Loading metrics…"}
          </p>
        ) : (
          <>
            <Kpis metrics={metrics} />
            <div className="mb-3.5 grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
              <OutcomeChart distribution={metrics.outcome_distribution} />
              <SentimentChart distribution={metrics.sentiment_distribution} />
              <RateCard metrics={metrics} />
            </div>
            <CallsTable calls={metrics.recent_calls} />
          </>
        )}
      </div>
    </div>
  );
}
