import React from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import type { ChartSpec } from '@/types';

/* Each chart in the grid gets its own color palette for visual distinction */
const PALETTES = [
  ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],  // emerald
  ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'],  // blue
  ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'],  // violet
  ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa'],  // orange
];

const formatValue = (value: number, unit?: string) => {
  if (!unit) return String(value);
  if (unit.startsWith('$') || unit.startsWith('€') || unit.startsWith('£')) {
    const symbol = unit[0];
    const suffix = unit.slice(1);
    return `${symbol}${value}${suffix}`;
  }
  return `${value}${unit}`;
};

const CustomTooltip = ({ active, payload, unit }: any) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload ?? payload[0];
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md text-xs">
      <p className="font-medium text-slate-700">{entry.name ?? payload[0].name}</p>
      <p className="font-semibold" style={{ color: payload[0].color || '#059669' }}>
        {formatValue(entry.value ?? payload[0].value, unit)}
      </p>
    </div>
  );
};

const BORDER_COLORS = [
  'border-emerald-200', 'border-blue-200', 'border-violet-200', 'border-orange-200',
];
const BG_COLORS = [
  'from-emerald-50/60', 'from-blue-50/60', 'from-violet-50/60', 'from-orange-50/60',
];
const TITLE_COLORS = [
  'text-emerald-800', 'text-blue-800', 'text-violet-800', 'text-orange-800',
];

const renderBarChart = (spec: ChartSpec, palette: string[]) => (
  <ResponsiveContainer width="100%" height={220}>
    <BarChart data={spec.data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
      <XAxis
        dataKey="name"
        tick={{ fontSize: 11, fill: '#64748b' }}
        tickLine={false}
        axisLine={{ stroke: '#e2e8f0' }}
      />
      <YAxis
        tick={{ fontSize: 11, fill: '#64748b' }}
        tickLine={false}
        axisLine={false}
        tickFormatter={(v) => formatValue(v, spec.unit)}
      />
      <Tooltip content={<CustomTooltip unit={spec.unit} />} />
      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={52}>
        {spec.data.map((_, i) => (
          <Cell key={i} fill={palette[i % palette.length]} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

const renderPieChart = (spec: ChartSpec, palette: string[]) => (
  <ResponsiveContainer width="100%" height={240}>
    <PieChart>
      <Pie
        data={spec.data}
        cx="50%"
        cy="45%"
        innerRadius={40}
        outerRadius={75}
        paddingAngle={3}
        dataKey="value"
        nameKey="name"
      >
        {spec.data.map((_, i) => (
          <Cell key={i} fill={palette[i % palette.length]} />
        ))}
      </Pie>
      <Tooltip content={<CustomTooltip unit={spec.unit} />} />
      <Legend
        wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
        iconType="circle"
        iconSize={8}
        formatter={(val: string) => <span className="text-slate-600">{val}</span>}
      />
    </PieChart>
  </ResponsiveContainer>
);

const renderLineChart = (spec: ChartSpec, palette: string[]) => (
  <ResponsiveContainer width="100%" height={220}>
    <LineChart data={spec.data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
      <XAxis
        dataKey="name"
        tick={{ fontSize: 11, fill: '#64748b' }}
        tickLine={false}
        axisLine={{ stroke: '#e2e8f0' }}
      />
      <YAxis
        tick={{ fontSize: 11, fill: '#64748b' }}
        tickLine={false}
        axisLine={false}
        tickFormatter={(v) => formatValue(v, spec.unit)}
      />
      <Tooltip content={<CustomTooltip unit={spec.unit} />} />
      <Line
        type="monotone"
        dataKey="value"
        stroke={palette[0]}
        strokeWidth={2.5}
        dot={{ fill: palette[0], r: 5, strokeWidth: 2, stroke: '#fff' }}
        activeDot={{ r: 7, stroke: palette[0], strokeWidth: 2 }}
      />
    </LineChart>
  </ResponsiveContainer>
);

type ChartRenderer = (spec: ChartSpec, palette: string[]) => React.ReactNode;
const RENDERERS: Record<ChartSpec['type'], ChartRenderer> = {
  bar: renderBarChart,
  pie: renderPieChart,
  line: renderLineChart,
};

interface FinancialChartsProps {
  charts: ChartSpec[];
}

export const FinancialCharts: React.FC<FinancialChartsProps> = ({ charts }) => {
  if (!charts?.length) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {charts.map((spec, i) => {
        const renderer = RENDERERS[spec.type];
        if (!renderer || !spec.data?.length) return null;

        const paletteIdx = i % PALETTES.length;
        const palette = PALETTES[paletteIdx];

        return (
          <div
            key={i}
            className={`bg-gradient-to-br ${BG_COLORS[paletteIdx]} to-white border ${BORDER_COLORS[paletteIdx]} rounded-xl p-4`}
          >
            <h4 className={`text-xs font-semibold ${TITLE_COLORS[paletteIdx]} uppercase tracking-wide mb-3`}>
              {spec.title}
            </h4>
            {renderer(spec, palette)}
          </div>
        );
      })}
    </div>
  );
};
