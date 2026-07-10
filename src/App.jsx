import { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import {
  DEFAULTS, CONTROLS, computeModel, cumulativeCurve, sensitivityByUtilization,
  tcoVsThroughput, sensitivityTornado, platformMatrix, maasComparison, throughputExplainer,
} from './model/tco.js';
import { PLATFORMS, PLATFORM_ORDER } from './model/platforms.js';
import { MODELS, MODEL_ORDER } from './model/models.js';
import { apiBenchmarks } from './model/apiPrices.js';
import { T, moneyFormatter } from './i18n.js';
import {
  Slider, Section, Stat, Card, PlatformSelector, ModelSelector, SelectorGrid,
  MemoryFitBar, SpecGrid, PlatformMatrix, useMediaQuery, COLORS,
} from './components/UI.jsx';

const { navy, gold, teal, red, grey, blue } = COLORS;

const API_LINES = apiBenchmarks();

export default function App() {
  const [s, setS] = useState(DEFAULTS);
  const [locale, setLocale] = useState('en');
  const set = (key) => (val) => setS((prev) => ({ ...prev, [key]: val }));

  const L = T[locale];
  const money = useMemo(() => moneyFormatter(locale), [locale]);

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
  const maas = useMemo(() => maasComparison(s), [s]);
  const tx = useMemo(() => throughputExplainer(s), [s]);

  const tornadoData = tornado.rows.map((r) => ({
    label: L.controls[r.key] || r.label,
    negD: (Math.min(r.low, r.high) - tornado.base) / 1e6,
    posD: (Math.max(r.low, r.high) - tornado.base) / 1e6,
  }));

  const specItems = m.llm.custom
    ? [
      [L.spCustomTok, s.customTokPerGpu.toLocaleString()],
      [L.spWeights, `${s.customWeightsGb} GB`],
      [L.spFactor, `×${m.speedFactor.toFixed(2)}`],
    ]
    : [
      [L.spTotal, `${m.llm.totalB}B`],
      [L.spActive, `${m.llm.activeB}B`],
      [L.spPrecision, m.llm.precision],
      [L.spWeights, `${m.llm.weightsGb} GB`],
      [L.spContext, m.llm.contextK >= 1000 ? `${m.llm.contextK / 1000}M` : `${m.llm.contextK}K`],
      [L.spLicense, m.llm.license],
      [L.spFactor, `×${m.speedFactor.toFixed(2)}`],
    ];

  const tcoData = [
    { name: `On-Prem ${m.platform.label.replace('NVIDIA ', '').replace('Huawei ', '')}`, value: m.onprem / 1e6, fill: navy },
    { name: 'Azure 3-yr RI', value: m.ri3 / 1e6, fill: teal },
    { name: 'Azure 1-yr RI', value: m.ri1 / 1e6, fill: gold },
    { name: 'Azure PAYG', value: m.payg / 1e6, fill: red },
  ];

  const breakdown = [
    { name: L.breakdown.servers, value: m.servers / 1e6, fill: navy },
    { name: L.breakdown.net, value: s.netStorage / 1e6, fill: '#1B3A6B' },
    { name: L.breakdown.elec, value: m.elecUsd / 1e6, fill: teal },
    { name: L.breakdown.colo, value: m.colo / 1e6, fill: blue },
    { name: L.breakdown.maint, value: m.maint / 1e6, fill: gold },
    { name: L.breakdown.staff, value: m.staff / 1e6, fill: '#D4B84A' },
    { name: L.breakdown.spares, value: s.spares / 1e6, fill: grey },
  ];

  const tpmShown = Number(m.tpmEff.toFixed(1));
  const fmtBe = (v) => (v == null ? L.beNever : L.beMo(v.toFixed(0)));
  const fleetUnit = m.platform.rackBased
    ? (locale === 'en' && m.nodes > 1 ? L.unitRacks : L.unitRack)
    : (locale === 'en' && m.nodes > 1 ? L.unitNodes : L.unitNode);
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f6f7f9', minHeight: '100vh', padding: isNarrow ? 10 : 16 }}>
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: gold, letterSpacing: 1, textTransform: 'uppercase' }}>{L.kicker}</div>
            <h1 style={{ fontSize: isNarrow ? 19 : 24, fontWeight: 800, color: navy, margin: '2px 0' }}>{L.title}</h1>
            <div style={{ fontSize: 12.5, color: grey }}>
              {L.subtitle(m.platform.label, m.llm.label, tpmShown)}
            </div>
          </div>
          <div style={{ display: 'flex', border: '1px solid #d5d8dc', borderRadius: 8, overflow: 'hidden', flexShrink: 0, marginTop: 4 }}>
            {[['en', 'EN · $'], ['th', 'ไทย · ฿']].map(([id, label]) => (
              <button key={id} onClick={() => setLocale(id)}
                style={{
                  fontSize: 11.5, fontWeight: 700, padding: '7px 12px', cursor: 'pointer', border: 'none',
                  background: locale === id ? navy : '#fff', color: locale === id ? '#fff' : '#445', transition: 'all .12s',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, margin: '16px 0' }}>
          <Stat label={L.stFleet} value={`${m.nodes} ${fleetUnit}`} sub={`${m.gpus} ${m.platform.label.replace('NVIDIA ', '').replace('Huawei ', '')} GPU · ${Math.round(m.effTokPerGpu)} tok/s/GPU`} />
          <Stat label={L.stOnprem} value={money.m(m.onprem)} sub={`${money.m(m.capex)} ${L.capex}`} color={navy} />
          <Stat label={L.stRi3} value={money.m(m.ri3)} sub={`${(m.ri3 / m.onprem).toFixed(1)}${L.xOnprem}`} color={teal} />
          <Stat label={L.stPayg} value={money.m(m.payg)} sub={`${(m.payg / m.onprem).toFixed(1)}${L.xOnprem}`} color={red} />
          <Stat label={L.stBe} value={fmtBe(m.beRi3)} sub={L.stBeSub} color={gold} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(280px, 340px) 1fr', gap: 16, alignItems: 'start' }}>
          {/* Controls — sticky sidebar on desktop, plain block in the single-column flow */}
          <Card style={isMobile ? {} : { position: 'sticky', top: 16, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
            <PlatformSelector platforms={PLATFORMS} order={PLATFORM_ORDER} value={s.platform} onChange={set('platform')} L={L} money={money} />
            <ModelSelector models={MODELS} order={MODEL_ORDER} value={s.llm} onChange={set('llm')} L={L} />
            <SelectorGrid title={L.selDemand}
              options={[{ id: 'direct', label: L.demandDirect }, { id: 'derived', label: L.demandDerived }]}
              value={s.demandMode} onChange={set('demandMode')}
              footer={s.demandMode === 'derived' ? L.derivedNote(tpmShown) : undefined} />
            {CONTROLS.map(([title, items]) => {
              const visible = items.filter((c) => !c[7] || c[7](s));
              if (!visible.length) return null;
              return (
                <Section key={title} title={L.sections[title] || title}>
                  {visible.map(([key, label, min, max, step, unit, fmt]) => (
                    <Slider key={key} label={L.controls[key] || label} value={s[key]} min={min} max={max} step={step}
                      unit={unit} fmt={fmt} onChange={set(key)} />
                  ))}
                </Section>
              );
            })}
            <div style={{ fontSize: 10.5, color: grey, lineHeight: 1.5 }}>
              {L.inputsUsdNote && <div style={{ fontWeight: 700, marginBottom: 4 }}>{L.inputsUsdNote}</div>}
              {L.controlsFooter}
            </div>
          </Card>

          {/* Charts */}
          <div>
            <Card title={L.cardModel(m.llm.label)}>
              <SpecGrid items={specItems} />
              <PlatformMatrix rows={matrix} currentId={s.platform} money={money} L={L} />
              <div style={{ fontSize: 10.5, color: grey, margin: '2px 0 12px' }}>
                {L.matrixNote}
              </div>
              <MemoryFitBar fit={m.fit} L={L} />
              {m.fit.status === 'no-fit' && (
                <div style={{ fontSize: 11.5, color: red, fontWeight: 600, marginTop: 8 }}>
                  {L.memNoFit(m.fit.unitLabel === 'rack' ? L.unitRack : L.unitNode, m.fit.minUnits)}
                </div>
              )}
              {m.fit.status === 'tight' && (
                <div style={{ fontSize: 11.5, color: '#8a6d1a', fontWeight: 600, marginTop: 8 }}>
                  {L.memTight(s.kvHeadroomPct)}
                </div>
              )}
            </Card>

            <Card title={L.chGpu}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid #e0e3e7' }}>
                      {[L.mxPlatform, L.gsHbm, L.gsBw, L.gsFp8, L.gsTdp, L.gsLink, L.gsSrc].map((h, i) => (
                        <th key={h} style={{ fontSize: 9.5, color: grey, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: i === 0 ? 'left' : 'right', padding: '4px 8px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map((r) => {
                      const p = PLATFORMS[r.id];
                      const active = r.id === s.platform;
                      const td = { fontSize: 11.5, color: '#334', textAlign: 'right', padding: '5px 8px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #eef0f2', background: active ? '#0B25450D' : 'transparent' }}>
                          <td style={{ ...td, textAlign: 'left', fontWeight: active ? 800 : 600, color: active ? navy : '#334' }}>{p.label.replace('NVIDIA ', '')}{active ? ' ◂' : ''}</td>
                          <td style={td}>{p.hbmGb} GB {p.specs.hbmType}</td>
                          <td style={td}>{p.specs.bwTBs.toFixed(2)} TB/s</td>
                          <td style={td}>{p.specs.fp8Pflops.toFixed(1)} PFLOPS</td>
                          <td style={td}>{p.specs.tdpW.toLocaleString()} W</td>
                          <td style={td}>{p.specs.interconnect}</td>
                          <td style={{ ...td, fontSize: 10 }}>
                            <a href={p.specs.url} target="_blank" rel="noreferrer" style={{ color: teal }}>{p.specs.ref}</a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: navy, margin: '12px 0 4px' }}>{L.gsHow}</div>
              <ol style={{ fontSize: 11.5, color: '#334', margin: '0 0 8px', paddingLeft: 20, lineHeight: 1.7 }}>
                <li>{L.gsStep1(tx.calibrated.toLocaleString(), tx.plat.label)}</li>
                <li>{tx.model.custom
                  ? L.gsStep2Custom(s.customTokPerGpu.toLocaleString())
                  : L.gsStep2(tx.activeGb.toFixed(0), tx.model.label, tx.speedFactor.toFixed(2))}</li>
                <li>{L.gsStep3(tx.calibrated.toLocaleString(), tx.speedFactor.toFixed(2), Math.round(tx.effTokPerGpu).toLocaleString())}</li>
                <li>{L.gsStep4(Math.round(tx.effTokPerGpu).toLocaleString(), tx.gpusPerNode, tx.plat.rackBased ? L.unitRack : L.unitNode, Math.round(tx.nodeTokS).toLocaleString())}</li>
                <li>{L.gsStep5(Math.round(tx.rawCap).toLocaleString(), Math.round(tx.nodeTokS).toLocaleString(), tx.nodesExact.toFixed(2), tx.nodes,
                  tx.plat.rackBased ? (locale === 'en' && tx.nodes > 1 ? L.unitRacks : L.unitRack) : (locale === 'en' && tx.nodes > 1 ? L.unitNodes : L.unitNode))}</li>
              </ol>
              {tx.stepsPerSec && (
                <div style={{ fontSize: 11, color: grey, lineHeight: 1.5, background: '#f4f6f8', borderRadius: 8, padding: '8px 12px' }}>
                  {L.gsPhysics(tx.specs.bwTBs.toFixed(2), tx.activeGb.toFixed(0), Math.round(tx.stepsPerSec), tx.impliedBatch.toFixed(0), tx.specs.fp8Pflops.toFixed(1))}
                </div>
              )}
            </Card>

            <div style={chartPair}>
              <Card title={L.chTco(money.sym)}>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={tcoData} margin={{ top: 10, right: 10, left: -5, bottom: isNarrow ? 8 : 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: isNarrow ? 8.5 : 10 }} interval={0}
                      angle={isNarrow ? -12 : 0} textAnchor={isNarrow ? 'end' : 'middle'} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={money.axisM} />
                    <Tooltip formatter={money.axisM} />
                    <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                      {tcoData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card title={L.chBreakdown(money.sym)}>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={breakdown} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={money.axisM} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9.5 }} width={78} />
                    <Tooltip formatter={money.axisM} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {breakdown.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <div style={chartPair}>
              <Card title={L.chSweep}>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={sweep} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="tpm" tick={{ fontSize: 10 }} label={{ value: L.axMtpm, position: 'insideBottom', offset: -2, fontSize: 11 }} />
                    <YAxis yAxisId="usd" tick={{ fontSize: 10 }} tickFormatter={money.axisM} />
                    <YAxis yAxisId="n" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => v + ' n'} />
                    <Tooltip formatter={(v, name) => (name === L.axNodes ? v : money.axisM(v))} labelFormatter={(l) => l + 'M TPM'} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line yAxisId="usd" type="stepAfter" dataKey="onprem" name={L.lgOnprem} stroke={navy} strokeWidth={2.6} dot={false} />
                    <Line yAxisId="usd" type="stepAfter" dataKey="ri3" name={L.lgRi3} stroke={teal} strokeWidth={2} dot={false} />
                    <Line yAxisId="usd" type="stepAfter" dataKey="payg" name={L.lgPayg} stroke={red} strokeWidth={2} dot={false} />
                    <Line yAxisId="n" type="stepAfter" dataKey="nodes" name={L.axNodes} stroke={grey} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                    {m.tpmEff >= 1 && m.tpmEff <= 50 &&
                      <ReferenceLine yAxisId="usd" x={Math.round(m.tpmEff)} stroke={gold} strokeDasharray="4 4"
                        label={{ value: L.current, fontSize: 10, fill: gold }} />}
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card title={L.chTornado}>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={tornadoData} layout="vertical" stackOffset="sign" margin={{ top: 5, right: 15, left: isNarrow ? 8 : 40, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => (v > 0 ? '+' : '') + (v * money.rate).toFixed(money.rate === 1 ? 1 : 0)} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: isNarrow ? 8.5 : 9.5 }} width={isNarrow ? 80 : 95} />
                    <Tooltip formatter={(v) => `${money.deltaM(v)} ${L.vsBase}`} />
                    <ReferenceLine x={0} stroke="#888" label={{ value: L.tornadoBase(money.m(tornado.base)), fontSize: 9, fill: '#666', position: 'top' }} />
                    <Bar dataKey="negD" name={L.lgDown} stackId="t" fill={teal} />
                    <Bar dataKey="posD" name={L.lgUp} stackId="t" fill={gold} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 10.5, color: grey, marginTop: 4 }}>
                  {L.tornadoNote}
                </div>
              </Card>
            </div>

            <Card title={L.chCurve}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={curve} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} label={{ value: L.axMonth, position: 'insideBottom', offset: -2, fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={money.axisM} />
                  <Tooltip formatter={money.axisM} labelFormatter={(l) => `${L.axMonth} ${l}`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line dataKey="onprem" name={L.lgOnprem} stroke={navy} strokeWidth={2.6} dot={false} />
                  <Line dataKey="payg" name={L.lgPayg} stroke={red} strokeWidth={2} dot={false} />
                  <Line dataKey="ri1" name={L.lgRi1} stroke={gold} strokeWidth={2} dot={false} />
                  <Line dataKey="ri3" name={L.lgRi3} stroke={teal} strokeWidth={2} dot={false} />
                  {m.beRi3 != null && m.beRi3 <= 60 &&
                    <ReferenceLine x={Math.round(m.beRi3)} stroke={teal} strokeDasharray="4 4"
                      label={{ value: L.beMo(m.beRi3.toFixed(0)), fontSize: 10, fill: teal }} />}
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 16, fontSize: 11.5, color: '#445', marginTop: 6, flexWrap: 'wrap' }}>
                <span>{L.beVs} <b style={{ color: red }}>PAYG</b>: {fmtBe(m.bePayg)}</span>
                <span>{L.vs} <b style={{ color: gold }}>1-yr RI</b>: {fmtBe(m.beRi1)}</span>
                <span>{L.vs} <b style={{ color: teal }}>3-yr RI</b>: {fmtBe(m.beRi3)}</span>
              </div>
            </Card>

            <Card title={L.chSens}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={sens} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="util" tick={{ fontSize: 10 }} tickFormatter={(v) => v + '%'}
                    label={{ value: L.axUtil, position: 'insideBottom', offset: -2, fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => money.perTok(v)} scale="log"
                    domain={[
                      (dataMin) => Math.min(dataMin, API_LINES[0].blended * 0.8),
                      (dataMax) => Math.max(dataMax, API_LINES[API_LINES.length - 1].blended * 1.5),
                    ]} allowDataOverflow />
                  <Tooltip formatter={(v) => money.perTok(v) + '/M tok'} labelFormatter={(l) => l + '%'} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine x={s.util} stroke={gold} strokeDasharray="4 4" label={{ value: L.design, fontSize: 10, fill: gold }} />
                  {API_LINES.map((b) => (
                    <ReferenceLine key={b.id} y={b.blended} stroke="#777" strokeDasharray="6 3"
                      label={{ value: `${b.label} ${money.perTok(b.blended)}`, fontSize: 9, fill: '#666', position: 'insideBottomLeft' }} />
                  ))}
                  <Line dataKey="onprem" name={L.lgOnprem} stroke={navy} strokeWidth={2.6} dot={{ r: 2 }} />
                  <Line dataKey="ri3" name={L.lgRi3} stroke={teal} strokeWidth={2} dot={{ r: 2 }} />
                  <Line dataKey="payg" name={L.lgPayg} stroke={red} strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 11, color: grey, marginTop: 4 }}>
                {L.sensNote}
              </div>
            </Card>

            <Card title={L.chMaas}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid #e0e3e7' }}>
                      {[L.maasModel, L.maasBlended, L.maasCost, L.maasRatio, L.maasBe].map((h, i) => (
                        <th key={h} style={{ fontSize: 9.5, color: grey, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: i === 0 ? 'left' : 'right', padding: '4px 8px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {maas.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #eef0f2' }}>
                        <td style={{ fontSize: 12, fontWeight: 600, color: navy, textAlign: 'left', padding: '5px 8px', whiteSpace: 'nowrap' }}>{r.label}</td>
                        <td style={{ fontSize: 12, color: '#334', textAlign: 'right', padding: '5px 8px', fontVariantNumeric: 'tabular-nums' }}>{money.perTok(r.blended)}</td>
                        <td style={{ fontSize: 12, color: red, fontWeight: 700, textAlign: 'right', padding: '5px 8px', fontVariantNumeric: 'tabular-nums' }}>{money.m(r.cost)}</td>
                        <td style={{ fontSize: 12, color: '#334', textAlign: 'right', padding: '5px 8px', fontVariantNumeric: 'tabular-nums' }}>{r.ratio.toFixed(1)}×</td>
                        <td style={{ fontSize: 12, color: teal, fontWeight: 700, textAlign: 'right', padding: '5px 8px', fontVariantNumeric: 'tabular-nums' }}>{r.beTpm ? L.maasBeVal(r.beTpm.toFixed(1)) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 10.5, color: grey, marginTop: 6, lineHeight: 1.5 }}>
                {L.maasNote}
              </div>
            </Card>

            <div style={{ fontSize: 10.5, color: grey, lineHeight: 1.5, padding: '0 4px' }}>
              {L.pageFooter}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
