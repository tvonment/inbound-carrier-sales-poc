import { fmtUsd, OUTCOME_COLORS, OUTCOME_LABELS, type CallRecord } from "../api";

export function CallsTable({ calls }: { calls: CallRecord[] }) {
  return (
    <div className="card table-card">
      <h2>Recent calls</h2>
      {calls.length === 0 ? (
        <p className="empty">No calls yet — make a test call to see data here.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Carrier</th>
              <th>MC #</th>
              <th>Load</th>
              <th>Outcome</th>
              <th>Sentiment</th>
              <th>Rounds</th>
              <th>Final rate</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => (
              <tr key={call.id}>
                <td>{new Date(call.created_at + "Z").toLocaleString()}</td>
                <td>{call.carrier_name ?? "—"}</td>
                <td>{call.mc_number ?? "—"}</td>
                <td>{call.load_id ?? "—"}</td>
                <td>
                  <span
                    className="pill"
                    style={{ backgroundColor: OUTCOME_COLORS[call.outcome] ?? "#64748b" }}
                  >
                    {OUTCOME_LABELS[call.outcome] ?? call.outcome}
                  </span>
                </td>
                <td className={`sentiment-${call.sentiment ?? "none"}`}>
                  {call.sentiment ?? "—"}
                </td>
                <td>{call.negotiation_rounds ?? "—"}</td>
                <td>{fmtUsd(call.final_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
