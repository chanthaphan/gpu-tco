import { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import {
  DEFAULTS, CONTROLS, computeModel, cumulativeCurve, sensitivityByUtilization,
  fmtUsdM, fmtBreakEven,
} from './model/tco.js';
import { PLATFORMS, PLATFORM_ORDER } from './model/platforms.js';
import { Slider, Section, Stat, Card, PlatformSelector, COLORS } from './components/UI.jsx';

const { navy, gold, teal, red, grey, blue } = COLORS;

export default function App() {
  const [s, setS] = useState(DEFAULTS);
  const set = (key) => (val) => setS((prev) => ({ ...prev, [key]: val }));

  const m = useMemo(() => computeModel(s), [s]);
  const curve = useMemo(() => cumulativeCurve(m), [m]);
  const sens = useMemo(() => sensitivityByUtilization(m), [m]);

  const tcoData = [
    { name: 'On-Prem H200', value: m.onprem / 1e6, fill: navy },
    { name: 'Azure 3-yr RI', value: m.ri3 / 1e6, fill: teal },
    { name: 'Azure 1-yr RI', value: m.ri1 / 1e6, fill: gold },
    { name: 'Azure PAYG', value: m.payg / 1e6, fill: red },
  ];

  const breakdown = [
    { name: 'Servers', value: m.servers / 1e6, fill: navy },
    { name: 'Network/Storage', value: s.netStorage / 1e6, fill: '#1B3A6B' },
    { name: 'Electricity', value: m.elecUsd / 1e6, fill: teal },
    { name: 'Colocation', value: m.colo / 1e6, fill: blue },
    { name: 'Maintenance', value: m.maint / 1e6, fill: gold },
    { name: 'Staff', value: m.staff / 1e6, fill: '#D4B84A' },
    { name: 'Spares', value: s.spares / 1e6, fill: grey },
  ];

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f6f7f9', minHeight: '100vh', padding: 16 }}>
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: gold, letterSpacing: 1, textTransform: 'uppercase' }}>AI Infrastructure Planning</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: navy, margin: '2px 0' }}>GPU Infrastructure TCO Calculator</h1>
        <div style={{ fontSize: 12.5, color: grey }}>
          On-Premise {m.platform.label} vs Azure · Serving a large MoE LLM at {s.tpm}M TPM · 5-year horizon
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0' }}>
          <Stat label="Fleet Sizing" value={`${m.nodes} ${m.platform.rackBased ? 'racks' : 'nodes'}`} sub={`${m.gpus} ${m.platform.label} GPUs`} />
          <Stat label="On-Prem 5-yr TCO" value={fmtUsdM(m.onprem)} sub={`${fmtUsdM(m.capex)} CAPEX`} color={navy} />
          <Stat label="Azure 3-yr RI" value={fmtUsdM(m.ri3)} sub={`${(m.ri3 / m.onprem).toFixed(1)}× on-prem`} color={teal} />
          <Stat label="Azure PAYG" value={fmtUsdM(m.payg)} sub={`${(m.payg / m.onprem).toFixed(1)}× on-prem`} color={red} />
          <Stat label="Break-even vs 3-yr RI" value={fmtBreakEven(m.beRi3)} sub="on-prem pulls ahead" color={gold} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: 16, alignItems: 'start' }}>
          {/* Controls */}
          <Card style={{ position: 'sticky', top: 16, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
            <PlatformSelector platforms={PLATFORMS} order={PLATFORM_ORDER} value={s.platform} onChange={set('platform')} />
            {CONTROLS.map(([title, items]) => (
              <Section key={title} title={title}>
                {items.map(([key, label, min, max, step, unit, fmt]) => (
                  <Slider key={key} label={label} value={s[key]} min={min} max={max} step={step}
                    unit={unit} fmt={fmt} onChange={set(key)} />
                ))}
              </Section>
            ))}
            <div style={{ fontSize: 10.5, color: grey, lineHeight: 1.5 }}>
              Defaults from the sourced 5-yr TCO analysis. Azure RI rates proxied from H100 discounts.
              Huawei Ascend excluded from cost math (13 May 2025 US BIS worldwide-use ruling).
            </div>
          </Card>

          {/* Charts */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Card title="5-Year TCO Comparison ($M)">
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={tcoData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => '$' + v + 'M'} />
                    <Tooltip formatter={(v) => '$' + v.toFixed(1) + 'M'} />
                    <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                      {tcoData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card title="On-Prem TCO Breakdown ($M)">
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={breakdown} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => '$' + v.toFixed(0) + 'M'} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9.5 }} width={78} />
                    <Tooltip formatter={(v) => '$' + v.toFixed(2) + 'M'} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {breakdown.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <Card title="Cumulative Cost over 60 Months — Break-Even">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={curve} margin={{ top: 10, right: 20, left: -5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} label={{ value: 'Month', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => '$' + v + 'M'} />
                  <Tooltip formatter={(v) => '$' + v.toFixed(1) + 'M'} labelFormatter={(l) => 'Month ' + l} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line dataKey="onprem" name="On-Prem" stroke={navy} strokeWidth={2.6} dot={false} />
                  <Line dataKey="payg" name="Azure PAYG" stroke={red} strokeWidth={2} dot={false} />
                  <Line dataKey="ri1" name="Azure 1-yr RI" stroke={gold} strokeWidth={2} dot={false} />
                  <Line dataKey="ri3" name="Azure 3-yr RI" stroke={teal} strokeWidth={2} dot={false} />
                  {m.beRi3 != null && m.beRi3 <= 60 &&
                    <ReferenceLine x={Math.round(m.beRi3)} stroke={teal} strokeDasharray="4 4"
                      label={{ value: `${m.beRi3.toFixed(0)}mo`, fontSize: 10, fill: teal }} />}
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 16, fontSize: 11.5, color: '#445', marginTop: 6, flexWrap: 'wrap' }}>
                <span>Break-even vs <b style={{ color: red }}>PAYG</b>: {fmtBreakEven(m.bePayg)}</span>
                <span>vs <b style={{ color: gold }}>1-yr RI</b>: {fmtBreakEven(m.beRi1)}</span>
                <span>vs <b style={{ color: teal }}>3-yr RI</b>: {fmtBreakEven(m.beRi3)}</span>
              </div>
            </Card>

            <Card title="Sensitivity — Effective $/Million Tokens vs Utilization">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={sens} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="util" tick={{ fontSize: 10 }} tickFormatter={(v) => v + '%'}
                    label={{ value: 'Sustained utilization', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => '$' + v} scale="log" domain={['auto', 'auto']} allowDataOverflow />
                  <Tooltip formatter={(v) => '$' + v.toFixed(2) + '/M tok'} labelFormatter={(l) => l + '% utilization'} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine x={s.util} stroke={gold} strokeDasharray="4 4" label={{ value: 'design', fontSize: 10, fill: gold }} />
                  <Line dataKey="onprem" name="On-Prem" stroke={navy} strokeWidth={2.6} dot={{ r: 2 }} />
                  <Line dataKey="ri3" name="Azure 3-yr RI" stroke={teal} strokeWidth={2} dot={{ r: 2 }} />
                  <Line dataKey="payg" name="Azure PAYG" stroke={red} strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 11, color: grey, marginTop: 4 }}>
                On-prem cost is fixed, so $/token falls as utilization rises. Below ~40–50%, Azure Reserved is cheaper — the key test before committing to on-prem.
              </div>
            </Card>

            <div style={{ fontSize: 10.5, color: grey, lineHeight: 1.5, padding: '0 4px' }}>
              All figures are planning estimates. Throughput varies 2–3× with sequence length, batch size, and latency SLO — benchmark GLM-4.5/DeepSeek on your own traffic mix before committing. See CLAUDE.md and README.md for the full sourced assumptions.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
