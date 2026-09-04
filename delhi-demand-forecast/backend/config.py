"""Shared constants and settings for the PeakWatch Delhi backend.

Three kinds of things live here:
* physical constants (timezone, coordinates),
* ASSUMPTION parameters (grid capacity, DISCOM shares, alert thresholds) that
  the UI labels as assumptions and that can be overridden per request,
* runtime ``Settings`` read from environment variables / ``.env`` (paths,
  feature flags, timeouts). Nothing secret lives here; Open-Meteo needs no key.

The DEMO_* profiles at the bottom back the heuristic fallback forecaster that
runs when no trained model is available.
"""

from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from pydantic_settings import BaseSettings, SettingsConfigDict

# --- Location / time -------------------------------------------------------
IST = ZoneInfo("Asia/Kolkata")
DELHI_LAT = 28.6139
DELHI_LON = 77.2090

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# --- Grid assumptions (ASSUMPTION provenance; editable via UI / query) ------
# Grid capacity is a PLANNING HEADROOM ASSUMPTION, not a physical or measured limit.
# It is editable in the UI header, overridable per request via ``capacity_mw``, and
# reported on /api/status as ``capacity_basis = "planning_assumption"``.
# Derivation (published record + operating reserve):
#   published record peak demand   8,748 MW  on 2026-06-29
#       Republic World, "Delhi's peak power demand shatters previous record, touches 8,748 MW",
#       https://www.republicworld.com/india/delhi-s-peak-power-demand-shatters-previous-record-touches-8748-mw-2026-06-30-130529
#   x 1.05 operating-reserve margin  9,185 MW  (serve the record peak while keeping ~5 %
#                                              spinning reserve, a common planning norm)
#   rounded to the nearest 100 MW    9,200 MW
#   cross-check: SLDC's pre-summer 2026 projection that peak load "may cross 9,000 MW"
#       ANI / The Tribune, 2026-05-20,
#       https://www.aninews.in/news/business/delhi-clocks-highest-power-demand-of-2026-as-summer-heat-intensifies-peak-load-may-cross-9000-mw20260520185355/
#       https://www.tribuneindia.com/news/delhi-power-demand/delhi-clocks-highest-power-demand-of-2026-as-summer-heat-intensifies-peak-load-may-cross-9000-mw
# Dataset validation: our own 5-minute peak is 8,705 MW at 2026-06-29 15:00 IST, within
# 0.5 % of the published instantaneous record on the same day.
# The value must never sit below demonstrated served demand: the original 8,500 MW did
# (June 2026 hourly-mean peak 8,653 MW), which made the record day read as a breach.
# DataStore.load() warns if loaded history ever exceeds this value.
# Risk thresholds (85 / 92 / 97 %) are unchanged.
GRID_CAPACITY_MW = 9200
# DISCOM share of system demand: a PROPORTIONAL-ALLOCATION ratio, not a measurement.
# Our load history is Delhi system-wide only; no row carries feeder or DISCOM load.
# Derivation from published May 2026 peaks:
#   BRPL  3,762 MW, BYPL 1,838 MW  (Millennium Post, "Power demand scales season high",
#                                   https://www.millenniumpost.in/delhi/power-demand-scales-season-high-660908)
#   TPDDL 2,331 MW                 (same coverage of the May 2026 heatwave)
#   system peak ~8,231 MW          (The Print, https://theprint.in/india/delhis-peak-demand-soars-to-seasons-highest-8231-mw-amid-heatwave/2937867/)
#   BRPL 3762/8231 = 0.457, BYPL 1838/8231 = 0.223, TPDDL 2331/8231 = 0.283 (sum 0.963);
#   residual 300 MW = 0.036 assigned to NDMC and MES at their prior 5:2 ratio (0.026 / 0.011).
# LIMITATION: each figure is that DISCOM's OWN seasonal peak, which is NOT coincident
# with the system peak. Non-coincident peaks over-state a DISCOM's contribution at the
# system peak hour, so the implied shares are upper bounds and the normalised ratios
# are approximate. The set is normalised to sum to 1.0 so allocated area loads add up
# to the system forecast. Real feeder telemetry would replace this table entirely.
DISCOM_SHARE = {
    "BRPL": 0.457,
    "BYPL": 0.223,
    "TPDDL": 0.283,
    "NDMC": 0.026,
    "MES": 0.011,
}

# Simulated headroom of each DISCOM's network over its share of system peak.
# (SIMULATED: real feeder capacities are not public.)
FEEDER_CAPACITY_FACTOR = {"BRPL": 1.12, "BYPL": 1.06, "TPDDL": 1.18, "NDMC": 1.25, "MES": 1.40}
FEEDERS = [
    # id, display name, discom, lat, lon
    ("BRPL-S01", "South & West Delhi (BRPL)", "BRPL", 28.5355, 77.2100),
    ("BYPL-E01", "East & Central Delhi (BYPL)", "BYPL", 28.6280, 77.2950),
    ("TPDDL-N01", "North & North-West Delhi (TPDDL)", "TPDDL", 28.7041, 77.1025),
    ("NDMC-C01", "New Delhi (NDMC)", "NDMC", 28.6139, 77.2090),
    ("MES-W01", "Delhi Cantonment (MES)", "MES", 28.5921, 77.1450),
]

# System risk levels by utilisation of grid capacity (percent). ASSUMPTION.
RISK_THRESHOLDS_PCT = {"medium": 85.0, "high": 92.0, "critical": 97.0}

# Feeder / zone utilisation thresholds (percent of capacity)
UTIL_WARNING_PCT = 85.0
UTIL_CRITICAL_PCT = 95.0

# --- App -------------------------------------------------------------------
DATA_SOURCE = "demo"  # provenance label used when no real dataset is loaded
APP_VERSION = "0.2.0"

# Fixed demo clock used when Settings.fixed_now is unset and tests need determinism.
DEMO_NOW = datetime(2026, 9, 4, 10, 0, 0, tzinfo=IST)


class Settings(BaseSettings):
    """Runtime configuration from environment variables (prefix PEAKWATCH_)."""

    model_config = SettingsConfigDict(env_prefix="PEAKWATCH_", env_file=".env", extra="ignore")

    capacity_mw: float = GRID_CAPACITY_MW
    data_dir: Path = PROJECT_ROOT / "data"
    # Cleaned real dataset (timestamp, demand_mw, weather...). If absent -> DEMO MODE.
    history_csv: Path | None = None
    # Trained-on-real-data artifact. If absent -> demo artifact / heuristic.
    model_path: Path = PROJECT_ROOT / "ml" / "models" / "model.joblib"
    demo_model_path: Path = PROJECT_ROOT / "ml" / "models" / "demo_model.joblib"
    auto_train_demo: bool = True  # train a demo model in the background if none exists
    demo_history_days: int = 730
    weather_enabled: bool = True
    weather_timeout_s: float = 8.0
    weather_cache_ttl_min: int = 180
    # ISO timestamp to freeze "now" (deterministic demos / tests). Empty -> wall clock.
    fixed_now: str | None = None
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    max_horizon_hours: int = 168

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

# Hour-of-day system load profile (MW) for a hot September weekday in Delhi.
# Night trough ~4,000 MW around 04:00, afternoon peak ~7,800 MW at 15:00,
# secondary evening shoulder around 20:00.
DEMO_LOAD_PROFILE_MW = [
    5100.0, 4700.0, 4400.0, 4150.0, 4020.0, 4100.0,   # 00-05
    4350.0, 4800.0, 5250.0, 5600.0, 5880.0, 6120.4,   # 06-11
    6500.0, 6950.0, 7450.0, 7800.0, 7650.0, 7300.0,   # 12-17
    6900.0, 6750.0, 6850.0, 6600.0, 6100.0, 5550.0,   # 18-23
]

# Hour-of-day ambient temperature (degC) and relative humidity (%).
DEMO_TEMP_PROFILE_C = [
    29.5, 29.0, 28.5, 28.0, 27.6, 27.4,
    28.0, 29.5, 31.5, 33.5, 35.5, 37.0,
    38.2, 39.0, 39.6, 39.8, 39.2, 38.0,
    36.5, 34.8, 33.5, 32.4, 31.2, 30.3,
]
DEMO_HUMIDITY_PROFILE = [
    62.0, 64.0, 66.0, 68.0, 69.0, 69.0,
    67.0, 63.0, 58.0, 52.0, 47.0, 43.0,
    41.0, 38.0, 36.0, 35.0, 36.0, 39.0,
    43.0, 47.0, 51.0, 54.0, 57.0, 60.0,
]

# Rooftop-solar output as a fraction of installed capacity, by hour of day.
DEMO_SOLAR_FACTOR = [
    0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
    0.05, 0.22, 0.45, 0.65, 0.80, 0.88,
    0.90, 0.88, 0.78, 0.62, 0.42, 0.20,
    0.04, 0.00, 0.00, 0.00, 0.00, 0.00,
]

# Weather-load relationship used by the what-if and weather-impact endpoints.
SENSITIVITY_MW_PER_DEGC = 215.4
COMFORT_BAND_C = (22.0, 26.0)
