"""Card Ladder data fetcher using the public search API."""

from __future__ import annotations

import os
from typing import Any

import requests

SEARCH_API = os.getenv(
    "CARDLADDER_SEARCH_API", "https://search-zzvl7ri3bq-uc.a.run.app"
)
API_TOKEN = os.getenv("CARDLADDER_API_TOKEN", "c28544a517b853a3ed468b98819bc104")

PAGE_SIZE = int(os.getenv("CARDLADDER_PAGE_SIZE", "100"))
MAX_PAGES = int(os.getenv("CARDLADDER_MAX_PAGES", "500"))

CATEGORIES = [
    {"value": "all", "label": "All Sports & TCG"},
    {"value": "Baseball", "label": "Baseball"},
    {"value": "Basketball", "label": "Basketball"},
    {"value": "Football", "label": "Football"},
    {"value": "Hockey", "label": "Hockey"},
    {"value": "Pokemon", "label": "Pokemon"},
    {"value": "Soccer", "label": "Soccer"},
    {"value": "TCG", "label": "TCG"},
    {"value": "Entertainment", "label": "Entertainment"},
    {"value": "Racing", "label": "Racing"},
    {"value": "Golf", "label": "Golf"},
    {"value": "Tennis", "label": "Tennis"},
    {"value": "UFC/MMA", "label": "UFC / MMA"},
    {"value": "Wrestling", "label": "Wrestling"},
    {"value": "WNBA", "label": "WNBA"},
    {"value": "Magic", "label": "Magic: The Gathering"},
    {"value": "Yu-Gi-Oh!", "label": "Yu-Gi-Oh!"},
    {"value": "One Piece", "label": "One Piece"},
    {"value": "Marvel", "label": "Marvel"},
    {"value": "Disney", "label": "Disney"},
    {"value": "Star Wars", "label": "Star Wars"},
    {"value": "Dragonball Z", "label": "Dragon Ball Z"},
]

CATEGORY_VALUES = {c["value"] for c in CATEGORIES}

DATE_RANGES = {
    "1d": {
        "label": "1 Day",
        "sort": "dailyPercentChange",
        "field": "daily_change",
    },
    "1w": {
        "label": "1 Week",
        "sort": "weeklyPercentChange",
        "field": "weekly_change",
    },
    "1m": {
        "label": "1 Month",
        "sort": "monthlyPercentChange",
        "field": "monthly_change",
    },
    "3m": {
        "label": "3 Months",
        "sort": "quarterlyPercentChange",
        "field": "quarterly_change",
    },
    "1y": {
        "label": "1 Year",
        "sort": "annualPercentChange",
        "field": "annual_change",
    },
}

# Backwards compatibility alias
SORT_FIELDS = {key: value["sort"] for key, value in DATE_RANGES.items()}
SORT_FIELDS.update({"score": "score", "value": "marketValue"})


def _headers() -> dict[str, str]:
    return {"authorization": f"Bearer {API_TOKEN}"}


def search_cards(
    *,
    page: int = 0,
    limit: int = PAGE_SIZE,
    sort: str = "monthlyPercentChange",
    direction: str = "desc",
    category: str = "all",
    query: str = "",
) -> dict[str, Any]:
    params: dict[str, str | int] = {
        "index": "cards",
        "query": query,
        "page": page,
        "limit": limit,
        "sort": sort,
        "direction": direction,
    }
    if category and category != "all":
        params["filters"] = f"category:{category}"

    response = requests.get(
        f"{SEARCH_API}/search",
        params=params,
        headers=_headers(),
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def _period_config(period: str) -> dict[str, str]:
    return DATE_RANGES.get(period, DATE_RANGES["1m"])


def _raw_change(raw: dict[str, Any], period: str) -> float | None:
    field = _period_config(period)["field"]
    mapping = {
        "daily_change": "dailyPercentChange",
        "weekly_change": "weeklyPercentChange",
        "monthly_change": "monthlyPercentChange",
        "quarterly_change": "quarterlyPercentChange",
        "annual_change": "annualPercentChange",
    }
    return raw.get(mapping.get(field, "monthlyPercentChange"))


def normalize_card(raw: dict[str, Any]) -> dict[str, Any] | None:
    card_id = raw.get("id")
    if not card_id:
        return None

    year = raw.get("year")
    set_name = raw.get("set") or raw.get("setName")
    player = raw.get("player") or raw.get("subject")
    card_number = raw.get("cardNumber") or raw.get("number")
    variation = raw.get("variation") or raw.get("parallel")

    grade = None
    if raw.get("gradingCompany") and raw.get("grade"):
        grade = f"{raw['gradingCompany']} {raw['grade']}"
    elif raw.get("grade"):
        grade = raw.get("grade")
    elif raw.get("gradingCompany"):
        grade = raw.get("gradingCompany")

    title_parts = [
        str(p)
        for p in [year, set_name, player, f"#{card_number}" if card_number else None]
        if p not in (None, "")
    ]
    title = " ".join(title_parts).strip()
    if not title:
        title = raw.get("title") or raw.get("name")
    if not title:
        return None

    image_url = (
        "https://firebasestorage.googleapis.com/v0/b/cardladder-71d53.appspot.com/o/"
        f"cards%2Fthumb_{card_id}?alt=media"
    )

    slug = raw.get("slug")
    condition = raw.get("condition")

    return {
        "id": card_id,
        "slug": slug,
        "title": title,
        "year": year,
        "set": set_name,
        "player": player,
        "card_number": card_number,
        "variation": variation,
        "grade": grade,
        "condition": condition,
        "category": raw.get("category"),
        "pop": raw.get("pop") if raw.get("pop") is not None else raw.get("population"),
        "num_sales": raw.get("numSales"),
        "daily_change": raw.get("dailyPercentChange"),
        "weekly_change": raw.get("weeklyPercentChange"),
        "monthly_change": raw.get("monthlyPercentChange"),
        "quarterly_change": raw.get("quarterlyPercentChange"),
        "annual_change": raw.get("annualPercentChange"),
        "price_movement": raw.get("priceMovement"),
        "market_value": raw.get("marketValue")
        if raw.get("marketValue") is not None
        else raw.get("value"),
        "market_cap": raw.get("marketCap"),
        # API doesn't expose a raw last-sale price — use currentValue (same as marketValue)
        "last_sold": (
            raw.get("lastSalePrice")
            or raw.get("lastSold")
            or raw.get("currentValue")
            or raw.get("marketValue")
        ),
        "last_sold_date": raw.get("lastSoldDate"),
        "date_added": raw.get("dateAdded"),
        "image_url": image_url,
        "url": f"https://www.cardladder.com/ladder/card/{slug or card_id}",
    }


def _change_value(card: dict[str, Any], period: str) -> float | None:
    return card.get(_period_config(period)["field"])


def _matches_direction(change: float | None, direction: str) -> bool:
    if change is None:
        return False
    if direction == "desc":
        return change > 0
    return change < 0


def fetch_trending_page(
    direction: str = "desc",
    *,
    page: int = 0,
    page_size: int = PAGE_SIZE,
    category: str = "all",
    period: str = "1m",
    query: str = "",
) -> dict[str, Any]:
    sort_field = _period_config(period)["sort"]
    data = search_cards(
        page=page,
        limit=page_size,
        sort=sort_field,
        direction=direction,
        category=category,
        query=query,
    )

    hits = data.get("hits", [])
    cards: list[dict[str, Any]] = []
    for hit in hits:
        change = _raw_change(hit, period)
        if not _matches_direction(change, direction):
            continue
        normalized = normalize_card(hit)
        if normalized:
            cards.append(normalized)

    matching_in_page = sum(
        1 for hit in hits if _matches_direction(_raw_change(hit, period), direction)
    )
    has_more = len(hits) == page_size and matching_in_page > 0 and page + 1 < MAX_PAGES

    return {
        "cards": cards,
        "page": page,
        "page_size": page_size,
        "has_more": has_more,
        "total_hits": data.get("totalHits"),
        "raw_page_count": len(hits),
        "period": period,
        "period_label": _period_config(period)["label"],
        "query": query,
    }


def build_graph_summary(
    up_cards: list[dict[str, Any]],
    down_cards: list[dict[str, Any]],
    *,
    period: str = "1m",
) -> dict[str, Any]:
    def top_n(cards: list[dict[str, Any]], n: int = 15) -> list[dict[str, Any]]:
        items = []
        for card in cards[:n]:
            change = _change_value(card, period)
            if change is None:
                continue
            items.append(
                {
                    "title": card["title"],
                    "change": round(change, 2),
                    "value": card.get("market_value"),
                }
            )
        return items

    def histogram(cards: list[dict[str, Any]]) -> list[dict[str, Any]]:
        buckets = [
            ("< -50%", -9999, -50),
            ("-50 to -20%", -50, -20),
            ("-20 to -5%", -20, -5),
            ("-5 to 0%", -5, 0),
            ("0 to 5%", 0, 5),
            ("5 to 20%", 5, 20),
            ("20 to 50%", 20, 50),
            ("> 50%", 50, 9999),
        ]
        counts = {label: 0 for label, _, _ in buckets}
        for card in cards:
            change = _change_value(card, period)
            if change is None:
                continue
            for label, low, high in buckets:
                if low <= change < high or (label == "> 50%" and change >= 50):
                    counts[label] += 1
                    break
        return [{"label": label, "count": counts[label]} for label, _, _ in buckets]

    def category_breakdown(cards: list[dict[str, Any]]) -> list[dict[str, Any]]:
        totals: dict[str, int] = {}
        for card in cards:
            cat = card.get("category")
            if not cat:
                continue
            totals[cat] = totals.get(cat, 0) + 1
        return [
            {"category": key, "count": value}
            for key, value in sorted(totals.items(), key=lambda item: item[1], reverse=True)
        ][:12]

    all_cards = up_cards + down_cards
    return {
        "top_gainers": top_n(up_cards),
        "top_losers": top_n(down_cards),
        "distribution": histogram(all_cards),
        "categories": category_breakdown(all_cards),
        "loaded_up": len(up_cards),
        "loaded_down": len(down_cards),
    }


if __name__ == "__main__":
    import json

    result = fetch_trending_page("desc", page=0, page_size=5)
    print(json.dumps(result, indent=2, default=str))
