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

const PALETTE = ['#171717', '#6b7280', '#9ca3af', '#d4d4d4', '#e5e7eb'];

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
    <div className="bg-white border border-[#e5e7eb] rounded px-3 py-2 text-xs shadow-sm">
      <p className="text-[#6b7280]">{entry.name ?? payload[0].name}</p>
      <p className="font-semibold text-[#171717]">
        {formatValue(entry.value ?? payload[0].value, unit)}
      </p>
    </div>
  );
};

const renderBarChart = (spec: ChartSpec) => (
  <ResponsiveContainer width="100%" height={220}>
    <BarChart data={spec.data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
      <XAxis
        dataKey="name"
        tick={{ fontSize: 11, fill: '#9ca3af' }}
        tickLine={false}
        axisLine={{ stroke: '#e5e7eb' }}
      />
      <YAxis
        tick={{ fontSize: 11, fill: '#9ca3af' }}
        tickLine={false}
        axisLine={false}
        tickFormatter={(v) => formatValue(v, spec.unit)}
      />
      <Tooltip content={<CustomTooltip unit={spec.unit} />} />
      <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={48}>
        {spec.data.map((_, i) => (
          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

const renderPieChart = (spec: ChartSpec) => (
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
          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
        ))}
      </Pie>
      <Tooltip content={<CustomTooltip unit={spec.unit} />} />
      <Legend
        wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
        iconType="circle"
        iconSize={8}
        formatter={(val: string) => <span className="text-[#6b7280]">{val}</span>}
      />
    </PieChart>
  </ResponsiveContainer>
);

const renderLineChart = (spec: ChartSpec) => (
  <ResponsiveContainer width="100%" height={220}>
    <LineChart data={spec.data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
      <XAxis
        dataKey="name"
        tick={{ fontSize: 11, fill: '#9ca3af' }}
        tickLine={false}
        axisLine={{ stroke: '#e5e7eb' }}
      />
      <YAxis
        tick={{ fontSize: 11, fill: '#9ca3af' }}
        tickLine={false}
        axisLine={false}
        tickFormatter={(v) => formatValue(v, spec.unit)}
      />
      <Tooltip content={<CustomTooltip unit={spec.unit} />} />
      <Line
        type="monotone"
        dataKey="value"
        stroke="#171717"
        strokeWidth={2}
        dot={{ fill: '#171717', r: 3, strokeWidth: 2, stroke: '#fff' }}
        activeDot={{ r: 5, stroke: '#171717', strokeWidth: 2 }}
      />
    </LineChart>
  </ResponsiveContainer>
);

type ChartRenderer = (spec: ChartSpec) => React.ReactNode;
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

        return (
          <div key={i} className="border border-[#e5e7eb] rounded p-4">
            <h4 className="text-xs font-medium text-[#9ca3af] uppercase tracking-wide mb-3">
              {spec.title}
            </h4>
            {renderer(spec)}
          </div>
        );
      })}
    </div>
  );
};
