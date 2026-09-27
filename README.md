# CDC26
Carolina Data Challenge 2026

## Modeling engine (`backend/`)

Estimates how armed conflict is associated with GDP per capita, FDI inflows and poverty,
and serves a Monte Carlo scenario simulator over HTTP. Estimates are **associational**
(two-way fixed-effects local projections), not causal effects.

```
cd backend
python -m venv .venv && .venv/Scripts/python -m pip install -e ".[dev]"   # or: make install
.venv/Scripts/python -m conflict_sim.estimation     # make estimate  (rebuilds artifacts/, ~5 min)
.venv/Scripts/python -m pytest -q                   # make test
.venv/Scripts/python -m uvicorn conflict_sim.api.app:app --port 8000   # make serve
```

### Contract 1: ingestion -> engine (`contracts/input_schema.py`)

One long-format Parquet file, `data/indicators.parquet`, validated with pandera on load:

| column | type | notes |
|---|---|---|
| `iso3` | str | ISO3 country code. Countries only: no WB aggregates (WLD, SSF, HIC, ...) |
| `year` | int | calendar year |
| `indicator` | str | `VC.BTL.DETH`, `SP.POP.TOTL`, `NY.GDP.PCAP.KD`, `BX.KLT.DINV.WD.GD.ZS`, `SI.POV.DDAY` |
| `value` | float, nullable | null = not reported |

- One row per `(iso3, year, indicator)`; duplicates are rejected.
- Null battle deaths are read as 0 from the first year the series has data (1989).
- Optional `data/countries.parquet` (`iso3, name, region, income_level`, from `/v2/country`)
  gives display names; without it, names fall back to iso3 codes.
- Until the real file exists, the engine uses `backend/dev_cache/` (a dev-only World Bank pull
  via `scripts/fetch_wb_dev.py`, gitignored) or the synthetic fixture in `backend/tests/fixtures/`.

### Contract 2: engine -> frontend (`contracts/api/`)

`openapi.json` plus example responses in `examples/` to mock against. Every response is
`{data, coverage, warnings, meta}`:
- `coverage`: per indicator code: `n_obs`, `first_year`, `last_year`, `share` (0-1).
- `warnings`: `[{code, message, severity}]`, e.g. `PRETREND_SIGNIFICANT`, `SHORT_GDP_HISTORY`,
  `NO_POVERTY_DATA`, `INTENSITY_OUT_OF_SAMPLE`, `SYNTHETIC_ESTIMATES`.
- `meta`: data source and artifact build time.

| endpoint | returns |
|---|---|
| `GET /countries` | iso3, name, region, per-indicator coverage |
| `GET /history/{iso3}` | yearly battle deaths, conflict/onset flags, GDP pc, FDI, poverty, population |
| `POST /simulate` | p5/p25/p50/p75/p95 bands per year for baseline, scenario and gap, plus headline numbers at the final year |
| `GET /diagnostics/{gdp\|fdi}?measure=continuous\|onset` | beta_h path with CIs; pre-trend leads (h=-3..-1) reported separately |

`POST /simulate` body: `{iso3, onset_year, duration_years, intensity_per_100k, horizon<=10, n_sims, seed}`.
Same `seed` gives identical output. CORS allows the Vite dev server (`localhost:5173`).
Regenerate the contract with `python scripts/export_contracts.py`; a test fails if
`openapi.json` drifts from the code.

## Data handling

ACLED raw files in `data/Conflict/` are kept local only (git-ignored) because ACLED's terms restrict
redistribution. They were committed once in `c088667` and remain in this private repo's history.

Before making this repo public, purge data/Conflict/ from history (git filter-repo).

## Rebuilding the site data

Run from `backend/` after any data or model change; the map, country panels and every findings
section update with no frontend changes:

```
.venv\Scripts\python -m conflict_sim.estimation     # model estimates (~10 min)
.venv\Scripts\python -m conflict_sim.heterogeneity  # leave-one-war-out + pre-registered test (cached)
.venv\Scripts\python -m conflict_sim.metrics        # map metrics (needs local ACLED files)
.venv\Scripts\python -m conflict_sim.findings       # findings page text and charts
```

`map_metrics.json`, `findings.json` and `artifacts/lowo/` contain ACLED-derived numbers and are
git-ignored; rebuild them locally. See `backend/PREREGISTRATION.md` for the heterogeneity test.
