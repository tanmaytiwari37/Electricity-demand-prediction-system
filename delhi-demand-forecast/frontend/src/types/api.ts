/** Types mirroring the FastAPI responses (backend/services/*). */

export type DataSource = 'demo' | 'real'
export type ForecastMethod = 'ml_model' | 'heuristic'
export type WeatherSource = 'live' | 'cache' | 'demo' | 'historical_analog'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type FeederStatus = 'ok' | 'warning' | 'critical'

export interface Health {
  status: string
  model_loaded: boolean
  model_status: string
  data_source: DataSource
  weather_source: WeatherSource
  version: string
}

export interface ForecastPoint {
  ts: string
  predicted_mw: number
  lower_mw: number
  upper_mw: number
  temp_c: number | null
  humidity: number | null
}

export interface ForecastResponse {
  generated_at: string
  horizon_hours: number
  data_source: DataSource
  grid_capacity_mw: number
  forecast_method: ForecastMethod
  model_name: string | null
  model_data_source: string | null
  weather_source: WeatherSource
  interval_label: string
  peak: { ts: string; predicted_mw: number }
  points: ForecastPoint[]
}

export interface ActualPoint {
  ts: string
  actual_mw: number
  predicted_mw: number | null
  temp_c: number | null
}

export interface ActualResponse {
  data_source: DataSource
  prediction_method: string
  as_of: string
  points: ActualPoint[]
}

export interface Alert {
  id: string
  level: RiskLevel
  ts: string
  window_start: string
  window_end: string
  predicted_mw: number
  capacity_mw: number
  headroom_mw: number
  headroom_pct: number
  title: string
  message: string
  recommended_action: string
  advisory: string
}

export interface AlertsResponse {
  generated_at: string
  grid_capacity_mw: number
  horizon_hours: number
  data_source: DataSource
  risk_level: RiskLevel
  peak_ts: string
  peak_mw: number
  peak_utilization_pct: number
  headroom_mw: number
  headroom_pct: number
  hours_at_risk: number
  thresholds_pct: { medium: number; high: number; critical: number }
  forecast_method: ForecastMethod
  alerts: Alert[]
}

export interface Feeder {
  id: string
  name: string
  discom: string
  predicted_mw: number
  capacity_mw: number
  utilization_pct: number
  status: FeederStatus
  share_pct: number
  lat: number
  lon: number
}

export interface FeederHour {
  ts: string
  system_mw: number
  utilization_pct: Record<string, number>
}

export interface FeedersResponse {
  as_of: string
  basis: 'forecast' | 'actual' | 'forecast_peak'
  data_source: DataSource
  allocation: string
  forecast_method: ForecastMethod
  system_mw: number
  feeders: Feeder[]
  hourly: FeederHour[]
}

export interface WeatherImpactResponse {
  correlation_temp_load: number | null
  sensitivity_mw_per_degc: number | null
  comfort_band_c: [number, number]
  data_source: DataSource
  n_hours: number
  period?: { start: string; end: string }
  method?: string
  note?: string
  scatter: { temp_c: number; avg_load_mw: number; n_hours: number }[]
}

export interface WhatIfRequest {
  temp_delta_c: number
  rooftop_solar_mw: number
  horizon: number
  capacity_mw?: number
}

export interface WhatIfPoint {
  ts: string
  baseline_mw: number
  scenario_mw: number
  solar_gen_mw: number
  temp_effect_mw: number
}

export interface WhatIfResponse {
  baseline_peak_mw: number
  scenario_peak_mw: number
  net_delta_mw: number
  capacity_breach: boolean
  grid_capacity_mw: number
  baseline_peak_ts: string
  scenario_peak_ts: string
  temp_effect_at_peak_mw: number
  solar_at_peak_mw: number
  solar_peak_gen_mw: number
  energy_delta_mwh: number
  inputs: { temp_delta_c: number; rooftop_solar_mw: number; horizon: number }
  forecast_method: ForecastMethod
  data_source: DataSource
  points: WhatIfPoint[]
}

export interface MetricSet {
  mae: number
  rmse: number
  mape: number
  daily_peak_mae?: number
  peak_hour_hit_rate?: number
}

export interface FeatureImportance {
  feature: string
  label: string
  importance_mae: number
  std: number
}

export interface DatasetReport {
  source: string
  rows_raw: number
  rows_clean: number
  start: string | null
  end: string | null
  coverage_days: number
  columns_present: string[]
  optional_missing: string[]
  duplicates_dropped: number
  gaps_interpolated: number
  gaps_unfilled: number
  outliers_flagged: number
  missing_target_pct: number
  warnings: string[]
}

export interface ModelCard {
  status: 'absent' | 'loading' | 'training' | 'loaded' | 'failed'
  loaded: boolean
  error?: string | null
  name?: string
  data_source?: string
  trained_at?: string
  training_seconds?: number
  history_start?: string
  history_end?: string
  n_rows?: number
  feature_columns?: string[]
  baseline_name?: string
  baseline_mae?: number
  model_mae?: number
  improvement_pct?: number
  interval_coverage_pct?: number
  test_period?: { start: string; end: string }
  rows?: { train: number; validation: number; test: number }
  baselines?: Record<string, { validation: MetricSet; test?: MetricSet }>
  candidates?: Record<string, { validation: MetricSet; test?: MetricSet }>
  feature_importance?: FeatureImportance[]
  residual_quantiles?: { p10: number; p50: number; p90: number; std: number }
  dataset_report?: DatasetReport | null
}

export interface StatusResponse {
  version: string
  now: string
  as_of: string
  loaded_at: string | null
  demo_mode: boolean
  data_source: DataSource
  history: { source: DataSource; label: string; start: string; end: string; rows: number; report: DatasetReport | null }
  weather: { source: WeatherSource; label: string; fetched_at: string | null; error: string | null }
  forecast: { method: ForecastMethod; label: string }
  model: ModelCard
  assumptions: {
    grid_capacity_mw: number
    capacity_basis?: string
    risk_thresholds_pct: { medium: number; high: number; critical: number }
    discom_share: Record<string, number>
  }
}
