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
    <div className="page">
      <header className="header">
        <div>
          <h1>Acme Logistics</h1>
          <p className="subtitle">Inbound Carrier Sales — Live Metrics</p>
        </div>
        <div className="updated">
          {error ? (
            <span className="error-pill">⚠ {error}</span>
          ) : (
            updatedAt && <span>Updated {updatedAt.toLocaleTimeString()}</span>
          )}
        </div>
      </header>

      {metrics === null && !error ? (
        <p className="loading">Loading metrics…</p>
      ) : metrics === null ? (
        <p className="loading">Waiting for the API…</p>
      ) : (
        <>
          <Kpis metrics={metrics} />
          <div className="grid-3">
            <OutcomeChart distribution={metrics.outcome_distribution} />
            <SentimentChart distribution={metrics.sentiment_distribution} />
            <RateCard metrics={metrics} />
          </div>
          <CallsTable calls={metrics.recent_calls} />
        </>
      )}
    </div>
  );
}
