import os
import json
import random
import csv
import io
import re
from datetime import datetime, timedelta
from functools import lru_cache

from flask import Flask, render_template, jsonify, request, Response
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")
DATA_REFRESH_INTERVAL = int(os.getenv("DATA_REFRESH_INTERVAL", "3600"))

# =============================================================================
# Mock Data Generators
# =============================================================================

GENRE_POOL = {
    "us": [
        "Werewolf Alpha", "Vampire", "Billionaire", "Mafia", "Contract Marriage",
        "Revenge", "Secret Baby", "Forbidden Love", "Rebirth", "Amnesia",
        "Fake Heiress", "Divorce", "Witch", "Mermaid", "AI Lover"
    ],
    "uk": [
        "Werewolf Alpha", "Vampire", "Billionaire", "Mafia", "Contract Marriage",
        "Revenge", "Secret Baby", "Forbidden Love", "Rebirth", "Amnesia",
        "Fake Heiress", "Divorce", "Witch", "Royal Romance", "Supernatural"
    ]
}

TITLE_TEMPLATES = {
    "us": [
        "The Alpha's {adj} {noun}",
        "Bound to the {adj} Billionaire",
        "My Vampire {role}'s {adj} Secret",
        "Contract {role}: Married to the {adj} CEO",
        "The {adj} Alpha's Forbidden {noun}",
        "Reborn: The {adj} {noun}'s Revenge",
        "Mafia {role}'s {adj} Vow",
        "The Billionaire's Secret {noun}",
        "Werewolf King's {adj} {role}",
        "Married to the {adj} Mafia Boss",
        "The Vampire's {adj} {noun}",
        "Alpha's {adj} Contract {role}",
        "Rebirth of the {adj} {noun}",
        "The {adj} Billionaire's Amnesia {role}",
        "Forbidden: The {adj} {noun}'s Lover",
        "The {adj} Heiress Returns",
        "Divorced, Reborn, {adj}",
        "My {adj} Mafia Husband",
        "The {adj} Werewolf's Bride",
        "Secret Baby with the {adj} CEO",
        "The {noun}'s {adj} Revenge Plan",
        "Vampire {role}: Blood & {noun}",
        "The {adj} Alpha Claimed Me",
        "Contract Marriage with the {adj} Billionaire",
        "Reborn as the {adj} Alpha's {role}",
        "The {adj} Mafia's Secret {noun}",
        "My {adj} Vampire {role}",
        "The {adj} Heiress's Counterattack",
        "Forbidden Love with the {adj} Alpha",
        "The {adj} Billionaire's {noun}"
    ],
    "uk": [
        "The {adj} Duke's {noun}",
        "Bound to the {adj} Billionaire",
        "My Vampire {role}'s {adj} Secret",
        "Contract {role}: The {adj} Heir",
        "The {adj} Alpha's Forbidden {noun}",
        "Reborn: The {adj} {noun}'s Revenge",
        "Mafia {role}'s {adj} Vow",
        "The Billionaire's Secret {noun}",
        "Royal {role}'s {adj} Command",
        "Married to the {adj} Mafia Boss",
        "The Vampire's {adj} {noun}",
        "Alpha's {adj} Contract {role}",
        "Rebirth of the {adj} {noun}",
        "The {adj} Heiress Returns",
        "Forbidden: The {adj} {noun}'s Lover",
        "The {adj} Werewolf's Bride",
        "Secret Baby with the {adj} Duke",
        "The {noun}'s {adj} Revenge Plan",
        "Vampire {role}: Blood & {noun}",
        "The {adj} Alpha Claimed Me",
        "Royal Romance: The {adj} {noun}",
        "Contract Marriage with the {adj} Billionaire",
        "Reborn as the {adj} Alpha's {role}",
        "The {adj} Mafia's Secret {noun}",
        "My {adj} Vampire {role}",
        "The {adj} Heiress's Counterattack",
        "Forbidden Love with the {adj} Alpha",
        "The {adj} Billionaire's {noun}",
        "The {adj} Witch's {noun}",
        "Supernatural {role}: The {adj} Bond"
    ]
}

NOUNS = ["Mate", "Bride", "Heiress", "Queen", "Luna", "Duchess", "Princess", "Countess", "Billionaire", "Captive", "Prophecy", "Bloodline", "Secret", "Vow", "Throne"]
ADJS = ["Ruthless", "Cold", "Hidden", "Forgotten", "Cruel", "Dark", "Alpha", "Royal", "Midnight", "Savage", "Feral", "Billionaire"]
ROLES = ["Wife", "Husband", "Bride", "Mate", "Lover", "Husband", "King", "CEO", "Alpha", "Prince", "Boss"]
VERBS = ["Claim", "Bound", "Mark", "Break", "Tame", "Rise", "Burn", "Fall", "Heal", "Reborn"]
EVENTS = ["Marriage", "Rebirth", "Divorce", "Claiming", "Mating", "Betrayal", "Moon Ceremony", "Blood Bond"]


def generate_title(region):
    tmpl = random.choice(TITLE_TEMPLATES[region])
    return tmpl.format(
        noun=random.choice(NOUNS),
        adj=random.choice(ADJS),
        role=random.choice(ROLES),
        verb=random.choice(VERBS),
        event=random.choice(EVENTS)
    )


def generate_table_data(region, count=100):
    genres = GENRE_POOL[region]
    rows = []
    base_vv = 900 if region == "us" else 600
    for i in range(1, count + 1):
        vv = max(20, base_vv - i * 7 + random.uniform(-30, 30))
        completion = max(0.25, min(0.96, 0.88 - i * 0.005 + random.uniform(-0.08, 0.04)))
        hours = random.randint(1, 72) if i <= 50 else random.randint(12, 168)
        updated = f"{hours}小时前" if hours < 24 else f"{hours // 24}天前"
        row_genres = random.sample(genres, k=random.randint(1, 3))
        rows.append({
            "rank": i,
            "title": generate_title(region),
            "genres": row_genres,
            "vv": round(vv, 1),
            "completion": round(completion, 3),
            "updated": updated
        })
    return rows


def generate_mature_data(region):
    if region == "us":
        return [
            {"name": "Werewolf Alpha", "value": 32},
            {"name": "Billionaire", "value": 25},
            {"name": "Mafia", "value": 18},
            {"name": "Contract Marriage", "value": 15},
            {"name": "Vampire", "value": 10}
        ]
    return [
        {"name": "Werewolf Alpha", "value": 28},
            {"name": "Billionaire", "value": 22},
            {"name": "Vampire", "value": 20},
            {"name": "Contract Marriage", "value": 18},
            {"name": "Royal Romance", "value": 12}
    ]


def generate_emerging_data(region):
    if region == "us":
        return [
            {"name": "AI Lover", "growth": 340},
            {"name": "Mermaid Romance", "growth": 280},
            {"name": "Witch Coven", "growth": 150},
            {"name": "Rebirth Revenge", "growth": 120},
            {"name": "Secret Baby", "growth": 95},
            {"name": "Amnesia Redemption", "growth": 78}
        ]
    return [
        {"name": "AI Lover", "growth": 220},
        {"name": "Mermaid Romance", "growth": 180},
        {"name": "Witch Coven", "growth": 110},
        {"name": "Rebirth Revenge", "growth": 90},
        {"name": "Supernatural Bond", "growth": 65},
        {"name": "Amnesia Redemption", "growth": 52}
    ]


def generate_kpis(region, table_data):
    total_drama = len(table_data)
    total_vv = sum(r["vv"] for r in table_data)
    avg_completion = sum(r["completion"] for r in table_data) / len(table_data)
    emerging_count = 12 if region == "us" else 8
    return {
        "totalDrama": total_drama,
        "totalVV": round(total_vv, 1),
        "avgCompletion": round(avg_completion * 100, 1),
        "emergingCount": emerging_count
    }


# In-memory cache with timestamp
_cache = {}
_cache_time = {}


def get_data(region, range_key):
    cache_key = f"{region}_{range_key}"
    now = datetime.now()
    if cache_key in _cache and _cache_time.get(cache_key, now) > now - timedelta(seconds=DATA_REFRESH_INTERVAL):
        return _cache[cache_key]

    table = generate_table_data(region)
    data = {
        "kpis": generate_kpis(region, table),
        "mature": generate_mature_data(region),
        "emerging": generate_emerging_data(region),
        "table": table,
        "lastUpdated": now.strftime("%Y-%m-%d %H:%M:%S UTC")
    }
    _cache[cache_key] = data
    _cache_time[cache_key] = now
    return data


# =============================================================================
# DeepSeek Clustering (Mock + Real API fallback)
# =============================================================================

def mock_deepseek_cluster(titles, region):
    """Mock clustering when no API key is available."""
    clusters = {
        "成熟赛道": ["Werewolf Alpha", "Billionaire", "Mafia", "Contract Marriage", "Vampire"],
        "起量新题材": ["AI Lover", "Mermaid", "Witch", "Rebirth", "Secret Baby", "Amnesia"]
    }
    result = {
        "region": region,
        "clusters": [],
        "insights": []
    }
    for track, genres in clusters.items():
        count = sum(1 for t in titles for g in genres if g.lower() in t.lower())
        result["clusters"].append({
            "track": track,
            "genres": genres,
            "count": count,
            "share": round(count / max(len(titles), 1) * 100, 1)
        })
    region_name = '美区' if region == 'us' else '英区'
    result["insights"] = [
        f"{region_name}Werewolf Alpha / Billionaire 题材仍占据主导，合计占比约57%",
        f"AI Lover 相关题材增速显著，{'月环比增长340%' if region == 'us' else '月环比增长220%'}",
        "Werewolf Alpha 类在18-24岁女性用户中完播率最高，达82%",
        "Mafia Romance 题材男性观众占比提升至38%，打破女性向垄断"
    ]
    return result


def call_deepseek_cluster(titles, region):
    """Call DeepSeek API for real clustering."""
    if not DEEPSEEK_API_KEY:
        return mock_deepseek_cluster(titles, region)

    try:
        import requests
        prompt = f"""你是一位海外短剧内容分析专家。请对以下TikTok短剧标题进行题材聚类分析，区分成熟赛道与起量新题材。

地区：{'美国' if region == 'us' else '英国'}
剧集标题（前30条）：
{chr(10).join(['- ' + t for t in titles[:30]])}

请输出JSON格式：
{{
  "clusters": [
    {{"track": "成熟赛道", "genres": ["..."], "count": 0, "share": 0}},
    {{"track": "起量新题材", "genres": ["..."], "count": 0, "share": 0}}
  ],
  "insights": ["洞察1", "洞察2", "洞察3", "洞察4"]
}}
"""
        resp = requests.post(
            DEEPSEEK_API_URL,
            headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7,
                "max_tokens": 1200
            },
            timeout=30
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        # Extract JSON
        match = re.search(r"```json\s*(.*?)\s*```", content, re.S)
        if match:
            content = match.group(1)
        data = json.loads(content)
        data["region"] = region
        return data
    except Exception as e:
        app.logger.error(f"DeepSeek API error: {e}")
        return mock_deepseek_cluster(titles, region)


# =============================================================================
# Routes
# =============================================================================

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/data")
def api_data():
    region = request.args.get("region", "us")
    range_key = request.args.get("range", "today")
    if region not in ("us", "uk"):
        region = "us"
    if range_key not in ("today", "7d", "30d"):
        range_key = "today"
    return jsonify(get_data(region, range_key))


@app.route("/api/analyze")
def api_analyze():
    region = request.args.get("region", "us")
    if region not in ("us", "uk"):
        region = "us"
    data = get_data(region, "today")
    titles = [r["title"] for r in data["table"]]
    result = call_deepseek_cluster(titles, region)
    return jsonify(result)


@app.route("/api/export")
def api_export():
    region = request.args.get("region", "us")
    range_key = request.args.get("range", "today")
    if region not in ("us", "uk"):
        region = "us"
    data = get_data(region, range_key)
    rows = data["table"]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["排名", "剧集标题", "题材标签", "播放量(W)", "完播率(%)", "更新时间"])
    for r in rows:
        writer.writerow([
            r["rank"],
            r["title"],
            "/".join(r["genres"]),
            r["vv"],
            round(r["completion"] * 100),
            r["updated"]
        ])

    csv_data = output.getvalue()
    output.close()

    filename = f"shortdrama_top100_{region}_{datetime.now().strftime('%Y%m%d')}.csv"
    return Response(
        csv_data.encode("utf-8-sig"),
        mimetype="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.route("/api/heatmap")
def api_heatmap():
    """Return heatmap matrix data: genres x time_buckets."""
    region = request.args.get("region", "us")
    if region not in ("us", "uk"):
        region = "us"
    data = get_data(region, "today")
    genres = list(set(g for r in data["table"] for g in r["genres"]))
    buckets = ["00-04", "04-08", "08-12", "12-16", "16-20", "20-24"]
    matrix = []
    for g in genres[:12]:
        row = []
        for b in buckets:
            # Simulated heat score based on random with genre bias
            base = hash(g + b) % 50 + 20
            row.append(base)
        matrix.append({"genre": g, "values": row})
    return jsonify({
        "buckets": buckets,
        "matrix": matrix
    })


# =============================================================================
# Error Handlers
# =============================================================================

@app.route("/health")
def health_check():
    return jsonify({"status": "ok"}), 200


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug_mode = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug_mode)
