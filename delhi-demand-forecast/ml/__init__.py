"""PeakWatch Delhi - machine-learning package.

Layout
------
schema.py            canonical column names, aliases, required/optional columns
calendar.py          Indian public holidays (Delhi) helper
demo_data.py         deterministic synthetic history + weather (SIMULATED data)
data/loader.py       CSV loading, validation, cleaning, hourly regularisation
features.py          leakage-safe feature engineering
baseline.py          naive baselines (same hour previous day / week)
evaluation/metrics.py MAE / RMSE / MAPE / daily-peak metrics
training/train.py    time-ordered split, candidate models, selection, artifact
inference/predictor.py recursive multi-step forecaster with empirical bands
"""
