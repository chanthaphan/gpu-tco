import { useEffect, useState } from 'react';

/** Reactive CSS media query — used to collapse layouts on small screens. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export const COLORS = {
  navy: '#0B2545', gold: '#C9A227', teal: '#0E7C7B',
  red: '#B0413E', grey: '#8A8D91', blue: '#3D6FB4',
};

export function Slider({ label, value, min, max, step, unit, fmt, onChange }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <label style={{ fontSize: 12.5, color: '#334', fontWeight: 600 }}>{label}</label>
        <span style={{ fontSize: 12.5, color: COLORS.navy, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {fmt(value)}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: COLORS.teal, cursor: 'pointer' }}
      />
    </div>
  );
}

export function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color: COLORS.teal, textTransform: 'uppercase',
        letterSpacing: 0.6, marginBottom: 10, borderBottom: '1.5px solid #0E7C7B22', paddingBottom: 4,
      }}>{title}</div>
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 10, padding: '12px 14px', flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 10.5, color: COLORS.grey, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || COLORS.navy, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: COLORS.grey, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function SelectorGrid({ title, options, value, onChange, footer }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color: COLORS.teal, textTransform: 'uppercase',
        letterSpacing: 0.6, marginBottom: 10, borderBottom: '1.5px solid #0E7C7B22', paddingBottom: 4,
      }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {options.map(({ id, label }) => {
          const active = id === value;
          return (
            <button key={id} onClick={() => onChange(id)}
              style={{
                fontSize: 11.5, fontWeight: 700, padding: '8px 6px', borderRadius: 8, cursor: 'pointer',
                border: active ? `2px solid ${COLORS.navy}` : '1px solid #d5d8dc',
                background: active ? COLORS.navy : '#fff',
                color: active ? '#fff' : '#445', transition: 'all .12s',
              }}>
              {label}
            </button>
          );
        })}
      </div>
      {footer && <div style={{ fontSize: 10.5, color: COLORS.grey, marginTop: 6 }}>{footer}</div>}
    </div>
  );
}

export function PlatformSelector({ platforms, order, value, onChange, L, money }) {
  const p = platforms[value];
  const unit = p.rackBased ? L.unitRack : L.unitNode;
  return (
    <SelectorGrid title={L.selPlatform} options={order.map((id) => platforms[id])}
      value={value} onChange={onChange}
      footer={
        <>
          {p.tokPerGpu.toLocaleString()} tok/s/GPU · {p.gpusPerNode} GPU/{unit} · {money.m(p.nodeCost)}/{unit}
          {p.caution && <div style={{ color: COLORS.red, fontWeight: 700, marginTop: 3 }}>⚠ {L.ascendCaution}</div>}
        </>
      } />
  );
}

export function ModelSelector({ models, order, value, onChange, L }) {
  const m = models[value];
  return (
    <SelectorGrid title={L.selModel} options={order.map((id) => models[id])}
      value={value} onChange={onChange}
      footer={m.custom ? L.customNote : L.modelSpec(m)} />
  );
}

const FIT_COLORS = { 'fits': COLORS.teal, 'tight': COLORS.gold, 'no-fit': COLORS.red };
export const fitText = (L, status) =>
  ({ 'fits': L.fitFits, 'tight': L.fitTight, 'no-fit': L.fitNoFit }[status]);

export function MemoryFitBar({ fit, L }) {
  const color = FIT_COLORS[fit.status];
  const weightsPct = Math.min(100, (fit.weightsGb / fit.nodeHbmGb) * 100);
  const usablePct = (fit.usableGb / fit.nodeHbmGb) * 100;
  const unit = fit.unitLabel === 'rack' ? L.unitRack : L.unitNode;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#334' }}>
          {L.memLine(fit.weightsGb.toLocaleString(), fit.nodeHbmGb.toLocaleString(), unit)}
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 0.4 }}>{fitText(L, fit.status)}</span>
      </div>
      <div style={{ position: 'relative', height: 14, background: '#e8eaed', borderRadius: 7, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${weightsPct}%`, background: color, borderRadius: 7 }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${usablePct}%`, width: 2, background: '#555' }}
          title="KV/batch headroom boundary" />
      </div>
      <div style={{ fontSize: 10.5, color: COLORS.grey, marginTop: 4 }}>
        {L.memMarker(fit.usableGb.toFixed(0))}
      </div>
    </div>
  );
}

export function SpecGrid({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: 8, marginBottom: 12 }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ background: '#f4f6f8', borderRadius: 8, padding: '7px 10px' }}>
          <div style={{ fontSize: 9.5, color: COLORS.grey, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

export function PlatformMatrix({ rows, currentId, money, L }) {
  const th = { fontSize: 9.5, color: COLORS.grey, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'right', padding: '4px 8px' };
  const td = { fontSize: 12, color: '#334', textAlign: 'right', padding: '5px 8px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
  const en = L.locale === 'en';
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1.5px solid #e0e3e7' }}>
            <th style={{ ...th, textAlign: 'left' }}>{L.mxPlatform}</th>
            <th style={th}>{L.mxTok}</th>
            <th style={th}>{L.mxFleet}</th>
            <th style={th}>{L.mxTco}</th>
            <th style={th}>{L.mxMemory}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const active = r.id === currentId;
            const unit = r.rackBased
              ? (en && r.nodes > 1 ? L.unitRacks : L.unitRack)
              : (en && r.nodes > 1 ? L.unitNodes : L.unitNode);
            return (
              <tr key={r.id} style={{ borderBottom: '1px solid #eef0f2', background: active ? '#0B25450D' : 'transparent' }}>
                <td style={{ ...td, textAlign: 'left', fontWeight: active ? 800 : 600, color: active ? COLORS.navy : '#334' }}>
                  {r.label.replace('NVIDIA ', '')}{active ? ' ◂' : ''}
                </td>
                <td style={td}>{Math.round(r.effTokPerGpu).toLocaleString()}</td>
                <td style={td}>{r.nodes} {unit} · {r.gpus} GPU</td>
                <td style={td}>{money.m(r.onprem)}</td>
                <td style={{ ...td, color: FIT_COLORS[r.fit], fontWeight: 700 }}>{fitText(L, r.fit)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Card({ title, children, style }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: 16, marginBottom: 16, ...style }}>
      {title && <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, marginBottom: 8 }}>{title}</div>}
      {children}
    </div>
  );
}
