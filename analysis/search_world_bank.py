"""Audit candidate World Bank indicators without changing existing data files."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import json

import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE = "https://api.worldbank.org/v2"
OUT = Path(__file__).resolve().parent / "world_bank_search"
CODES = [
    "VC.BTL.DETH", "SP.POP.TOTL", "NY.GDP.PCAP.KD", "NY.GDP.PCAP.KD.ZG",
    "NY.GDP.PCAP.PP.KD", "NE.CON.PRVT.PC.KD", "BX.KLT.DINV.WD.GD.ZS",
    "SI.POV.DDAY", "SI.POV.LMIC", "SI.POV.UMIC", "SI.POV.GAPS",
    "SM.POP.REFG.OR", "SM.POP.REFG", "SM.POP.IDPC", "SM.POP.FDIP",
    "VC.IDP.NWCV", "VC.IDP.TOCV", "PV.EST", "SL.UEM.TOTL.ZS", "FP.CPI.TOTL.ZG",
    "SM.POP.RHCR.EO", "SM.POP.RHCR.EA", "SM.POP.RRWA.EO", "SL.EMP.VULN.ZS",
]


def get(path, **params):
    session = requests.Session()
    session.mount("https://", HTTPAdapter(max_retries=Retry(
        total=3, backoff_factor=.5, status_forcelist=[429, 500, 502, 503, 504])))
    rows, page, headers = [], 1, []
    while True:
        response = session.get(f"{BASE}/{path}", params={"format": "json", "per_page": 20000,
                               **params, "page": page}, timeout=45)
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, list) or len(payload) != 2:
            raise ValueError(f"API error: {payload}")
        header, data = payload
        headers.append(header)
        rows.extend(data or [])
        if page >= int(header["pages"]):
            return rows, headers, response.url
        page += 1


def longest_year_run(years):
    best = run = 0
    previous = None
    for year in sorted(set(years)):
        run = run + 1 if previous is not None and year == previous + 1 else 1
        best = max(best, run)
        previous = year
    return best


def audit(code, countries):
    try:
        cached = OUT / "api_responses" / f"{code}.json"
        if cached.exists():
            payload = json.loads(cached.read_text())
            definition, rows, url = payload["definition"], payload["observations"], payload["url"]
        else:
            definitions, _, _ = get(f"indicator/{code}")
            definition = next((r for r in definitions if r["source"]["id"] == "2"), definitions[0])
            source = definition["source"]["id"]
            rows, headers, url = get(f"country/all/indicator/{code}", source=source, date="1960:2025")
            cached.write_text(json.dumps({"definition": definition, "headers": headers,
                "url": url, "observations": rows, "retrieved_at": datetime.now(timezone.utc).isoformat()}))
        source = definition["source"]["id"]
        frame = pd.DataFrame([{"iso3": r["countryiso3code"], "year": int(r["date"]),
                               "value": r["value"]} for r in rows])
        observed = frame.dropna(subset=["value"])
        world = observed[observed.iso3.eq("WLD")]
        national = observed[observed.iso3.isin(countries)]
        count = national.groupby("year").iso3.nunique().rename(code)
        count.to_csv(OUT / "coverage_by_year" / f"{code}.csv")
        world_years = world.year.tolist()
        result = dict(code=code, name=definition["name"], source_id=source,
                      source=definition["source"]["value"],
                      provider=definition["sourceOrganization"],
                      first_year=int(observed.year.min()) if len(observed) else None,
                      last_year=int(observed.year.max()) if len(observed) else None,
                      world_first=int(world.year.min()) if len(world) else None,
                      world_last=int(world.year.max()) if len(world) else None,
                      world_n=len(world), world_longest_run=longest_year_run(world_years),
                      world_gaps=",".join(str(y) for y in range(min(world_years), max(world_years)+1)
                                         if y not in world_years) if world_years else "",
                      countries_ever=national.iso3.nunique(),
                      countries_2000=int(count.get(2000, 0)), countries_2010=int(count.get(2010, 0)),
                      countries_2020=int(count.get(2020, 0)), countries_2024=int(count.get(2024, 0)),
                      country_year_nonnull=len(national), api_url=url, status="ok")
        print(f"{code}: WLD {result['world_first']}–{result['world_last']} ({len(world)}); "
              f"{result['countries_2024']} countries in 2024", flush=True)
        return result
    except Exception as exc:
        print(f"{code}: {exc}", flush=True)
        return {"code": code, "status": "error", "error": str(exc)}


def main():
    for name in ["api_responses", "coverage_by_year"]:
        (OUT / name).mkdir(parents=True, exist_ok=True)
    def catalog_file(filename, endpoint):
        path = OUT / filename
        if path.exists():
            return json.loads(path.read_text())
        rows, _, _ = get(endpoint)
        path.write_text(json.dumps(rows))
        return rows

    countries = catalog_file("countries.json", "country")
    ids = {r["id"] for r in countries if r["region"]["value"] != "Aggregates"}
    catalog = catalog_file("wdi_catalog.json", "source/2/indicator")
    catalog_file("sources.json", "source")
    keywords = ["conflict", "displac", "refugee", "vulnerab", "poverty", "battle"]
    matches = [r for r in catalog if any(k in r["name"].lower() for k in keywords)]
    pd.DataFrame(matches).to_csv(OUT / "catalog_matches.csv", index=False)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda code: audit(code, ids), CODES))
    pd.DataFrame(results).to_csv(OUT / "coverage_audit.csv", index=False)
    (OUT / "retrieval.json").write_text(json.dumps({"retrieved_at": datetime.now(timezone.utc).isoformat(),
        "date_filter": "1960:2025", "indicators": CODES, "wdi_catalog_size": len(catalog)}, indent=2))


if __name__ == "__main__":
    main()
