"""
Inspect the raw Card Ladder search API response.

Usage:
    python inspect_api.py                   # 3 cards from "all" category
    python inspect_api.py --category Pokemon --limit 2
    python inspect_api.py --full            # dump complete raw JSON for first card

Run this to see EVERY field the API returns so we can decide what to expose in the dashboard.
"""
import argparse
import json
import os
import sys

import requests

SEARCH_API = os.getenv("CARDLADDER_SEARCH_API", "https://search-zzvl7ri3bq-uc.a.run.app")
API_TOKEN = os.getenv("CARDLADDER_API_TOKEN", "c28544a517b853a3ed468b98819bc104")


def fetch(category="all", limit=3, sort="monthlyPercentChange", direction="desc"):
    params = {
        "index": "cards",
        "query": "",
        "page": 0,
        "limit": limit,
        "sort": sort,
        "direction": direction,
    }
    if category and category != "all":
        params["filters"] = f"category:{category}"

    r = requests.get(
        f"{SEARCH_API}/search",
        params=params,
        headers={"authorization": f"Bearer {API_TOKEN}"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def print_section(title, data):
    width = 72
    print(f"\n{'─' * width}")
    print(f"  {title}")
    print(f"{'─' * width}")
    if isinstance(data, dict):
        for k, v in data.items():
            print(f"  {k:<42} {repr(v)}")
    else:
        print(f"  {data}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--category", default="all")
    parser.add_argument("--limit", type=int, default=3)
    parser.add_argument("--sort", default="monthlyPercentChange")
    parser.add_argument("--direction", default="desc")
    parser.add_argument("--full", action="store_true", help="Dump full raw JSON")
    parser.add_argument("--keys-only", action="store_true", help="List all unique keys across all returned cards")
    args = parser.parse_args()

    print(f"\nFetching {args.limit} cards from category={args.category!r}, "
          f"sort={args.sort!r}, direction={args.direction!r} …")

    data = fetch(args.category, args.limit, args.sort, args.direction)

    # Top-level response shape
    top_keys = {k: type(v).__name__ for k, v in data.items() if k != "hits"}
    print_section("TOP-LEVEL RESPONSE KEYS (excluding hits[])", top_keys)

    hits = data.get("hits", [])
    print(f"\n  totalHits reported by API: {data.get('totalHits', 'N/A')}")
    print(f"  hits returned in this page: {len(hits)}")

    if args.full:
        print("\n" + "═" * 72)
        print("  FULL RAW JSON (first hit)")
        print("═" * 72)
        print(json.dumps(hits[0] if hits else {}, indent=2, default=str))
        return

    if args.keys_only:
        all_keys: set[str] = set()
        for hit in hits:
            all_keys.update(hit.keys())
        print_section("ALL UNIQUE KEYS FOUND ACROSS RETURNED CARDS", {k: "" for k in sorted(all_keys)})
        return

    # Per-card detail
    for i, hit in enumerate(hits):
        print_section(f"CARD {i + 1} — ALL RAW FIELDS", hit)

    # Collect all unique keys
    all_keys: set[str] = set()
    for hit in hits:
        all_keys.update(hit.keys())

    print(f"\n{'═' * 72}")
    print(f"  UNIQUE KEYS ACROSS ALL {len(hits)} CARDS")
    print(f"{'═' * 72}")
    for k in sorted(all_keys):
        sample_values = [h.get(k) for h in hits if k in h]
        non_null = [v for v in sample_values if v is not None]
        print(f"  {k:<42} sample: {repr(non_null[0]) if non_null else 'null'}")

    print(f"\n{'─' * 72}")
    print("  TIP: run with --full to see the complete JSON for the first card")
    print(f"       run with --keys-only for a quick key list")
    print(f"{'─' * 72}\n")


if __name__ == "__main__":
    main()
