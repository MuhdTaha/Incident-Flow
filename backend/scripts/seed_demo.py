#!/usr/bin/env python3
"""CLI entrypoint for demo seeding / refresh.

Usage (from backend/ or via make seed):
  python3 -m scripts.seed_demo              # seed catalog only
  python3 -m scripts.seed_demo --refresh    # seed + append live activity
  python3 -m scripts.seed_demo --refresh --actions 5
"""

from __future__ import annotations

import argparse
import json
import os
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
  parser.add_argument(
    "--provision-auth",
    action="store_true",
    help="Create/update Supabase Auth users for demo emails (requires DEMO_PASSWORD, SUPABASE_URL, SUPABASE_KEY)",
  )
  args = parser.parse_args(argv)

  org_id = UUID(args.org_id) if args.org_id else None

  from app.services.demo_seed_service import run_provision_logins, run_refresh, run_seed

  combined: dict = {}
  if args.provision_auth:
    password = os.getenv("DEMO_PASSWORD")
    if not password:
      print("DEMO_PASSWORD is required with --provision-auth", file=sys.stderr)
      return 1
    combined["provision"] = run_provision_logins(password, org_id=org_id)

  if args.refresh:
    combined["seed"] = run_refresh(org_id=org_id, actions=args.actions)
  else:
    combined["seed"] = run_seed(org_id=org_id)

  print(json.dumps(combined if args.provision_auth else combined["seed"], indent=2))
  return 0


if __name__ == "__main__":
  sys.exit(main())
