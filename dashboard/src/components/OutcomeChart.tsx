import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { OUTCOME_COLORS, OUTCOME_LABELS } from "../api";

export function OutcomeChart({ distribution }: { distribution: Record<string, number> }) {
  const data = Object.entries(distribution).map(([key, count]) => ({
    key,
    name: OUTCOME_LABELS[key] ?? key,
    value: count,
  }));

  return (
    <div className="card chart-card">
      <h2>Call outcomes</h2>
      {data.length === 0 ? (
        <p className="empty">No calls yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} isAnimationActive={false}>
              {data.map((entry) => (
                <Cell key={entry.key} fill={OUTCOME_COLORS[entry.key] ?? "#64748b"} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
