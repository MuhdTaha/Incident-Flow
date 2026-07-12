#!/usr/bin/env python3
"""CLI entrypoint for demo seeding / refresh.

Usage (from backend/ or via make seed):
  python -m scripts.seed_demo              # seed catalog only
  python -m scripts.seed_demo --refresh    # seed + append live activity
  python -m scripts.seed_demo --refresh --actions 5
"""

from __future__ import annotations

import argparse
import json
import sys
from uuid import UUID


def main(argv: list[str] | None = None) -> int:
  parser = argparse.ArgumentParser(description="Seed / refresh IncidentFlow demo data")
  parser.add_argument(
    "--refresh",
    action="store_true",
    help="Also append fresh comments/transitions (implies seed)",
  )
  parser.add_argument(
    "--actions",
    type=int,
    default=3,
    help="Number of refresh mutations to apply (default: 3)",
  )
  parser.add_argument(
    "--org-id",
    type=str,
    default=None,
    help="Target organization UUID (default: DEMO_ORG_ID env or Default Org)",
  )
  args = parser.parse_args(argv)

  org_id = UUID(args.org_id) if args.org_id else None

  from app.services.demo_seed_service import run_refresh, run_seed

  if args.refresh:
    result = run_refresh(org_id=org_id, actions=args.actions)
  else:
    result = run_seed(org_id=org_id)

  print(json.dumps(result, indent=2))
  return 0


if __name__ == "__main__":
  sys.exit(main())
