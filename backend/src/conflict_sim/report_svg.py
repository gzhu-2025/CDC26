"""Tiny dependency-free SVG charts for the inspection report.

Colors are CSS variables defined in the report page (light and dark themes), so charts
follow the viewer's theme. Every data point carries a <title> so hovering shows its value.
"""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from html import escape

Fmt = Callable[[float], str]
Num = float | None


def nice_ticks(lo: float, hi: float, count: int = 4) -> list[float]:
    if not (math.isfinite(lo) and math.isfinite(hi)):
        return [0.0, 1.0]
    if lo == hi:
        pad = abs(lo) * 0.1 or 1.0
        lo, hi = lo - pad, hi + pad
    raw = (hi - lo) / count
    mag = 10 ** math.floor(math.log10(raw))
    step = next(m * mag for m in (1, 2, 2.5, 5, 10) if m * mag >= raw)
    start = math.floor(lo / step) * step
    ticks = []
    v = start
    while v <= hi + step * 0.5:
        ticks.append(round(v, 10))
        v += step
    if ticks[-1] < hi:
        ticks.append(ticks[-1] + step)
    return ticks


@dataclass
class Line:
    values: Sequence[Num]
    color: str  # CSS var, e.g. "var(--s1)"
    label: str
    width: float = 2.0
    dots: bool = False
    span_gaps: bool = False


@dataclass
class Band:
    lo: Sequence[Num]
    hi: Sequence[Num]
    color: str
    opacity: float = 0.16


@dataclass
class Chart:
    x: Sequence[int]
    lines: list[Line] = field(default_factory=list)
    bands: list[Band] = field(default_factory=list)
    shade: tuple[float, float] | None = None  # x-range to shade (e.g. war years)
    shade_label: str = ""
    before_zone: tuple[float, float] | None = None  # x-range drawn as "before" zone
    vline: float | None = None
    yfmt: Fmt = lambda v: f"{v:g}"
    zero_line: bool = False
    width: int = 640
    height: int = 240
    xlabel_every: int = 5
    aria: str = ""
    badge: str = ""  # small text in the top-right corner
    badge_class: str = ""

    def svg(self) -> str:
        W, H = self.width, self.height
        m = {"t": 18 if (self.shade_label or self.badge) else 10, "r": 12, "b": 24, "l": 58}
        iw, ih = W - m["l"] - m["r"], H - m["t"] - m["b"]
        x0, x1 = self.x[0], self.x[-1]

        def sx(v: float) -> float:
            return m["l"] + (v - x0) / max(1, x1 - x0) * iw

        vals = [v for ln in self.lines for v in ln.values if v is not None]
        vals += [v for b in self.bands for v in (*b.lo, *b.hi) if v is not None]
        lo, hi = (min(vals), max(vals)) if vals else (0.0, 1.0)
        if self.zero_line:
            lo, hi = min(lo, 0.0), max(hi, 0.0)
        ticks = nice_ticks(lo, hi)
        y0, y1 = ticks[0], ticks[-1]

        def sy(v: float) -> float:
            return m["t"] + ih - (v - y0) / ((y1 - y0) or 1) * ih

        out = [
            f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="{escape(self.aria)}" '
            f'class="chart" preserveAspectRatio="xMidYMid meet">'
        ]
        for zone, cls in ((self.before_zone, "zone-before"), (self.shade, "zone-war")):
            if zone:
                a, b = sx(max(x0, zone[0] - 0.5)), sx(min(x1, zone[1] + 0.5))
                out.append(
                    f'<rect class="{cls}" x="{a:.1f}" y="{m["t"]}" width="{max(0, b - a):.1f}" '
                    f'height="{ih}" rx="3"/>'
                )
                if cls == "zone-war" and self.shade_label:
                    out.append(
                        f'<text class="zone-label" x="{(a + b) / 2:.1f}" y="{m["t"] - 5}" '
                        f'text-anchor="middle">{escape(self.shade_label)}</text>'
                    )
        for t in ticks:
            cls = "axis" if t == 0 else "grid"
            out.append(
                f'<line class="{cls}" x1="{m["l"]}" x2="{m["l"] + iw}" y1="{sy(t):.1f}" y2="{sy(t):.1f}"/>'
            )
            out.append(
                f'<text class="tick" x="{m["l"] - 7}" y="{sy(t):.1f}" dy="0.32em" '
                f'text-anchor="end">{escape(self.yfmt(t))}</text>'
            )
        for xv in self.x:
            regular = xv % self.xlabel_every == 0
            # label the ends of short axes too, unless a regular label sits right next to them
            end = (
                xv in (x0, x1)
                and (x1 - x0) <= 14
                and min(xv % self.xlabel_every, -xv % self.xlabel_every) >= 2
            )
            if regular or end:
                out.append(
                    f'<text class="tick" x="{sx(xv):.1f}" y="{H - 7}" text-anchor="middle">{xv}</text>'
                )
        if self.vline is not None:
            vx = sx(self.vline)
            out.append(
                f'<line class="vline" x1="{vx:.1f}" x2="{vx:.1f}" y1="{m["t"]}" y2="{m["t"] + ih}"/>'
            )

        for b in self.bands:
            pts = [
                (xv, a, c)
                for xv, a, c in zip(self.x, b.lo, b.hi, strict=True)
                if a is not None and c is not None
            ]
            if pts:
                top = " ".join(f"{sx(xv):.1f},{sy(c):.1f}" for xv, _, c in pts)
                bot = " ".join(f"{sx(xv):.1f},{sy(a):.1f}" for xv, a, _ in reversed(pts))
                out.append(
                    f'<polygon points="{top} {bot}" style="fill:{b.color};opacity:{b.opacity}"/>'
                )

        for ln in self.lines:
            pts = list(zip(self.x, ln.values, strict=True))
            runs: list[list[tuple[int, float]]] = [[]]
            for xv, v in pts:
                if v is None:
                    if not ln.span_gaps:
                        runs.append([])
                else:
                    runs[-1].append((xv, v))
            for r in runs:
                if len(r) > 1:
                    d = " ".join(f"{sx(xv):.1f},{sy(v):.1f}" for xv, v in r)
                    out.append(
                        f'<polyline points="{d}" class="line" '
                        f'style="stroke:{ln.color};stroke-width:{ln.width}"/>'
                    )
            for xv, v in pts:
                if v is None:
                    continue
                r = 3.5 if ln.dots else 6
                cls = "dot" if ln.dots else "hit"
                out.append(
                    f'<circle class="{cls}" cx="{sx(xv):.1f}" cy="{sy(v):.1f}" r="{r}" '
                    f'style="fill:{ln.color}"><title>{xv} · {escape(ln.label)}: '
                    f"{escape(self.yfmt(v))}</title></circle>"
                )
        if self.badge:
            out.append(
                f'<text class="badge {self.badge_class}" x="{W - m["r"]}" y="12" '
                f'text-anchor="end">{escape(self.badge)}</text>'
            )
        out.append("</svg>")
        return "".join(out)


@dataclass
class HBar:
    label: str
    value: float
    positive_class: str = "bar-good"
    negative_class: str = "bar-bad"
    note: str = ""


def hbar_chart(bars: list[HBar], fmt: Fmt, width: int = 640, row: int = 22) -> str:
    """Horizontal diverging bars around zero, one row per item."""
    label_w, value_w = 190, 64
    iw = width - label_w - value_w
    vmax = max((abs(b.value) for b in bars), default=1.0) or 1.0
    zero = label_w + iw / 2
    H = row * len(bars) + 8
    out = [f'<svg viewBox="0 0 {width} {H}" class="chart" role="img" aria-label="scorecard">']
    out.append(f'<line class="axis" x1="{zero:.1f}" x2="{zero:.1f}" y1="0" y2="{H}"/>')
    for i, b in enumerate(bars):
        y = 4 + i * row
        w = abs(b.value) / vmax * (iw / 2 - 4)
        x = zero if b.value >= 0 else zero - w
        cls = b.positive_class if b.value >= 0 else b.negative_class
        out.append(
            f'<text class="bar-label" x="{label_w - 8}" y="{y + row / 2:.1f}" dy="0.32em" '
            f'text-anchor="end">{escape(b.label)}</text>'
        )
        out.append(
            f'<rect class="{cls}" x="{x:.1f}" y="{y + 4}" width="{max(w, 1):.1f}" '
            f'height="{row - 8}" rx="3"><title>{escape(b.label)}: {escape(fmt(b.value))}'
            f"{escape(b.note)}</title></rect>"
        )
        out.append(
            f'<text class="bar-value" x="{width - 4}" y="{y + row / 2:.1f}" dy="0.32em" '
            f'text-anchor="end">{escape(fmt(b.value))}</text>'
        )
    out.append("</svg>")
    return "".join(out)


def legend(items: list[tuple[str, str, str]]) -> str:
    """items: (label, css color, kind: line|band)."""
    parts = [
        f'<span class="lg"><span class="key {kind}" style="background:{color}"></span>'
        f"{escape(label)}</span>"
        for label, color, kind in items
    ]
    return f'<div class="legend">{"".join(parts)}</div>'
