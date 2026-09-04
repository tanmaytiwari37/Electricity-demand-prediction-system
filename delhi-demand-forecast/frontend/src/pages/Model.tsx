import type { ReactNode } from 'react'
import ImportanceChart from '../components/charts/ImportanceChart.tsx'
import KpiTile, { StatStrip } from '../components/ui/KpiTile.tsx'
import Panel, { PageHeader } from '../components/ui/Panel.tsx'
import { SourceLine, historyKind } from '../components/ui/Badges.tsx'
import { StatusDot } from '../components/ui/StatusList.tsx'
import { EmptyState, ErrorState, Loading } from '../components/ui/States.tsx'
import { useApi } from '../hooks/useApi.ts'
import { useAppState } from '../hooks/useAppState.tsx'
import { api } from '../services/api.ts'
import type { MetricSet } from '../types/api.ts'
import { fmtDate, fmtDateTime, fmtInt, fmtPct } from '../utils/format.ts'

const NAMES: Record<string, string> = {
  same_hour_previous_day: 'Same hour yesterday',
  same_hour_previous_week: 'Same hour last week',
  hist_gradient_boosting: 'Gradient boosting (HistGB)',
  random_forest: 'Random forest',
}

export default function Model() {
  const { version, status } = useAppState()
  const model = useApi((s) => api.model(s), [version, status?.model.status])
  const m = model.data
  const report = m?.dataset_report ?? status?.history.report

  // Test-period metrics for the selected model and the named baseline, straight
  // from the model card. Nothing here is computed on the client.
  const selTest = m?.name ? m.candidates?.[m.name]?.test : undefined
  const baseTest = m?.baseline_name ? m.baselines?.[m.baseline_name]?.test : undefined
  const maxMae = Math.max(baseTest?.mae ?? m?.baseline_mae ?? 1, selTest?.mae ?? m?.model_mae ?? 1)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Model intelligence"
        subtitle="Does the model beat a naive rule, and what drives its predictions? Every number comes from the model card written at training time."
        sources={m?.loaded && <SourceLine kinds={[historyKind(m.data_source === 'demo' ? 'demo' : 'real')]} />}
      />

      {model.loading && !m ? <Loading height="h-48" /> : model.error ? <ErrorState error={model.error} onRetry={model.refetch} /> : m && !m.loaded ? (
        <Panel title="Model status">
          {m.status === 'training' ? (
            <div className="flex items-center gap-3 text-sm text-ink-2"><StatusDot light="warning" pulse />Training the demo model in the background. This page updates automatically when it finishes.</div>
          ) : (
            <EmptyState title={`No trained model loaded (status: ${m.status})`} hint={m.error ?? 'Run scripts/train_model.py on a cleaned CSV, or enable PEAKWATCH_AUTO_TRAIN_DEMO for demo mode. Forecasts use the heuristic estimate until then.'} />
          )}
        </Panel>
      ) : m && (
        <>
          <StatStrip cols="md:grid-cols-4">
            <KpiTile flat size="lg" label="MAE" value={selTest ? fmtInt(selTest.mae) : fmtInt(m.model_mae)} unit="MW" sub={selTest ? 'test period, 1 h ahead' : 'validation'} />
            <KpiTile flat size="lg" label="RMSE" value={selTest ? fmtInt(selTest.rmse) : '–'} unit="MW" sub="test period" />
            <KpiTile flat size="lg" label="MAPE" value={selTest ? fmtPct(selTest.mape, 2) : '–'} sub="test period" />
            <KpiTile flat size="lg" label="Better than baseline" value={fmtPct(m.improvement_pct, 1)} tone="good" sub={`vs ${NAMES[m.baseline_name ?? ''] ?? m.baseline_name}`} />
          </StatStrip>

          <div className="grid gap-5 xl:grid-cols-3">
            <Panel title="Model" bodyClassName="!px-0 !pb-0 !pt-2">
              <dl className="divide-y divide-line text-[13px]">
                <Row k="Status"><span className="flex items-center gap-1.5 font-semibold text-ink"><StatusDot light="good" />Loaded</span></Row>
                <Row k="Version">{NAMES[m.name ?? ''] ?? m.name ?? '–'}{m.trained_at && <span className="block text-[11px] text-ink-3">trained {fmtDateTime(m.trained_at)}</span>}</Row>
                <Row k="Forecast method">{sentence(status?.forecast.label)}</Row>
                <Row k="Weather source">{sentence(status?.weather.label)}</Row>
                <Row k="Training data">{m.data_source === 'demo' ? 'Simulated demo history' : 'Recorded Delhi system load'}</Row>
                <Row k="Training records"><span className="num">{fmtInt(m.n_rows)} hourly rows{m.rows && <span className="block text-[11px] text-ink-3">train {fmtInt(m.rows.train)} · validation {fmtInt(m.rows.validation)} · test {fmtInt(m.rows.test)}</span>}</span></Row>
                <Row k="Validation period"><span className="num">{m.test_period ? `${fmtDate(m.test_period.start)} → ${fmtDate(m.test_period.end)}` : '–'}</span></Row>
                <Row k="Interval coverage"><span className="num">{fmtPct(m.interval_coverage_pct, 1)} <span className="text-[11px] text-ink-3">of test hours inside P10–P90 · target 80%</span></span></Row>
              </dl>
            </Panel>

            <Panel className="xl:col-span-2" title="Naive baseline vs ML model" subtitle="Chronological split: compared on validation, the winner scored once on the untouched test period.">
              <div className="mb-5 grid gap-4 md:grid-cols-2">
                <Compare label={NAMES[m.baseline_name ?? ''] ?? m.baseline_name ?? 'Baseline'} mw={baseTest?.mae ?? m.baseline_mae} max={maxMae} cls="bg-ink-3" />
                <Compare label={NAMES[m.name ?? ''] ?? m.name ?? 'Model'} mw={selTest?.mae ?? m.model_mae} max={maxMae} cls="bg-series-blue" />
              </div>
              <MetricsTable baselines={m.baselines ?? {}} candidates={m.candidates ?? {}} selected={m.name ?? ''} />
            </Panel>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title="What drives the prediction" subtitle="Permutation importance on the test set: MAE increase when a feature is shuffled.">
              {m.feature_importance?.length ? <ImportanceChart items={m.feature_importance} /> : <EmptyState title="No importance data" />}
            </Panel>
            <Panel title="Training data" subtitle={report ? `Source: ${report.source}` : undefined}>
              {report ? (
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
                  <Fact label="Rows (raw → clean)" value={`${fmtInt(report.rows_raw)} → ${fmtInt(report.rows_clean)}`} />
                  <Fact label="Period" value={report.start && report.end ? `${fmtDate(report.start)} → ${fmtDate(report.end)}` : '–'} />
                  <Fact label="Coverage" value={`${report.coverage_days} days`} />
                  <Fact label="Gaps interpolated" value={fmtInt(report.gaps_interpolated)} />
                  <Fact label="Gaps unfilled" value={fmtInt(report.gaps_unfilled)} />
                  <Fact label="Missing demand" value={fmtPct(report.missing_target_pct)} />
                  {report.warnings.length > 0 && <div className="col-span-full text-[12px] text-warning">{report.warnings.join(' ')}</div>}
                </div>
              ) : <EmptyState title="No dataset report" />}
              {m.feature_columns && <p className="mt-5 border-t border-line pt-4 text-[11.5px] leading-relaxed text-ink-3">Features: {m.feature_columns.join(', ')}. Lags and rolling means use only values before the target hour.</p>}
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}

/** Backend labels arrive in capitals; show them as sentence case. */
const sentence = (s?: string | null): string => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '–')

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 px-5 py-3">
      <dt className="label self-start pt-0.5">{k}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="num mt-1 text-[13px] font-semibold text-ink">{value}</div>
    </div>
  )
}

function Compare({ label, mw, max, cls }: { label: string; mw?: number; max: number; cls: string }) {
  const pct = mw != null ? Math.min(100, (mw / max) * 100) : 0
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="truncate text-[12px] text-ink-2">{label}</span>
        <span className="num text-base font-bold text-ink">{fmtInt(mw)} <span className="text-[10.5px] font-semibold text-ink-3">MW MAE</span></span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-sm bg-surface-3"><div className={`h-full rounded-sm ${cls}`} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

function MetricsTable({ baselines, candidates, selected }: {
  baselines: Record<string, { validation: MetricSet; test?: MetricSet }>
  candidates: Record<string, { validation: MetricSet; test?: MetricSet }>
  selected: string
}) {
  const rows = [
    ...Object.entries(baselines).map(([k, v]) => ({ key: k, kind: 'baseline', ...v })),
    ...Object.entries(candidates).map(([k, v]) => ({ key: k, kind: 'candidate', ...v })),
  ]
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="num w-full text-[13px]">
        <thead>
          <tr className="border-b border-line"><th className="label pb-2 text-left">Model</th><th className="label whitespace-nowrap px-3 pb-2 text-right">Val MAE</th><th className="label whitespace-nowrap px-3 pb-2 text-right">Test MAE</th><th className="label px-3 pb-2 text-right">RMSE</th><th className="label px-3 pb-2 text-right">MAPE</th><th className="label whitespace-nowrap px-3 pb-2 text-right">Peak MAE</th><th className="label whitespace-nowrap pl-3 pb-2 text-right">Peak hr ±1 h</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={`border-b border-line last:border-0 ${r.key === selected ? 'bg-surface-2/70' : ''}`}>
              <td className="py-2.5 pr-3">
                <span className="font-semibold text-ink">{NAMES[r.key] ?? r.key}</span>
                <span className="ml-2 text-[10px] uppercase tracking-wider text-ink-3">{r.kind}{r.key === selected ? ' · selected' : ''}</span>
              </td>
              <td className="px-3 py-2.5 text-right text-ink-2">{fmtInt(r.validation.mae)}</td>
              <td className="px-3 py-2.5 text-right font-semibold text-ink">{r.test ? fmtInt(r.test.mae) : '–'}</td>
              <td className="px-3 py-2.5 text-right text-ink-2">{r.test ? fmtInt(r.test.rmse) : '–'}</td>
              <td className="px-3 py-2.5 text-right text-ink-2">{r.test ? fmtPct(r.test.mape, 2) : '–'}</td>
              <td className="px-3 py-2.5 text-right text-ink-2">{r.test?.daily_peak_mae != null ? fmtInt(r.test.daily_peak_mae) : '–'}</td>
              <td className="pl-3 py-2.5 text-right text-ink-2">{r.test?.peak_hour_hit_rate != null ? fmtPct(r.test.peak_hour_hit_rate, 0) : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
