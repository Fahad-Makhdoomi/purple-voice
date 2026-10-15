'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/** The subset of Recharts' tooltip content props we read. */
interface TooltipContent {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string | number;
}

/**
 * Chart conventions (see BRAND.md → Data visualisation):
 * one series per chart, in the brand violet; 2px lines; area fill as a ~10%
 * wash; columns ≤ 24px with 4px rounded tops; hairline horizontal grid;
 * hover tooltip on every chart; a data table under each for screen readers
 * and anyone who prefers numbers. Text never takes the series colour.
 */

const SERIES = 'rgb(var(--pv-violet-600))';
const GRID = 'rgb(var(--pv-line))';
const AXIS = 'rgb(var(--pv-muted))';

const compact = (n: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

type Datum = Record<string, string | number>;

interface SeriesChartProps {
  data: Datum[];
  x: string;
  y: string;
  label: string;
  formatX?: (v: string) => string;
  formatY?: (v: number) => string;
  height?: number;
}

function ChartTooltip({
  active,
  payload,
  label,
  formatX,
  formatY,
  name,
}: TooltipContent & {
  formatX?: (v: string) => string;
  formatY?: (v: number) => string;
  name: string;
}) {
  if (!active || !payload?.length) return null;
  const v = Number(payload[0].value ?? 0);
  return (
    <div className="rounded-sm border border-line bg-surface px-3 py-2 text-xs shadow">
      <p className="text-muted">{formatX ? formatX(String(label)) : String(label)}</p>
      <p className="mt-0.5 flex items-center gap-2 font-semibold text-ink">
        <span className="h-2 w-2 rounded-full" style={{ background: SERIES }} />
        {name}: {formatY ? formatY(v) : v.toLocaleString()}
      </p>
    </div>
  );
}

function DataTable({ data, x, y, label, formatX, formatY }: SeriesChartProps) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-ink">
        Show data table
      </summary>
      <div className="mt-2 max-h-60 overflow-auto">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{x}</th>
              <th scope="col" className="text-right">
                {label}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i}>
                <td>{formatX ? formatX(String(d[x])) : String(d[x])}</td>
                <td className="num text-right">
                  {formatY ? formatY(Number(d[y])) : Number(d[y]).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function NoData({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-sm border border-dashed border-line text-sm text-muted"
      style={{ height }}
    >
      Nothing to show for this period yet.
    </div>
  );
}

const isEmpty = (data: Datum[], y: string) => data.every((d) => !Number(d[y]));

export function TrendChart(props: SeriesChartProps) {
  const { data, x, y, label, formatX, formatY, height = 240 } = props;
  if (isEmpty(data, y)) return <NoData height={height} />;
  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="pv-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={SERIES} stopOpacity={0.14} />
                <stop offset="100%" stopColor={SERIES} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
            <XAxis
              dataKey={x}
              tickFormatter={formatX}
              tick={{ fill: AXIS, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v: number) => (formatY ? formatY(v) : compact(v))}
              tick={{ fill: AXIS, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={48}
            />
            <Tooltip
              cursor={{ stroke: AXIS, strokeWidth: 1 }}
              content={(p) => (
                <ChartTooltip
                  {...(p as unknown as TooltipContent)}
                  formatX={formatX}
                  formatY={formatY}
                  name={label}
                />
              )}
            />
            <Area
              type="monotone"
              dataKey={y}
              stroke={SERIES}
              strokeWidth={2}
              fill="url(#pv-area)"
              activeDot={{ r: 5, stroke: 'white', strokeWidth: 2, fill: SERIES }}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <DataTable {...props} />
    </div>
  );
}

export function ColumnChart(props: SeriesChartProps) {
  const { data, x, y, label, formatX, formatY, height = 240 } = props;
  if (isEmpty(data, y)) return <NoData height={height} />;
  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
            <XAxis
              dataKey={x}
              tickFormatter={formatX}
              tick={{ fill: AXIS, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={12}
            />
            <YAxis
              tickFormatter={(v: number) => (formatY ? formatY(v) : compact(v))}
              tick={{ fill: AXIS, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={48}
            />
            <Tooltip
              cursor={{ fill: 'rgb(var(--pv-violet-100) / 0.6)' }}
              content={(p) => (
                <ChartTooltip
                  {...(p as unknown as TooltipContent)}
                  formatX={formatX}
                  formatY={formatY}
                  name={label}
                />
              )}
            />
            <Bar
              dataKey={y}
              fill={SERIES}
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable {...props} />
    </div>
  );
}

/** Ranked horizontal bars in plain HTML: label left, value at the bar's tip. */
export function BarList({
  items,
  formatValue = (v) => v.toLocaleString(),
}: {
  items: Array<{ label: string; value: number }>;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="py-6 text-center text-sm text-muted">No data yet.</p>;
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.label}
          className="grid grid-cols-[minmax(110px,40%)_1fr] items-center gap-3 text-sm"
        >
          <span className="truncate text-ink-soft" title={item.label}>
            {item.label}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-3 rounded-r-[4px]"
              style={{
                width: `${(item.value / max) * 85}%`,
                background: SERIES,
                minWidth: item.value ? 4 : 0,
              }}
            />
            <span className="num text-xs font-semibold text-ink">{formatValue(item.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
