import { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import {
  DEFAULTS, CONTROLS, computeModel, cumulativeCurve, sensitivityByUtilization,
  tcoVsThroughput, sensitivityTornado, platformMatrix, fmtUsdM, fmtBreakEven,
} from './model/tco.js';
import { PLATFORMS, PLATFORM_ORDER } from './model/platforms.js';
import { MODELS, MODEL_ORDER } from './model/models.js';
import { apiBenchmarks } from './model/apiPrices.js';
import {
  Slider, Section, Stat, Card, PlatformSelector, ModelSelector, SelectorGrid,
  MemoryFitBar, SpecGrid, PlatformMatrix, useMediaQuery, COLORS,
} from './components/UI.jsx';

const { navy, gold, teal, red, grey, blue } = COLORS;

const DEMAND_MODES = [
  { id: 'direct', label: 'Direct TPM' },
  { id: 'derived', label: 'From workload' },
];

const API_LINES = apiBenchmarks();

export default function App() {
  const [s, setS] = useState(DEFAULTS);
  const set = (key) => (val) => setS((prev) => ({ ...prev, [key]: val }));

  // Single-column layout on tablets/phones; single-column chart pairs on phones.
  const isMobile = useMediaQuery('(max-width: 900px)');
  const isNarrow = useMediaQuery('(max-width: 640px)');
  const chartPair = { display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 16 };

  const m = useMemo(() => computeModel(s), [s]);
  const curve = useMemo(() => cumulativeCurve(m), [m]);
  const sens = useMemo(() => sensitivityByUtilization(m), [m]);
  const sweep = useMemo(() => tcoVsThroughput(s), [s]);
  const tornado = useMemo(() => sensitivityTornado(s), [s]);
  const matrix = useMemo(() => platformMatrix(s), [s]);

  const specItems = m.llm.custom
    ? [
      ['tok/s/GPU (H200 ref)', s.customTokPerGpu.toLocaleString()],
      ['Weights', `${s.customWeightsGb} GB`],
      ['Throughput factor', `×${m.speedFactor.toFixed(2)}`],
    ]
    : [
      ['Total params', `${m.llm.totalB}B`],
      ['Active params', `${m.llm.activeB}B`],
      ['Precision', m.llm.precision],
      ['Weights', `${m.llm.weightsGb} GB`],
      ['Context', m.llm.contextK >= 1000 ? `${m.llm.contextK / 1000}M` : `${m.llm.contextK}K`],
      ['License', m.llm.license],
      ['Throughput factor', `×${m.speedFactor.toFixed(2)}`],
    ];

  const tornadoData = tornado.rows.map((r) => ({
    label: r.label,
    negD: (Math.min(r.low, r.high) - tornado.base) / 1e6,
    posD: (Math.max(r.low, r.high) - tornado.base) / 1e6,
  }));

  const tcoData = [
    { name: `On-Prem ${m.platform.label.replace('NVIDIA ', '')}`, value: m.onprem / 1e6, fill: navy },
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

  const tpmShown = Number(m.tpmEff.toFixed(1));

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f6f7f9', minHeight: '100vh', padding: isNarrow ? 10 : 16 }}>
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: gold, letterSpacing: 1, textTransform: 'uppercase' }}>AI Infrastructure Planning</div>
        <h1 style={{ fontSize: isNarrow ? 19 : 24, fontWeight: 800, color: navy, margin: '2px 0' }}>GPU Infrastructure TCO Calculator</h1>
        <div style={{ fontSize: 12.5, color: grey }}>
          On-Premise {m.platform.label} vs Azure · Serving {m.llm.label} at {tpmShown}M TPM · 5-year horizon
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, margin: '16px 0' }}>
          <Stat label="Fleet Sizing" value={`${m.nodes} ${m.platform.rackBased ? 'racks' : 'nodes'}`} sub={`${m.gpus} ${m.platform.label.replace('NVIDIA ', '')} GPUs · ${Math.round(m.effTokPerGpu)} tok/s/GPU`} />
          <Stat label="On-Prem 5-yr TCO" value={fmtUsdM(m.onprem)} sub={`${fmtUsdM(m.capex)} CAPEX`} color={navy} />
          <Stat label="Azure 3-yr RI" value={fmtUsdM(m.ri3)} sub={`${(m.ri3 / m.onprem).toFixed(1)}× on-prem`} color={teal} />
          <Stat label="Azure PAYG" value={fmtUsdM(m.payg)} sub={`${(m.payg / m.onprem).toFixed(1)}× on-prem`} color={red} />
          <Stat label="Break-even vs 3-yr RI" value={fmtBreakEven(m.beRi3)} sub="on-prem pulls ahead" color={gold} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(280px, 340px) 1fr', gap: 16, alignItems: 'start' }}>
          {/* Controls — sticky sidebar on desktop, plain block in the single-column flow */}
          <Card style={isMobile ? {} : { position: 'sticky', top: 16, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
            <PlatformSelector platforms={PLATFORMS} order={PLATFORM_ORDER} value={s.platform} onChange={set('platform')} />
            <ModelSelector models={MODELS} order={MODEL_ORDER} value={s.llm} onChange={set('llm')} />
            <SelectorGrid title="Demand Input" options={DEMAND_MODES} value={s.demandMode} onChange={set('demandMode')}
              footer={s.demandMode === 'derived' ? `Derived demand: ${tpmShown}M TPM at peak` : undefined} />
            {CONTROLS.map(([title, items]) => {
              const visible = items.filter((c) => !c[7] || c[7](s));
              if (!visible.length) return null;
              return (
                <Section key={title} title={title}>
                  {visible.map(([key, label, min, max, step, unit, fmt]) => (
                    <Slider key={key} label={label} value={s[key]} min={min} max={max} step={step}
                      unit={unit} fmt={fmt} onChange={set(key)} />
                  ))}
                </Section>
              );
            })}
            <div style={{ fontSize: 10.5, color: grey, lineHeight: 1.5 }}>
              Defaults from the sourced 5-yr TCO analysis. Azure RI rates proxied from H100 discounts.
              Model throughput scaled from active-weight bytes (see models.js) — benchmark before committing.
              Huawei Ascend included at gray-market planning rates; the 13 May 2025 US BIS GP10 ruling makes
              worldwide use an export-control violation — requires explicit legal/compliance sign-off.
            </div>
          </Card>

          {/* Charts */}
          <div>
            <Card title={`Model — ${m.llm.label}`}>
              <SpecGrid items={specItems} />
              <PlatformMatrix rows={matrix} currentId={s.platform} fmtUsd={fmtUsdM} />
              <div style={{ fontSize: 10.5, color: grey, margin: '2px 0 12px' }}>
                Fleet and cost per platform for the current workload; ◂ marks the selected platform.
                Throughput factor is the bandwidth-rule multiplier vs the GLM-4.5 calibration.
              </div>
              <MemoryFitBar fit={m.fit} />
              {m.fit.status === 'no-fit' && (
                <div style={{ fontSize: 11.5, color: red, fontWeight: 600, marginTop: 8 }}>
                  Model weights alone exceed one {m.fit.unitLabel}&apos;s HBM — each replica needs ≥{m.fit.minUnits} {m.fit.unitLabel}s
                  (multi-{m.fit.unitLabel} serving). Throughput estimates are optimistic in this regime.
                </div>
              )}
              {m.fit.status === 'tight' && (
                <div style={{ fontSize: 11.5, color: '#8a6d1a', fontWeight: 600, marginTop: 8 }}>
                  Weights fit, but leave less than the configured {s.kvHeadroomPct}% KV/batch headroom —
                  expect smaller batches and lower sustained throughput.
                </div>
              )}
            </Card>

            <div style={chartPair}>
              <Card title="5-Year TCO Comparison ($M)">
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={tcoData} margin={{ top: 10, right: 10, left: -10, bottom: isNarrow ? 8 : 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: isNarrow ? 8.5 : 10 }} interval={0}
                      angle={isNarrow ? -12 : 0} textAnchor={isNarrow ? 'end' : 'middle'} />
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

            <div style={chartPair}>
              <Card title="5-Year TCO vs Throughput (node-count steps)">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={sweep} margin={{ top: 10, right: 5, left: -5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="tpm" tick={{ fontSize: 10 }} label={{ value: 'M TPM', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                    <YAxis yAxisId="usd" tick={{ fontSize: 10 }} tickFormatter={(v) => '$' + v + 'M'} />
                    <YAxis yAxisId="n" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => v + ' n'} />
                    <Tooltip formatter={(v, name) => (name === 'Nodes' ? v : '$' + v.toFixed(1) + 'M')} labelFormatter={(l) => l + 'M TPM'} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line yAxisId="usd" type="stepAfter" dataKey="onprem" name="On-Prem" stroke={navy} strokeWidth={2.6} dot={false} />
                    <Line yAxisId="usd" type="stepAfter" dataKey="ri3" name="Azure 3-yr RI" stroke={teal} strokeWidth={2} dot={false} />
                    <Line yAxisId="usd" type="stepAfter" dataKey="payg" name="Azure PAYG" stroke={red} strokeWidth={2} dot={false} />
                    <Line yAxisId="n" type="stepAfter" dataKey="nodes" name="Nodes" stroke={grey} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                    {m.tpmEff >= 1 && m.tpmEff <= 50 &&
                      <ReferenceLine yAxisId="usd" x={Math.round(m.tpmEff)} stroke={gold} strokeDasharray="4 4"
                        label={{ value: 'current', fontSize: 10, fill: gold }} />}
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Sensitivity Tornado — On-Prem TCO, drivers ±20%">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={tornadoData} layout="vertical" stackOffset="sign" margin={{ top: 5, right: 15, left: isNarrow ? 8 : 40, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => (v > 0 ? '+' : '') + v.toFixed(1)} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: isNarrow ? 8.5 : 9.5 }} width={isNarrow ? 80 : 95} />
                    <Tooltip formatter={(v) => (v >= 0 ? '+' : '') + '$' + v.toFixed(2) + 'M vs base'} />
                    <ReferenceLine x={0} stroke="#888" label={{ value: `base ${fmtUsdM(tornado.base)}`, fontSize: 9, fill: '#666', position: 'top' }} />
                    <Bar dataKey="negD" name="TCO downside" stackId="t" fill={teal} />
                    <Bar dataKey="posD" name="TCO upside" stackId="t" fill={gold} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 10.5, color: grey, marginTop: 4 }}>
                  Zero-width TPM/utilization bars are real: node count moves in ceil() steps, so ±20% can land on the same fleet.
                </div>
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

            <Card title="Sensitivity — Effective $/Million Tokens vs Utilization · Public API Reference Lines">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={sens} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="util" tick={{ fontSize: 10 }} tickFormatter={(v) => v + '%'}
                    label={{ value: 'Sustained utilization', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => '$' + v} scale="log"
                    domain={[
                      (dataMin) => Math.min(dataMin, API_LINES[0].blended * 0.8),
                      (dataMax) => Math.max(dataMax, API_LINES[API_LINES.length - 1].blended * 1.5),
                    ]} allowDataOverflow />
                  <Tooltip formatter={(v) => '$' + v.toFixed(2) + '/M tok'} labelFormatter={(l) => l + '% utilization'} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine x={s.util} stroke={gold} strokeDasharray="4 4" label={{ value: 'design', fontSize: 10, fill: gold }} />
                  {API_LINES.map((b) => (
                    <ReferenceLine key={b.id} y={b.blended} stroke="#777" strokeDasharray="6 3"
                      label={{ value: `${b.label} $${b.blended.toFixed(2)}`, fontSize: 9, fill: '#666', position: 'insideBottomLeft' }} />
                  ))}
                  <Line dataKey="onprem" name="On-Prem" stroke={navy} strokeWidth={2.6} dot={{ r: 2 }} />
                  <Line dataKey="ri3" name="Azure 3-yr RI" stroke={teal} strokeWidth={2} dot={{ r: 2 }} />
                  <Line dataKey="payg" name="Azure PAYG" stroke={red} strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 11, color: grey, marginTop: 4 }}>
                On-prem cost is fixed, so $/token falls as utilization rises. Below ~40–50%, Azure Reserved is cheaper — the key test before committing to on-prem.
                Dashed lines are published API list prices (3:1 in/out blend, July 2026) — directional only: APIs bill actual tokens with no idle cost.
              </div>
            </Card>

            <div style={{ fontSize: 10.5, color: grey, lineHeight: 1.5, padding: '0 4px' }}>
              All figures are planning estimates. Throughput varies 2–3× with sequence length, batch size, and latency SLO — and the model-throughput scaling here is a first-order
              bandwidth rule. Benchmark your chosen model on your own traffic mix before committing. See CLAUDE.md and README.md for the full sourced assumptions.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
