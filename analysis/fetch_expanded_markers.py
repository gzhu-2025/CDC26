"""Country/world API data for an expanded, fixed non-conflict outcome list."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import json
import pandas as pd
from fetch_social_health import MARKERS
from search_world_bank import get

OUT = Path(__file__).resolve().parent / "expanded_analysis"
ADDED = [
    ("Healthcare", "SH.TBS.INCD", "Tuberculosis incidence", "log"),
    ("Healthcare", "SN.ITK.DEFC.ZS", "Undernourishment", "difference"),
    ("Healthcare", "SH.DYN.AIDS.ZS", "HIV prevalence", "difference"),
    ("Healthcare", "SH.MED.PHYS.ZS", "Physicians per 1,000 people", "difference"),
    ("Healthcare", "SH.STA.BRTC.ZS", "Skilled birth attendance", "difference"),
    ("Social", "SE.XPD.TOTL.GD.ZS", "Education spending / GDP", "difference"),
    ("Social", "SE.PRM.UNER.ZS", "Primary-age children out of school", "difference"),
    ("Social", "SI.POV.GINI", "Income inequality (Gini)", "difference"),
    ("Economic", "SL.UEM.1524.ZS", "Youth unemployment", "difference"),
    ("Economic", "SL.TLF.CACT.FE.ZS", "Female labor force participation", "difference"),
    ("Economic", "NV.AGR.TOTL.ZS", "Agriculture share of GDP", "difference"),
    ("Economic", "NY.GNP.PCAP.KD", "Real GNI per capita", "log"),
]
ALL_MARKERS = MARKERS + ADDED


def fetch(code):
    dest = OUT / "raw" / f"{code}.json"
    if dest.exists():
        return
    old = OUT.parent / "world_bank_search" / "api_responses" / f"{code}.json"
    if old.exists():
        payload = json.loads(old.read_text())
    else:
        rows, headers, url = get(f"country/all/indicator/{code}", source=2, date="1995:2025")
        payload = {"observations": rows, "headers": headers, "url": url,
                   "retrieved_at": datetime.now(timezone.utc).isoformat()}
    dest.write_text(json.dumps(payload))
    count = sum(r['value'] is not None for r in payload['observations'])
    print(f"{code}: {count} non-null country/aggregate observations", flush=True)


def main():
    (OUT / "raw").mkdir(parents=True, exist_ok=True)
    pd.DataFrame(ALL_MARKERS, columns=["category", "code", "label", "transform"]).to_csv(
        OUT / "prespecified_markers.csv", index=False)
    catalog = json.loads((OUT.parent / "world_bank_search" / "wdi_catalog.json").read_text())
    codes = {m[1] for m in ALL_MARKERS} | {"SP.POP.TOTL"}
    assert codes <= {r['id'] for r in catalog}
    (OUT / "definitions.json").write_text(json.dumps([r for r in catalog if r['id'] in codes]))
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(fetch, sorted(codes)))


if __name__ == "__main__":
    main()
