import {
  faMapLocationDot,
  faTruck,
  faTruckArrowRight,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import statesTopo from "us-atlas/states-10m.json";
import { feature, mesh } from "topojson-client";
import { fmtUsd, type LaneStat } from "../api";
import { CITY_COORDS, cityShort } from "../geo/cities";
import { Card, EmptyState } from "./Card";

const W = 800;
const H = 470;

type Mode = "all" | "booked";

// Build the US base map + projection once (module-level: the topology never
// changes). geoAlbersUsa fits the lower-48 + AK/HI insets into our viewBox.
const topo = statesTopo as unknown as Parameters<typeof feature>[0];
const nation = feature(topo, (topo as any).objects.nation) as never;
const projection = geoAlbersUsa().fitSize([W, H], nation as never);
const path = geoPath(projection);
const statesPath = path(mesh(topo, (topo as any).objects.states) as never) ?? "";
const nationPath = path(nation as never) ?? "";

const project = (city: string): [number, number] | null => {
  const c = CITY_COORDS[city];
  if (!c) return null;
  return projection(c) ?? null;
};

/** A gentle arc between two projected points, so overlapping lanes stay legible. */
function arc(a: [number, number], b: [number, number]): string {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dist = Math.hypot(dx, dy);
  // Offset the control point perpendicular to the line by ~18% of its length.
  const cx = mx - (dy / dist) * dist * 0.18;
  const cy = my + (dx / dist) * dist * 0.18;
  return `M${a[0]},${a[1]} Q${cx},${cy} ${b[0]},${b[1]}`;
}

export function LaneMap({ lanes }: { lanes: LaneStat[] }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("all");
  const [carrier, setCarrier] = useState<string>("all");

  // Carrier filter options, distinct by MC. Backend ships lanes at per-carrier
  // grain so we can both filter and re-aggregate here (nginx only proxies the
  // single /api/metrics call, so there's no server-side filter to hit).
  const carriers = useMemo(() => {
    const byMc = new Map<string, string>();
    for (const l of lanes) {
      if (l.mc_number) byMc.set(l.mc_number, l.carrier_name ?? l.mc_number);
    }
    return [...byMc.entries()]
      .map(([mc, name]) => ({ mc, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [lanes]);

  // If the selected carrier disappears from the data, fall back to "all".
  const activeCarrier =
    carrier !== "all" && !carriers.some((c) => c.mc === carrier) ? "all" : carrier;

  // Filter by carrier, then collapse the per-carrier rows back into one row per
  // origin -> destination lane.
  const filtered = useMemo(() => {
    const rows =
      activeCarrier === "all"
        ? lanes
        : lanes.filter((l) => l.mc_number === activeCarrier);
    const agg = new Map<string, LaneStat>();
    for (const l of rows) {
      const key = `${l.origin}__${l.destination}`;
      const cur = agg.get(key);
      if (cur) {
        cur.calls += l.calls;
        cur.booked += l.booked;
        cur.revenue = (cur.revenue ?? 0) + (l.revenue ?? 0);
      } else {
        agg.set(key, { ...l, mc_number: null, carrier_name: null });
      }
    }
    return [...agg.values()];
  }, [lanes, activeCarrier]);

  const weightOf = (l: LaneStat) => (mode === "booked" ? l.booked : l.calls);

  const drawn = useMemo(() => {
    const items = filtered
      .map((l) => ({
        lane: l,
        weight: weightOf(l),
        from: project(l.origin),
        to: project(l.destination),
      }))
      .filter((d) => d.weight > 0 && d.from && d.to);
    items.sort((a, b) => b.weight - a.weight);
    return items;
  }, [filtered, mode]);

  const maxWeight = drawn.reduce((m, d) => Math.max(m, d.weight), 0) || 1;

  // City markers sized by total volume passing through them (either endpoint).
  const cityVolume = useMemo(() => {
    const vol = new Map<string, number>();
    for (const d of drawn) {
      vol.set(d.lane.origin, (vol.get(d.lane.origin) ?? 0) + d.weight);
      vol.set(d.lane.destination, (vol.get(d.lane.destination) ?? 0) + d.weight);
    }
    return vol;
  }, [drawn]);

  const stroke = mode === "booked" ? "#16a34a" : "#3b82f6";

  return (
    <Card title={t("lanes.title")} icon={faMapLocationDot}>
      {lanes.length === 0 ? (
        <EmptyState icon={faTruckArrowRight}>{t("lanes.empty")}</EmptyState>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-medium dark:border-slate-700">
              {(["all", "booked"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-1 transition-colors ${
                    mode === m
                      ? "bg-blue-600 text-white"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  {t(`lanes.mode.${m}`)}
                </button>
              ))}
            </div>
            {carriers.length > 0 && (
              <label className="relative inline-flex items-center gap-2 rounded-lg border border-slate-200 py-1 pl-2.5 pr-2 text-xs font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <FontAwesomeIcon icon={faTruck} className="text-slate-400" />
                <select
                  value={activeCarrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="cursor-pointer bg-transparent pr-1 font-medium text-slate-700 focus:outline-none dark:text-slate-200"
                  aria-label={t("lanes.carrier.label")}
                >
                  <option value="all" className="dark:bg-slate-800">
                    {t("lanes.carrier.all")}
                  </option>
                  {carriers.map((c) => (
                    <option key={c.mc} value={c.mc} className="dark:bg-slate-800">
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="overflow-hidden">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="h-auto w-full"
                role="img"
                aria-label={t("lanes.title")}
              >
                <path d={nationPath} className="fill-slate-100 dark:fill-slate-700/40" />
                <path
                  d={statesPath}
                  className="fill-none stroke-slate-300 dark:stroke-slate-600"
                  strokeWidth={0.6}
                />
                {drawn.map((d) => (
                  <path
                    key={`${d.lane.origin}->${d.lane.destination}`}
                    d={arc(d.from!, d.to!)}
                    fill="none"
                    stroke={stroke}
                    strokeOpacity={0.25 + 0.55 * (d.weight / maxWeight)}
                    strokeWidth={1.5 + 5 * (d.weight / maxWeight)}
                    strokeLinecap="round"
                  />
                ))}
                {[...cityVolume.entries()].map(([city, vol]) => {
                  const p = project(city);
                  if (!p) return null;
                  return (
                    <g key={city}>
                      <circle
                        cx={p[0]}
                        cy={p[1]}
                        r={3 + 4 * (vol / (maxWeight * 2))}
                        fill={stroke}
                        fillOpacity={0.85}
                      />
                      <text
                        x={p[0] + 7}
                        y={p[1] + 3}
                        className="fill-slate-600 text-[10px] dark:fill-slate-300"
                      >
                        {cityShort(city)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <ol className="flex flex-col gap-1.5">
              <li className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t("lanes.topLanes")}
              </li>
              {drawn.slice(0, 6).map((d, i) => (
                <li
                  key={`${d.lane.origin}->${d.lane.destination}`}
                  className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-700/40"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600 dark:bg-slate-600 dark:text-slate-200">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 truncate text-xs font-medium">
                      {cityShort(d.lane.origin)}
                      <FontAwesomeIcon
                        icon={faTruckArrowRight}
                        className="text-[10px] text-slate-400"
                      />
                      {cityShort(d.lane.destination)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t("lanes.legend", { calls: d.lane.calls, booked: d.lane.booked })}
                      {d.lane.revenue ? ` · ${fmtUsd(d.lane.revenue)}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </Card>
  );
}
