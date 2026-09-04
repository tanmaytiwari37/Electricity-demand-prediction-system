import ImportanceChart from '../components/charts/ImportanceChart.tsx'
import KpiTile from '../components/ui/KpiTile.tsx'
import Panel from '../components/ui/Panel.tsx'
import { Badge } from '../components/ui/Badges.tsx'
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">Model and data</h1>
        <p className="text-xs text-ink-3">Does the AI add value over a naive rule? What drives its predictions? What data was it trained on?</p>
      </div>

      {model.loading && !m ? <Loading height="h-48" /> : model.error ? <ErrorState error={model.error} onRetry={model.refetch} /> : m && !m.loaded ? (
        <Panel title="Model status">
          {m.status === 'training' ? (
            <div className="flex items-center gap-3 text-sm text-ink-2"><span className="h-2 w-2 animate-pulse rounded-full bg-series-blue" />Training the demo model in the background. This page updates automatically when it finishes.</div>
          ) : (
            <EmptyState title={`No trained model loaded (status: ${m.status})`} hint={m.error ?? 'Run scripts/train_model.py on a cleaned CSV, or enable PEAKWATCH_AUTO_TRAIN_DEMO for demo mode. Forecasts use the heuristic estimate until then.'} />
          )}
        </Panel>
      ) : m && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiTile label="Baseline MAE" value={fmtInt(m.baseline_mae)} unit="MW" sub={NAMES[m.baseline_name ?? ''] ?? m.baseline_name} />
            <KpiTile label="Model MAE" value={fmtInt(m.model_mae)} unit="MW" sub={NAMES[m.name ?? ''] ?? m.name} tone="accent" />
            <KpiTile label="Improvement" value={fmtPct(m.improvement_pct, 1)} sub="lower error than baseline" tone="good" />
            <KpiTile label="Band coverage" value={fmtPct(m.interval_coverage_pct, 0)} sub="test hours inside P10–P90 (target 80%)" />
            <KpiTile label="Test period" value={m.test_period ? `${fmtDate(m.test_period.start)} →` : '–'} sub={m.test_period ? fmtDate(m.test_period.end) : '–'} />
            <KpiTile label="Trained on" value={m.data_source === 'demo' ? 'SIMULATED' : 'REAL'} sub={m.trained_at ? `${fmtDateTime(m.trained_at)} · ${m.training_seconds}s` : '–'} badge={<Badge kind={m.data_source === 'demo' ? 'demo' : 'real'} small />} tone={m.data_source === 'demo' ? 'warning' : 'default'} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Baselines vs candidates" subtitle="Chronological split: models compared on validation, the winner scored once on the untouched test period.">
              <MetricsTable baselines={m.baselines ?? {}} candidates={m.candidates ?? {}} selected={m.name ?? ''} />
              {m.rows && <p className="num mt-2 text-[11px] text-ink-3">Rows: train {fmtInt(m.rows.train)} · validation {fmtInt(m.rows.validation)} · test {fmtInt(m.rows.test)}</p>}
            </Panel>
            <Panel title="What drives the prediction" subtitle="Permutation importance on the test set: how much MAE rises when a feature is shuffled. Computed, not assumed.">
              {m.feature_importance?.length ? <ImportanceChart items={m.feature_importance} /> : <EmptyState title="No importance data" />}
            </Panel>
          </div>

          <Panel title="Training data" subtitle={report ? `Source: ${report.source}` : undefined} badges={<Badge kind={m.data_source === 'demo' ? 'demo' : 'real'} small />}>
            {report ? (
              <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4 xl:grid-cols-8">
                <Fact label="Rows (raw → clean)" value={`${fmtInt(report.rows_raw)} → ${fmtInt(report.rows_clean)}`} />
                <Fact label="Coverage" value={`${report.coverage_days} days`} />
                <Fact label="Period" value={report.start && report.end ? `${fmtDate(report.start)} → ${fmtDate(report.end)}` : '–'} />
                <Fact label="Duplicates dropped" value={fmtInt(report.duplicates_dropped)} />
                <Fact label="Gaps interpolated" value={fmtInt(report.gaps_interpolated)} />
                <Fact label="Outliers flagged" value={fmtInt(report.outliers_flagged)} />
                <Fact label="Missing demand" value={fmtPct(report.missing_target_pct)} />
                <Fact label="Optional columns missing" value={report.optional_missing.join(', ') || 'none'} />
                {report.warnings.length > 0 && <div className="col-span-full rounded border border-warning/40 bg-warning/10 p-2 text-warning">{report.warnings.join(' ')}</div>}
              </div>
            ) : <EmptyState title="No dataset report" />}
            {m.feature_columns && <p className="mt-3 text-[11px] text-ink-3">Features: {m.feature_columns.join(', ')}. Lags and rolling means use only values before the target hour.</p>}
          </Panel>
        </>
      )}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-3">{label}</div>
      <div className="num font-semibold text-ink">{value}</div>
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
    <table className="num w-full text-xs">
      <thead className="text-left text-[11px] uppercase tracking-wider text-ink-3">
        <tr><th className="pb-2 font-semibold">Model</th><th className="pb-2 text-right font-semibold">Val MAE</th><th className="pb-2 text-right font-semibold">Test MAE</th><th className="pb-2 text-right font-semibold">Test MAPE</th><th className="pb-2 text-right font-semibold">Peak MAE</th><th className="pb-2 text-right font-semibold">Peak hour ±1 h</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className={`border-t border-line ${r.key === selected ? 'bg-series-blue/10' : ''}`}>
            <td className="py-1.5">
              <span className="font-semibold text-ink">{NAMES[r.key] ?? r.key}</span>
              <span className="ml-2 text-[10px] uppercase text-ink-3">{r.kind}{r.key === selected ? ' · selected' : ''}</span>
            </td>
            <td className="py-1.5 text-right">{fmtInt(r.validation.mae)}</td>
            <td className="py-1.5 text-right">{r.test ? fmtInt(r.test.mae) : '–'}</td>
            <td className="py-1.5 text-right">{r.test ? fmtPct(r.test.mape) : '–'}</td>
            <td className="py-1.5 text-right">{r.test?.daily_peak_mae != null ? fmtInt(r.test.daily_peak_mae) : '–'}</td>
            <td className="py-1.5 text-right">{r.test?.peak_hour_hit_rate != null ? fmtPct(r.test.peak_hour_hit_rate, 0) : '–'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
