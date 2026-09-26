# Run from backend/. On Windows without make, use the commands in each recipe directly.
ifeq ($(OS),Windows_NT)
PY ?= .venv/Scripts/python
else
PY ?= .venv/bin/python
endif

.PHONY: install fixture estimate estimate-fixture contracts test lint serve fetch-dev

install:
	python -m venv .venv
	$(PY) -m pip install -e ".[dev]"

fetch-dev:            ## dev-only WB pull -> dev_cache/ (real data comes from the ingestion pipeline)
	$(PY) scripts/fetch_wb_dev.py

fixture:              ## regenerate tests/fixtures/indicators_sample.parquet + truth.json
	$(PY) -m conflict_sim.fixtures

estimate:             ## rebuild artifacts/ (LP + 1000-draw cluster bootstrap)
	$(PY) -m conflict_sim.estimation

estimate-fixture:
	$(PY) -m conflict_sim.estimation --source fixture

contracts:            ## regenerate contracts/api/openapi.json + examples
	$(PY) scripts/export_contracts.py

test:
	$(PY) -m pytest -q

lint:
	$(PY) -m ruff check src tests scripts
	$(PY) -m ruff format --check src tests scripts

serve:
	$(PY) -m uvicorn conflict_sim.api.app:app --reload --port 8000
