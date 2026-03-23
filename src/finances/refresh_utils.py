"""Shared utilities for data refresh scripts."""

import json
import os
from datetime import datetime, timezone

TIMESTAMPS_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data",
    "refresh-timestamps.json",
)


def update_timestamp(source_name: str) -> None:
    """Record last-successful-run timestamp for a data source."""
    existing = {}
    if os.path.exists(TIMESTAMPS_PATH):
        with open(TIMESTAMPS_PATH, "r") as f:
            existing = json.load(f)

    existing[source_name] = datetime.now(timezone.utc).isoformat()

    with open(TIMESTAMPS_PATH, "w") as f:
        json.dump(existing, f, indent=2)

    print(f"Updated refresh timestamp for '{source_name}'")
