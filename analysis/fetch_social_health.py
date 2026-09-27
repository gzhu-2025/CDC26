"""Fetch prespecified non-conflict outcomes; preserve original data/ inputs."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import json
import sys
import zipfile

import requests

import pandas as pd
from search_world_bank import get

OUT = Path(__file__).resolve().parent / "social_health"
MARKERS = [
    ("Economic", "NY.GDP.PCAP.KD", "Real GDP per capita", "log"),
    ("Economic", "NE.CON.PRVT.PC.KD", "Real consumption per capita", "log"),
    ("Economic", "SL.UEM.TOTL.ZS", "Unemployment", "difference"),
    ("Economic", "FP.CPI.TOTL.ZG", "Inflation", "difference"),
    ("Economic", "BX.KLT.DINV.WD.GD.ZS", "FDI inflows / GDP", "difference"),
    ("Economic", "NE.TRD.GNFS.ZS", "Trade / GDP", "difference"),
    ("Economic", "NE.GDI.TOTL.ZS", "Capital formation / GDP", "difference"),
    ("Economic", "SL.EMP.VULN.ZS", "Vulnerable employment", "difference"),
    ("Social", "SE.PRM.CMPT.ZS", "Primary school completion", "difference"),
    ("Social", "SE.SEC.ENRR", "Secondary school enrollment", "difference"),
    ("Social", "EG.ELC.ACCS.ZS", "Electricity access", "difference"),
    ("Social", "SH.H2O.BASW.ZS", "Basic drinking water access", "difference"),
    ("Social", "SH.STA.BASS.ZS", "Basic sanitation access", "difference"),
    ("Social", "IT.NET.USER.ZS", "Internet use", "difference"),
    ("Social", "SI.POV.DDAY", "Extreme poverty", "difference"),
    ("Social", "SE.ADT.LITR.ZS", "Adult literacy", "difference"),
    ("Healthcare", "SP.DYN.LE00.IN", "Life expectancy", "difference"),
    ("Healthcare", "SP.DYN.IMRT.IN", "Infant mortality", "log"),
    ("Healthcare", "SH.DYN.MORT", "Under-five mortality", "log"),
    ("Healthcare", "SH.STA.MMRT", "Maternal mortality", "log"),
    ("Healthcare", "SH.IMM.IDPT", "DPT immunization", "difference"),
    ("Healthcare", "SH.IMM.MEAS", "Measles immunization", "difference"),
    ("Healthcare", "SH.XPD.CHEX.GD.ZS", "Health spending / GDP", "difference"),
    ("Healthcare", "SH.XPD.OOPC.CH.ZS", "Out-of-pocket health spending", "difference"),
]


def fetch(marker):
    category, code, label, transform = marker
    path = OUT / "raw" / f"{code}.json"
    if path.exists():
        return
    old = OUT.parent / "world_bank_search" / "api_responses" / f"{code}.json"
    if old.exists():
        cached = json.loads(old.read_text())
        rows = [r for r in cached["observations"] if r["countryiso3code"] == "WLD"]
        provenance = {"cached_from": str(old), "upstream_url": cached["url"]}
    else:
        rows, headers, url = get(f"country/WLD/indicator/{code}", source=2, date="1960:2025")
        provenance = {"url": url, "headers": headers}
    path.write_text(json.dumps({"code": code, "category": category, "label": label,
        "transform": transform, "observations": rows, "provenance": provenance,
        "cached_at": datetime.now(timezone.utc).isoformat()}))
    print(f"{code}: {sum(r['value'] is not None for r in rows)} world observations", flush=True)


def main():
    (OUT / "raw").mkdir(parents=True, exist_ok=True)
    catalog = json.loads((OUT.parent / "world_bank_search" / "wdi_catalog.json").read_text())
    codes = {m[1] for m in MARKERS}
    (OUT / "definitions.json").write_text(json.dumps([r for r in catalog if r["id"] in codes]))
    pd.DataFrame(MARKERS, columns=["category", "code", "label", "transform"]).to_csv(
        OUT / "prespecified_markers.csv", index=False)
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(fetch, MARKERS))
    if "--ucdp" in sys.argv:
        path = OUT / "raw" / "organizedviolencecy-261-csv.zip"
        url = "https://ucdp.uu.se/downloads/organizedviolencecy/organizedviolencecy-261-csv.zip"
        if not path.exists():
            response = requests.get(url, timeout=45)
            response.raise_for_status()
            path.write_bytes(response.content)
        with zipfile.ZipFile(path) as archive:
            names = [n for n in archive.namelist() if n.endswith('.csv') and not n.startswith('__MACOSX')]
            assert len(names) == 1, names
            frame = pd.read_csv(archive.open(names[0]))
        frame.to_csv(OUT / "raw" / "ucdp_country_year.csv", index=False)
        print(f"UCDP: {frame.shape}; columns: {frame.columns.tolist()}", flush=True)


if __name__ == "__main__":
    main()
