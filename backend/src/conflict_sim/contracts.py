"""Loads the shared contract module from <repo>/contracts without packaging it."""

from __future__ import annotations

import importlib.util
import sys
from types import ModuleType

from conflict_sim.config import REPO_ROOT


def _load() -> ModuleType:
    name = "contracts_input_schema"
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, REPO_ROOT / "contracts" / "input_schema.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


input_schema = _load()
IndicatorsSchema = input_schema.IndicatorsSchema
INDICATORS: dict[str, str] = input_schema.INDICATORS
WB_AGGREGATES: frozenset[str] = input_schema.WB_AGGREGATES

DEATHS, POP, GDP, FDI, POV = (
    "VC.BTL.DETH",
    "SP.POP.TOTL",
    "NY.GDP.PCAP.KD",
    "BX.KLT.DINV.WD.GD.ZS",
    "SI.POV.DDAY",
)
