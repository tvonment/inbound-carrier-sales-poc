"""Seeds the loads table from loads_seed.json.

Pickup times in the JSON are day-offsets from "now", so seeding always
produces loads in the upcoming week regardless of when it runs.
Run directly (`python -m app.seed.seeder`) or via app startup.
"""

import json
import logging
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Load

logger = logging.getLogger(__name__)

SEED_FILE = Path(__file__).parent / "loads_seed.json"


def _to_load(entry: dict, base: datetime) -> Load:
    pickup = (base + timedelta(days=entry["pickup_in_days"])).replace(
        hour=entry["pickup_hour"], minute=0, second=0, microsecond=0
    )
    delivery = pickup + timedelta(hours=entry["transit_hours"])
    fields = {
        k: v
        for k, v in entry.items()
        if k not in ("pickup_in_days", "pickup_hour", "transit_hours")
    }
    return Load(pickup_datetime=pickup, delivery_datetime=delivery, **fields)


def seed_loads(db: Session, *, force: bool = False) -> int:
    """Insert seed loads. Skips entirely if the table already has rows
    (unless force=True, which re-dates and un-books existing seed loads)."""
    existing = db.scalar(select(func.count()).select_from(Load)) or 0
    if existing and not force:
        return 0

    base = datetime.now()
    entries = json.loads(SEED_FILE.read_text())
    inserted = 0
    for entry in entries:
        load = _to_load(entry, base)
        current = db.get(Load, load.load_id)
        if current is not None:
            db.delete(current)
            db.flush()
        db.add(load)
        inserted += 1
    db.commit()
    logger.info("Seeded %d loads (pickups from %s)", inserted, base.date())
    return inserted


if __name__ == "__main__":
    from app.db import Base, SessionLocal, engine

    logging.basicConfig(level=logging.INFO)
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        count = seed_loads(session, force=True)
    print(f"Seeded {count} loads.")
