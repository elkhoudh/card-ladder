"""Card Ladder Trending Dashboard."""

from __future__ import annotations

import os
from datetime import datetime, timezone

from flask import Flask, jsonify, render_template, request
from flask_cors import CORS

from scraper import (
    CATEGORIES,
    CATEGORY_VALUES,
    DATE_RANGES,
    build_graph_summary,
    fetch_trending_page,
)

app = Flask(__name__)
CORS(app)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/meta")
def api_meta():
    return jsonify(
        {
            "categories": CATEGORIES,
            "date_ranges": [
                {"value": key, "label": value["label"]}
                for key, value in DATE_RANGES.items()
            ],
        }
    )


@app.route("/api/trending/page")
def api_trending_page():
    category = request.args.get("category", "all")
    period = request.args.get("period", "1m")
    direction = request.args.get("direction", "desc")
    page = int(request.args.get("page", 0))
    query = request.args.get("query", "").strip()

    if category not in CATEGORY_VALUES:
        return jsonify({"error": f"Invalid category: {category}"}), 400
    if period not in DATE_RANGES:
        return jsonify({"error": f"Invalid period. Choose from: {list(DATE_RANGES)}"}), 400
    if direction not in ("desc", "asc"):
        return jsonify({"error": "direction must be desc or asc"}), 400

    try:
        data = fetch_trending_page(
            direction,
            page=page,
            category=category,
            period=period,
            query=query,
        )
        data["fetched_at"] = datetime.now(timezone.utc).isoformat()
        return jsonify(data)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/graphs", methods=["POST"])
def api_graphs():
    payload = request.get_json(silent=True) or {}
    period = payload.get("period", "1m")
    up_cards = payload.get("trending_up", [])
    down_cards = payload.get("trending_down", [])

    if period not in DATE_RANGES:
        return jsonify({"error": f"Invalid period. Choose from: {list(DATE_RANGES)}"}), 400

    return jsonify(build_graph_summary(up_cards, down_cards, period=period))


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5050"))
    app.run(host="0.0.0.0", port=port, debug=True)
