from __future__ import annotations

from pathlib import Path

from conflict_sim.config import Config
from conflict_sim.report import build_report, load_ctx


def test_report_builds(
    cfg: Config, fixture_path: Path, artifacts_dir: Path, tmp_path: Path
) -> None:
    """Smoke test on the fixture: every section renders and captions carry real numbers."""
    ctx = load_ctx(cfg, "fixture", artifacts_dir)
    out = tmp_path / "inspect.html"
    stats = build_report(ctx, ctx, out)
    html = out.read_text(encoding="utf-8")
    for heading in (
        "1. Can it find",
        "2. What the model",
        "3. Every past war",
        "4. Do we beat",
        "5. Three worked",
        "6. Run it yourself",
    ):
        assert heading in html
    assert html.count("<svg") >= 5
    assert 0 <= stats["synthetic"]["inside"] <= 11
    assert "uvicorn conflict_sim.api.app:app" in html
