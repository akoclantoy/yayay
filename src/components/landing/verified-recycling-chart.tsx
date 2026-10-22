"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Check, LoaderCircle, Recycle, Users } from "lucide-react";

type ChartRange = "7d" | "30d" | "3m" | "1y" | "all";
type Candle = {
  date: string;
  openKg: number;
  highKg: number;
  lowKg: number;
  closeKg: number;
  totalWeightKg: number;
  transactions: number;
};
type ChartData = {
  range: ChartRange;
  unit: "day" | "month";
  totals: {
    totalWeightKg: number;
    transactions: number;
    activeParticipants: number;
  };
  candles: Candle[];
};

const RANGES: { key: ChartRange; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "3m", label: "3M" },
  { key: "1y", label: "1Y" },
  { key: "all", label: "All" },
];
const INDICATORS = [
  { period: 3, color: "#ff335f" },
  { period: 5, color: "#ff477c" },
  { period: 7, color: "#d83bea" },
  { period: 14, color: "#9348ff" },
  { period: 21, color: "#19a8ff" },
  { period: 30, color: "#13db9b" },
];
const WIDTH = 1200;
const HEIGHT = 430;
const PLOT = { left: 18, right: 74, top: 18, bottom: 54 };
const kgFormat = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1 });
const countFormat = new Intl.NumberFormat("en-PH");

function dateLabel(value: string, unit: "day" | "month", long = false) {
  return new Intl.DateTimeFormat("en-PH", {
    month: long ? "long" : "short",
    ...(unit === "day" ? { day: "numeric" as const } : { year: "2-digit" as const }),
    ...(long ? { day: "numeric" as const, year: "numeric" as const } : {}),
    timeZone: "UTC",
  }).format(new Date(value));
}

function pathFor(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const middle = (previous.x + point.x) / 2;
    return `${path} C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
  }, "");
}

function movingAverage(candles: Candle[], period: number) {
  return candles.map((candle, index) => {
    if (index + 1 < period) return null;
    const window = candles.slice(index - period + 1, index + 1);
    return window.reduce((total, item) => total + item.closeKg, 0) / period;
  });
}

function dateRangeLabel(candles: Candle[], unit: "day" | "month") {
  if (!candles.length) return "No verified activity in this range";
  const first = dateLabel(candles[0].date, unit);
  const last = dateLabel(candles[candles.length - 1].date, unit);
  return `${first} – ${last}`;
}

export function VerifiedRecyclingChart() {
  const [range, setRange] = useState<ChartRange>("30d");
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 50, y: 50 });

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/stats/recycling-chart?range=${range}`, {
      cache: "no-store",
      signal,
    });
    const result = await response.json() as ChartData & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to load verified recycling.");
    return result;
  }, [range]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal)
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Unable to load verified recycling.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [fetchData]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchData(controller.signal)
          .then((result) => {
            setData(result);
            setError(null);
          })
          .catch((cause: unknown) => {
            if (!controller.signal.aborted) {
              setError(cause instanceof Error ? cause.message : "Unable to refresh verified recycling.");
            }
          });
      }
    }, 60_000);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [fetchData]);

  const chart = useMemo(() => {
    const candles = data?.candles ?? [];
    const plotWidth = WIDTH - PLOT.left - PLOT.right;
    const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
    const values = candles.flatMap((item) => [item.lowKg, item.highKg]);
    const dataMin = values.length ? Math.min(...values) : 0;
    const dataMax = values.length ? Math.max(...values) : 1;
    const spread = dataMax - dataMin || Math.max(dataMax * 0.2, 1);
    const min = Math.max(0, dataMin - spread * 0.16);
    const max = dataMax + spread * 0.16 || 1;
    const x = (index: number) =>
      PLOT.left + (candles.length <= 1 ? plotWidth / 2 : (index / (candles.length - 1)) * plotWidth);
    const y = (value: number) =>
      PLOT.top + ((max - value) / (max - min || 1)) * plotHeight;
    const candleWidth = Math.max(1.5, Math.min(10, (plotWidth / Math.max(candles.length, 1)) * 0.58));
    const tickCount = 5;
    const ticks = Array.from({ length: tickCount }, (_, index) => {
      const value = min + ((max - min) * (tickCount - 1 - index)) / (tickCount - 1);
      return { value, y: y(value) };
    });
    const labelCount = Math.min(8, candles.length);
    const dateIndexes = Array.from({ length: labelCount }, (_, index) =>
      labelCount === 1 ? 0 : Math.round((index / (labelCount - 1)) * (candles.length - 1)),
    );
    const lines = INDICATORS.map((indicator) => {
      const averages = movingAverage(candles, indicator.period);
      const points = averages.flatMap((average, index) =>
        average === null ? [] : [{ x: x(index), y: y(average) }],
      );
      return { ...indicator, points, path: pathFor(points) };
    });
    return { candles, plotWidth, plotHeight, x, y, candleWidth, ticks, dateIndexes, lines };
  }, [data]);

  const hovered = hoveredIndex === null ? null : chart.candles[hoveredIndex] ?? null;
  const totalWeight = data?.totals.totalWeightKg ?? 0;
  const periodLabel = data?.unit === "month" ? "month" : "day";

  function showTooltip(index: number, event: React.PointerEvent<SVGRectElement> | React.FocusEvent<SVGRectElement>) {
    const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (bounds && "clientX" in event) {
      setTooltipPosition({
        x: ((event.clientX - bounds.left) / bounds.width) * 100,
        y: ((event.clientY - bounds.top) / bounds.height) * 100,
      });
    }
    setHoveredIndex(index);
  }

  return (
    <article
      aria-labelledby="verified-recycling-title"
      className="relative overflow-hidden rounded-[22px] border border-[#243149] bg-[radial-gradient(ellipse_at_52%_110%,#111c32_0%,#090f1d_48%,#070b15_100%)] text-white shadow-[0_26px_80px_-38px_rgba(5,10,22,0.95)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(41,66,107,0.08),transparent_38%,rgba(19,28,49,0.16))]" />
      <header className="relative flex flex-col gap-5 px-5 pb-5 pt-5 sm:px-7 sm:pt-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-400">
            <Recycle className="h-6 w-6" />
          </span>
          <div>
            <h3 id="verified-recycling-title" className="text-lg font-bold tracking-tight sm:text-xl">
              Verified Recycling to Date
            </h3>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">
              Verified recycling activity and volume from the community
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-fit items-center gap-1 rounded-xl border border-[#263149] bg-[#080d19]/80 p-1">
            {RANGES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => { setLoading(true); setError(null); setRange(item.key); setHoveredIndex(null); }}
                aria-pressed={range === item.key}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
                  range === item.key
                    ? "bg-indigo-600 text-white shadow-[0_2px_12px_rgba(79,70,229,0.42)]"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#263149] bg-[#080d19]/80 px-3 text-[11px] text-slate-300">
            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
            <span>{dateRangeLabel(chart.candles, data?.unit ?? "day")}</span>
          </div>
        </div>
      </header>

      <div className="relative grid grid-cols-1 divide-y divide-[#202b40] border-y border-[#202b40] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-5 py-3.5 sm:px-7">
          <p className="text-[11px] font-medium text-slate-400">Total Verified Recyclables</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-100">
            {loading && !data ? "—" : `${kgFormat.format(totalWeight)} kg`}
          </p>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400">
            <Check className="h-3.5 w-3.5" /> All-time verified volume
          </p>
        </div>
        <div className="px-5 py-3.5 sm:px-7">
          <p className="text-[11px] font-medium text-slate-400">Verified Transactions</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-100">
            {countFormat.format(data?.totals.transactions ?? 0)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Confirmed collection records</p>
        </div>
        <div className="px-5 py-3.5 sm:px-7">
          <p className="text-[11px] font-medium text-slate-400">Active Participants</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-100">
            {countFormat.format(data?.totals.activeParticipants ?? 0)}
          </p>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
            <Users className="h-3.5 w-3.5" /> Residents with verified activity
          </p>
        </div>
      </div>

      <div className="relative px-2 pb-3 pt-4 sm:px-5 sm:pt-5">
        {error && (!data || data.range !== range) ? (
          <div role="alert" className="flex h-[300px] items-center justify-center px-6 text-center text-sm text-rose-300">
            {error}
          </div>
        ) : loading && (!data || data.range !== range) ? (
          <div className="flex h-[300px] items-center justify-center gap-2 text-sm text-slate-400">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Loading verified records…
          </div>
        ) : error ? (
          <p role="status" className="mb-2 px-2 text-right text-[10px] text-amber-300">
            Showing the last loaded verified data; refresh failed.
          </p>
        ) : null}
        {data && data.range === range && chart.candles.length > 0 ? (
          <div className="relative" onPointerLeave={() => setHoveredIndex(null)}>
            <motion.svg
              key={range}
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              role="img"
              aria-label={`Verified recycling transaction-weight candlestick chart, ${RANGES.find((item) => item.key === range)?.label} range`}
              className="block h-[300px] w-full sm:h-[370px] lg:h-[430px]"
              initial={{ opacity: 0.45, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <defs>
                <linearGradient id="candle-chart-glow" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#17223a" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#080d19" stopOpacity="0.38" />
                </linearGradient>
                <filter id="indicator-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.4" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <rect
                x={PLOT.left}
                y={PLOT.top}
                width={chart.plotWidth}
                height={chart.plotHeight}
                fill="url(#candle-chart-glow)"
              />

              {chart.ticks.map((tick) => (
                <g key={`y-${tick.value}`}>
                  <line
                    x1={PLOT.left}
                    x2={WIDTH - PLOT.right}
                    y1={tick.y}
                    y2={tick.y}
                    stroke="#29334a"
                    strokeDasharray="4 5"
                    strokeOpacity="0.62"
                  />
                  <text x={WIDTH - PLOT.right + 12} y={tick.y + 4} fill="#8793ad" fontSize="12">
                    {kgFormat.format(tick.value)}
                  </text>
                </g>
              ))}

              {chart.dateIndexes.map((index) => {
                const candle = chart.candles[index];
                const candleX = chart.x(index);
                return (
                  <g key={`x-${candle.date}`}>
                    <line
                      x1={candleX}
                      x2={candleX}
                      y1={PLOT.top}
                      y2={HEIGHT - PLOT.bottom}
                      stroke="#252f44"
                      strokeDasharray="3 6"
                      strokeOpacity="0.45"
                    />
                    <text
                      x={candleX}
                      y={HEIGHT - 17}
                      fill="#8793ad"
                      fontSize="12"
                      textAnchor="middle"
                    >
                      {dateLabel(candle.date, data.unit)}
                    </text>
                  </g>
                );
              })}

              {chart.lines.map((line, index) => line.path ? (
                <path
                  key={line.period}
                  d={line.path}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={index < 2 ? 1.45 : 1.7}
                  strokeOpacity={index < 2 ? 0.78 : 0.88}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter={index === 0 ? "url(#indicator-glow)" : undefined}
                  aria-label={`${line.period}-period simple moving average of transaction closing weight`}
                />
              ) : null)}

              {chart.candles.map((candle, index) => {
                const candleX = chart.x(index);
                const rising = candle.closeKg >= candle.openKg;
                const color = rising ? "#08d39a" : "#ff4d5e";
                const top = chart.y(Math.max(candle.openKg, candle.closeKg));
                const bottom = chart.y(Math.min(candle.openKg, candle.closeKg));
                const bodyHeight = Math.max(bottom - top, 1.5);
                const halfWidth = chart.candleWidth / 2;
                return (
                  <g key={candle.date}>
                    <line
                      x1={candleX}
                      x2={candleX}
                      y1={chart.y(candle.highKg)}
                      y2={chart.y(candle.lowKg)}
                      stroke={color}
                      strokeWidth={Math.max(1, chart.candleWidth * 0.2)}
                      strokeOpacity="0.9"
                    />
                    <rect
                      x={candleX - halfWidth}
                      y={top}
                      width={chart.candleWidth}
                      height={bodyHeight}
                      rx="0.7"
                      fill={color}
                      stroke={color}
                      strokeWidth="0.7"
                      className="transition-opacity"
                      opacity={hoveredIndex === null || hoveredIndex === index ? 0.96 : 0.72}
                    />
                  </g>
                );
              })}
              {hovered && hoveredIndex !== null && (
                <g pointerEvents="none" aria-hidden="true">
                  <line
                    x1={chart.x(hoveredIndex)}
                    x2={chart.x(hoveredIndex)}
                    y1={PLOT.top}
                    y2={HEIGHT - PLOT.bottom}
                    stroke="#a2aec8"
                    strokeDasharray="4 5"
                    strokeOpacity="0.5"
                  />
                  <circle
                    cx={chart.x(hoveredIndex)}
                    cy={chart.y(hovered.closeKg)}
                    r="5"
                    fill="#4ce1d4"
                    stroke="#d4fffb"
                    strokeWidth="1.5"
                    filter="url(#indicator-glow)"
                  />
                </g>
              )}
              <rect
                x={PLOT.left}
                y={PLOT.top}
                width={chart.plotWidth}
                height={chart.plotHeight}
                fill="transparent"
                tabIndex={0}
                role="slider"
                aria-label="Explore verified recycling candles"
                aria-valuemin={0}
                aria-valuemax={Math.max(chart.candles.length - 1, 0)}
                aria-valuenow={hoveredIndex ?? 0}
                aria-valuetext={hovered
                  ? `${dateLabel(hovered.date, data.unit, true)}: open ${kgFormat.format(hovered.openKg)} kilograms, high ${kgFormat.format(hovered.highKg)}, low ${kgFormat.format(hovered.lowKg)}, close ${kgFormat.format(hovered.closeKg)}, ${kgFormat.format(hovered.totalWeightKg)} kilograms total across ${hovered.transactions} transactions`
                  : "Use arrow keys to explore verified recycling activity"}
                className="cursor-crosshair focus-visible:outline focus-visible:outline-1 focus-visible:outline-indigo-400"
                onPointerMove={(event) => {
                  const svg = event.currentTarget.ownerSVGElement;
                  if (!svg || !chart.candles.length) return;
                  const bounds = svg.getBoundingClientRect();
                  const chartX = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
                  const fraction = Math.min(Math.max((chartX - PLOT.left) / chart.plotWidth, 0), 1);
                  const index = Math.round(fraction * Math.max(chart.candles.length - 1, 0));
                  showTooltip(index, event);
                }}
                onFocus={() => {
                  if (hoveredIndex === null) setHoveredIndex(Math.max(chart.candles.length - 1, 0));
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    setHoveredIndex((index) => Math.max((index ?? chart.candles.length) - 1, 0));
                  } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    setHoveredIndex((index) => Math.min((index ?? -1) + 1, chart.candles.length - 1));
                  } else if (event.key === "Escape") {
                    setHoveredIndex(null);
                  }
                }}
              />
            </motion.svg>

            <AnimatePresence>
              {hovered && (
                <motion.div
                  key={hovered.date}
                  initial={{ opacity: 0, y: 5, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 3, scale: 0.99 }}
                  transition={{ duration: 0.14 }}
                  className="pointer-events-none absolute z-10 w-[220px] rounded-xl border border-[#293650] bg-[#090e1b]/95 p-3 text-xs shadow-[0_14px_40px_rgba(0,0,0,0.5)] backdrop-blur-md"
                  style={{
                    left: `${Math.min(Math.max(tooltipPosition.x, 3), 75)}%`,
                    top: `${Math.min(Math.max(tooltipPosition.y - 20, 3), 65)}%`,
                  }}
                  role="status"
                >
                  <p className="mb-2 font-semibold text-slate-100">
                    {dateLabel(hovered.date, data.unit, true)}
                  </p>
                  <div className="space-y-1 text-slate-400">
                    {[
                      ["Open", hovered.openKg],
                      ["High", hovered.highKg],
                      ["Low", hovered.lowKg],
                      ["Close", hovered.closeKg],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4">
                        <span>{label}</span><span className="font-medium text-slate-200">{kgFormat.format(Number(value))} kg</span>
                      </div>
                    ))}
                    <div className="my-2 border-t border-[#293650]" />
                    <div className="flex justify-between gap-4">
                      <span>Verified volume</span><span className="font-medium text-slate-200">{kgFormat.format(hovered.totalWeightKg)} kg</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Transactions</span><span className="font-medium text-slate-200">{countFormat.format(hovered.transactions)}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : data && data.range === range && chart.candles.length === 0 ? (
          <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-center">
            <Recycle className="h-8 w-8 text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No verified recycling in this period</p>
            <p className="text-xs text-slate-500">Only confirmed, non-deleted recycling records appear here.</p>
          </div>
        ) : null}
      </div>

      <footer className="relative flex flex-col gap-3 border-t border-[#202b40] px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-slate-400">
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[2px] bg-[#08d39a]" />Up</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[2px] bg-[#ff4d5e]" />Down</span>
          {INDICATORS.map((indicator) => (
            <span key={indicator.period} className="inline-flex items-center gap-1.5">
              <i className="h-[2px] w-4 rounded-full" style={{ backgroundColor: indicator.color }} />
              {indicator.period}-{periodLabel} SMA
            </span>
          ))}
        </div>
        <p className="text-[10px] leading-4 text-slate-500">
          Candle OHLC = first, highest, lowest, and last verified transaction weight per {periodLabel}; volume is the period total.
        </p>
      </footer>
    </article>
  );
}
