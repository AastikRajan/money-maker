"""Pull all Splitwise data via API into JSON.

Uses the personal API key (Bearer token). Pulls: current user, friends, groups,
and all expenses (paginated). Writes to data/splitwise.json.
"""
from __future__ import annotations
import json
import os
import sys
from pathlib import Path

import requests

BASE = "https://secure.splitwise.com/api/v3.0"


def load_env():
    env_path = Path(__file__).parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


def get(endpoint: str, token: str, params: dict | None = None) -> dict:
    r = requests.get(
        f"{BASE}/{endpoint}",
        headers={"Authorization": f"Bearer {token}"},
        params=params or {},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def pull_all_expenses(token: str) -> list[dict]:
    """Splitwise paginates expenses; pull until empty."""
    all_expenses = []
    offset = 0
    limit = 100
    while True:
        data = get("get_expenses", token, {"limit": limit, "offset": offset})
        batch = data.get("expenses", [])
        if not batch:
            break
        all_expenses.extend(batch)
        if len(batch) < limit:
            break
        offset += limit
        if offset > 5000:  # sanity cap
            break
    return all_expenses


def main():
    load_env()
    token = os.environ.get("SPLITWISE_API_KEY")
    if not token:
        print("ERROR: SPLITWISE_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    print("Fetching current user...", file=sys.stderr)
    user = get("get_current_user", token).get("user", {})
    user_id = user.get("id")

    print("Fetching friends...", file=sys.stderr)
    friends = get("get_friends", token).get("friends", [])

    print("Fetching groups...", file=sys.stderr)
    groups = get("get_groups", token).get("groups", [])

    print("Fetching expenses (paginated)...", file=sys.stderr)
    expenses = pull_all_expenses(token)
    print(f"  got {len(expenses)} expenses", file=sys.stderr)

    out = {
        "current_user": user,
        "friends": friends,
        "groups": groups,
        "expenses": expenses,
    }

    out_path = Path(__file__).parent / "data" / "splitwise.json"
    out_path.parent.mkdir(exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")

    # Summary
    print(f"Wrote {out_path}")
    print(f"  user_id: {user_id}")
    print(f"  friends: {len(friends)}")
    print(f"  groups: {len(groups)}")
    print(f"  expenses: {len(expenses)}")


if __name__ == "__main__":
    main()
