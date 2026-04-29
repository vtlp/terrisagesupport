"""Heuristic field extractors. These are intentionally simple regex/keyword rules
that work on the joined text of all pages. Extend freely — the orchestrator
doesn't care how richer this gets, only the return shape matters.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple


def _join(pages: List[Dict[str, Any]]) -> str:
    return "\n\n".join(p.get("text") or "" for p in pages)


# --------- Project-level fields ---------

RERA_RE = re.compile(r"\b(P\d{2,}[A-Z0-9/]{4,})\b")
WEBSITE_RE = re.compile(r"https?://[A-Za-z0-9./_\-]+")
SITE_AREA_RE = re.compile(r"site\s*area[^\d]{0,12}([\d.]+)\s*(acres?|sq\.?\s*ft|sq\.?\s*m|sq\.?\s*yd)", re.I)
OPEN_SPACE_RE = re.compile(r"open\s*space[^\d]{0,8}(\d{1,3})\s*%", re.I)
TOTAL_UNITS_RE = re.compile(r"(?:total|no\.?\s*of)\s*(?:units|flats|villas|plots)[^\d]{0,8}([\d,]{2,6})", re.I)
COMPLETION_RE = re.compile(r"(?:completion|possession)[^\n]{0,40}?(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4})", re.I)
ROAD_WIDTH_RE = re.compile(r"(\d{2,3})\s*ft[^\n]{0,20}(?:approach|main|road)", re.I)

CITY_HINTS = [
    "Hyderabad","Bengaluru","Bangalore","Mumbai","Pune","Chennai","Delhi","Gurugram",
    "Noida","Kolkata","Ahmedabad","Jaipur","Lucknow","Kochi","Visakhapatnam","Vijayawada",
]

AMENITIES_KEYWORDS = [
    "Swimming pool","Clubhouse","Gym","Yoga","Children's play","Children play","Jogging track",
    "Tennis","Badminton","Basketball","Cricket","Multipurpose hall","Banquet","Library",
    "Spa","Sauna","Amphitheatre","Mini theatre","Home theatre","Co-working","Pet park",
    "Skating","Cycling","Reflexology","Meditation","BBQ","Senior citizens","Visitor parking",
    "Power backup","STP","Rainwater harvesting","Solar","CCTV","24x7 security","Cafeteria",
]


def extract_project_fields(pages: List[Dict[str, Any]]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    text = _join(pages)
    warnings: List[Dict[str, Any]] = []
    data: Dict[str, Any] = {}

    if m := RERA_RE.search(text):
        data["rera_id"] = m.group(1)
    if m := WEBSITE_RE.search(text):
        data["website"] = m.group(0).rstrip(".,;)")
    if m := SITE_AREA_RE.search(text):
        data["site_area"] = m.group(1)
        data["site_area_unit"] = m.group(2).lower().replace(".", "").replace(" ", "")
    if m := OPEN_SPACE_RE.search(text):
        data["open_space_pct"] = int(m.group(1))
    if m := TOTAL_UNITS_RE.search(text):
        try:
            data["total_units"] = int(m.group(1).replace(",", ""))
        except ValueError:
            pass
    if m := COMPLETION_RE.search(text):
        data["expected_completion_date"] = m.group(1)
    if m := ROAD_WIDTH_RE.search(text):
        data["approach_road_width"] = f"{m.group(1)} ft"

    # Project name = first non-empty line of the first page, capped to 80 chars
    if pages:
        first_lines = [ln.strip() for ln in (pages[0].get("text") or "").splitlines() if ln.strip()]
        if first_lines:
            data["project_name"] = first_lines[0][:80]

    # City: pick the first hint we see
    for city in CITY_HINTS:
        if re.search(rf"\b{re.escape(city)}\b", text, re.I):
            data["city"] = city
            break

    # Amenities (de-dup, preserve canonical casing)
    amenities = []
    seen = set()
    for kw in AMENITIES_KEYWORDS:
        if re.search(rf"\b{re.escape(kw)}\b", text, re.I) and kw.lower() not in seen:
            amenities.append(kw)
            seen.add(kw.lower())
    data["amenities_detected"] = amenities  # consumed by normalize.py

    # Confidence warnings for missing critical fields
    for critical in ("project_name", "city", "rera_id"):
        if critical not in data:
            warnings.append({
                "entity_type": "project",
                "field_name": critical,
                "reason": "not detected in source text",
                "confidence": 0.0,
                "requires_review": True,
            })

    return data, warnings


# --------- Configurations ---------

BHK_RE = re.compile(r"(\d)\s*BHK", re.I)
AREA_RE = re.compile(r"(\d{3,5})\s*sq\.?\s*ft", re.I)
PLOT_AREA_RE = re.compile(r"(\d{2,4})\s*sq\.?\s*yd", re.I)


def extract_configurations(
    pages: List[Dict[str, Any]], *, property_type: str
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    text = _join(pages)
    warnings: List[Dict[str, Any]] = []

    if property_type == "PLOT":
        plot_sizes = sorted({int(m.group(1)) for m in PLOT_AREA_RE.finditer(text)})
        if not plot_sizes:
            warnings.append({"entity_type": "configuration", "field_name": "plot_area", "reason": "no plot sizes detected", "requires_review": True})
        return (
            [
                {"name": f"{sz} sq.yd", "plot_area": str(sz), "plot_size_band": _band(sz), "units_planned": None}
                for sz in plot_sizes
            ],
            warnings,
        )

    bhks = sorted({int(m.group(1)) for m in BHK_RE.finditer(text) if 1 <= int(m.group(1)) <= 6})
    areas = sorted({int(m.group(1)) for m in AREA_RE.finditer(text)})
    configs: List[Dict[str, Any]] = []
    for bhk in bhks:
        # naive pairing: smallest area for smallest BHK, etc.
        area = areas[bhks.index(bhk)] if bhks.index(bhk) < len(areas) else None
        configs.append({
            "name": f"{bhk} BHK" + (" Villa" if property_type == "VILLA" else ""),
            "bhk": bhk,
            "carpet_area": str(area) if area else None,
            "facing": None,
            "units_planned": None,
        })
    if not configs:
        warnings.append({"entity_type": "configuration", "field_name": "bhk", "reason": "no BHK configurations detected", "requires_review": True})
    return configs, warnings


def _band(area: int) -> str:
    if area < 180:
        return "120-180"
    if area < 240:
        return "180-240"
    if area < 360:
        return "240-360"
    return "360+"
