#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("APP_DATABASE_URL", "postgresql://unused/schema-export")
os.environ.setdefault("SESSION_SECRET", "unused-for-schema-export")

from app.main import app  # noqa: E402

OUTPUT_PATH = BACKEND_ROOT / "openapi.json"

OUTPUT_PATH.write_text(json.dumps(app.openapi(), indent=2) + "\n")
