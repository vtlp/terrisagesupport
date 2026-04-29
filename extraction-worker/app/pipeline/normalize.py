"""Assemble the final normalized payload that the Support Console expects.

This is the single source of truth for the response contract. If you change a
field name here, update extraction-callback in Lovable to match.
"""
from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List


def assemble_payload(
    *,
    job_id: str,
    property_type: str,
    project_data: Dict[str, Any],
    configurations: List[Dict[str, Any]],
    floor_plans: List[Dict[str, Any]],
    pages: List[Dict[str, Any]],
    warnings: List[Dict[str, Any]],
) -> Dict[str, Any]:
    amenities = project_data.pop("amenities_detected", []) or []

    media_assets: List[Dict[str, Any]] = []
    documents: List[Dict[str, Any]] = []
    for p in pages:
        ft = (p.get("file_type") or "OTHER").upper()
        if ft == "IMAGE":
            media_assets.append({
                "category": "GALLERY",
                "caption": p.get("file_name"),
                "source_file_id": p.get("file_id"),
            })
        elif ft == "ADDITIONAL_DOCUMENT":
            documents.append({
                "caption": p.get("file_name"),
                "source_file_id": p.get("file_id"),
            })

    # Floor plans contribute media too
    for fp in floor_plans:
        media_assets.append({
            "category": "FLOOR_PLAN",
            "caption": fp.get("preview_caption"),
            "source_file_id": fp.get("source_file_id"),
            "config_index": fp.get("config_index"),
            "confidence": fp.get("confidence"),
            "local_path": fp.get("extracted_image_path"),  # worker-side; UI shows from storage if uploaded
        })

    # Plot config simplification suggestions
    plot_suggestions: List[Dict[str, Any]] = []
    if property_type == "PLOT":
        bands = Counter((c.get("plot_size_band") or "unknown") for c in configurations)
        plot_suggestions = [
            {"family": _family(band), "plot_area_band": band, "count": cnt}
            for band, cnt in bands.most_common()
        ]

    confidence_warnings = [w for w in warnings if "confidence" in w]
    missing_fields = [w for w in warnings if w.get("requires_review")]

    summary = {
        "propertyType": property_type,
        "configCount": len(configurations),
        "floorPlanCount": len(floor_plans),
        "mediaCount": len(media_assets),
        "documentCount": len(documents),
    }

    return {
        "jobId": job_id,
        "projectData": project_data,
        "configurationData": configurations,
        "floorPlans": [
            {
                "caption": fp.get("preview_caption"),
                "config_index": fp.get("config_index"),
                "confidence": fp.get("confidence"),
                "source_page_no": fp.get("source_page_no"),
                "crop_type": fp.get("crop_type"),
                "state": fp.get("state"),
                "warnings": fp.get("warnings", []),
                # Note: local_path here is worker-local. If you upload to Supabase storage
                # in a later step, swap this for a `storage_path`.
                "local_path": fp.get("extracted_image_path"),
            }
            for fp in floor_plans
        ],
        "mediaAssets": media_assets,
        "documents": documents,
        "amenities": amenities,
        "proximityMatrix": [],
        "approvedBanks": [],
        "missingFields": missing_fields,
        "assumptions": [],
        "confidenceWarnings": confidence_warnings,
        "errors": [],
        "plotConfigSuggestions": plot_suggestions,
        "summary": summary,
    }


def _family(band: str) -> str:
    if band in ("120-180",):
        return "Standard"
    if band in ("180-240",):
        return "Premium"
    if band in ("240-360", "360+"):
        return "Luxury"
    return "Other"


# --------- Mock payload (kept identical in shape to the real path) ---------

def build_mock(*, job_id: str, property_type: str) -> Dict[str, Any]:
    pt = (property_type or "APARTMENT").upper()
    if pt == "PLOT":
        configs = [
            {"name": "150 sq.yd", "plot_size_band": "120-180", "plot_area": "150", "dimensions": "30x45", "units_planned": 60, "facing": "East"},
            {"name": "200 sq.yd", "plot_size_band": "180-240", "plot_area": "200", "dimensions": "30x60", "units_planned": 40, "facing": "North"},
        ]
        floor_plans = []
        plot_suggestions = [
            {"family": "Standard", "plot_area_band": "120-180", "count": 60},
            {"family": "Premium", "plot_area_band": "180-240", "count": 40},
        ]
    elif pt == "VILLA":
        configs = [{"name": "4 BHK Villa", "bhk": 4, "land_area": "300 sq.yd", "built_up_area": "3200", "floors": 2, "bathrooms": 5, "units_planned": 24, "facing": "East"}]
        floor_plans = [{"caption": "4 BHK Villa Floor Plan", "config_index": 0, "confidence": 0.9, "source_page_no": 6, "crop_type": "page-region", "state": "detected", "warnings": []}]
        plot_suggestions = []
    else:
        configs = [
            {"name": "2 BHK", "bhk": 2, "carpet_area": "950", "built_up_area": "1180", "super_built_up_area": "1280", "balconies": 2, "bathrooms": 2, "facing": "East", "units_planned": 120},
            {"name": "3 BHK", "bhk": 3, "carpet_area": "1380", "built_up_area": "1620", "super_built_up_area": "1780", "balconies": 3, "bathrooms": 3, "facing": "East", "units_planned": 200},
        ]
        floor_plans = [
            {"caption": "2 BHK Floor Plan", "config_index": 0, "confidence": 0.92, "source_page_no": 4, "crop_type": "page-region", "state": "detected", "warnings": []},
            {"caption": "3 BHK Floor Plan", "config_index": 1, "confidence": 0.87, "source_page_no": 5, "crop_type": "page-region", "state": "detected", "warnings": []},
        ]
        plot_suggestions = []

    return {
        "jobId": job_id,
        "projectData": {
            "project_name": "Sample Greens (Mock)",
            "builder_name": "Sample Developers Pvt Ltd",
            "city": "Hyderabad",
            "address": "Plot 12, Madhapur, Hyderabad, Telangana 500081",
            "rera_id": "P02400001234",
            "status": "Under Construction",
            "open_space_pct": 65,
            "site_area": "8.4", "site_area_unit": "acres",
            "community_type": "Gated", "approach_road_width": "60 ft",
            "water_sources": ["Borewell", "Municipal"],
            "utilities": ["Power backup", "STP"],
            "expected_completion_date": "2027-06-30", "possession_date": "2027-09-30",
            "total_units": 420, "website": "https://example.com",
            "overview": "A premium gated community offering modern living with extensive amenities.",
            "key_features": ["Clubhouse", "Swimming pool", "Landscaped gardens"],
        },
        "configurationData": configs,
        "floorPlans": floor_plans,
        "mediaAssets": [{"category": "GALLERY", "caption": "Project elevation"}, {"category": "LOGO", "caption": "Builder logo"}],
        "documents": [{"caption": "RERA approval"}, {"caption": "Master plan"}],
        "amenities": ["Swimming pool", "Gym", "Clubhouse", "Children's play area", "24x7 security"],
        "proximityMatrix": [{"name": "HITEC City Metro", "distance_km": 2.4}, {"name": "Inorbit Mall", "distance_km": 3.1}],
        "approvedBanks": ["HDFC", "SBI", "ICICI", "Axis"],
        "missingFields": [{"entity_type": "project", "field_name": "internal_road_widths", "reason": "not in brochure", "requires_review": True}],
        "assumptions": [{"entity_type": "project", "field_name": "possession_date", "reason": "inferred from brochure copy", "confidence": 0.7}],
        "confidenceWarnings": [{"entity_type": "project", "field_name": "approach_road_width", "confidence": 0.55, "reason": "low-resolution page"}],
        "errors": [],
        "plotConfigSuggestions": plot_suggestions,
        "summary": {"propertyType": pt, "configCount": len(configs), "floorPlanCount": len(floor_plans), "mediaCount": 2, "documentCount": 2},
        "pagesProcessed": 0,
    }
