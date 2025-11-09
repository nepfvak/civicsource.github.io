from flask import Flask, request, jsonify
from flask_cors import CORS
import os, json, requests
from dotenv import load_dotenv
import google.generativeai as genai
from datetime import datetime

# ------------------------------------------------------
# Load environment variables
# ------------------------------------------------------
load_dotenv()

# ------------------------------------------------------
# Initialize Flask + CORS
# ------------------------------------------------------
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ------------------------------------------------------
# API Keys
# ------------------------------------------------------
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")
YELP_API_KEY = os.getenv("YELP_API_KEY")
RAPID_API_KEY = os.getenv("RAPID_API_KEY")

GOOGLE_PLACES_API_BASE = "https://maps.googleapis.com/maps/api/place"
YELP_API_BASE = "https://api.yelp.com/v3"
RAPID_API_HOST = "local-business-data.p.rapidapi.com"

# ------------------------------------------------------
# Gemini AI setup (optional)
# ------------------------------------------------------
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# ------------------------------------------------------
# Helper: save results to disk
# ------------------------------------------------------
def save_results(data, query):
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    path = "search_results.json"
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(
                {"query": query, "timestamp": timestamp, "results": data},
                f,
                ensure_ascii=False,
                indent=2
            )
        print(f"💾 Saved {len(data)} results to {path}")
    except Exception as e:
        print("⚠️ Could not save results:", e)

# ------------------------------------------------------
# /api/search — Live vendor search
# ------------------------------------------------------
@app.route("/api/search", methods=["GET"])
def search_businesses():
    query = request.args.get("query", "").strip()
    location = request.args.get("location", "Memphis, TN")
    radius = request.args.get("radius", "25")
    limit = int(request.args.get("limit", "12"))

    if not query:
        return jsonify({"error": "Query parameter is required"}), 400

    results = []
    print(f"🔎 Searching live APIs for: '{query}' near {location}")

    # ---- Yelp API ----
    try:
        yelp_res = requests.get(
            f"{YELP_API_BASE}/businesses/search",
            headers={"Authorization": f"Bearer {YELP_API_KEY}"},
            params={"term": query, "location": location, "limit": limit},
            timeout=10
        )
        if yelp_res.ok:
            yelp_data = yelp_res.json().get("businesses", [])
            for b in yelp_data:
                results.append({
                    "source": "Yelp",
                    "name": b["name"],
                    "rating": b.get("rating"),
                    "reviews": b.get("review_count"),
                    "address": " ".join(b["location"].get("display_address", [])),
                    "website": b.get("url"),
                    "distance_miles": round(b.get("distance", 0) / 1609.34, 1),
                    "is_chain": "franchise" in b.get("alias", "").lower(),
                    "government_registered": False,
                })
        else:
            print("⚠️ Yelp API error:", yelp_res.text)
    except Exception as e:
        print("❌ Yelp fetch error:", e)

    # ---- RapidAPI (local-business-data) ----
    try:
        rapid_res = requests.get(
            f"https://{RAPID_API_HOST}/search",
            headers={
                "x-rapidapi-key": RAPID_API_KEY,
                "x-rapidapi-host": RAPID_API_HOST
            },
            params={"query": query, "location": location, "limit": limit},
            timeout=10
        )
        if rapid_res.ok:
            rapid_data = rapid_res.json().get("data", [])
            for b in rapid_data:
                results.append({
                    "source": "RapidAPI",
                    "name": b.get("name"),
                    "rating": b.get("rating"),
                    "reviews": b.get("review_count", 0),
                    "address": b.get("address"),
                    "website": b.get("website"),
                    "is_chain": b.get("is_chain", False),
                    "government_registered": False,
                })
        else:
            print("⚠️ RapidAPI error:", rapid_res.text)
    except Exception as e:
        print("❌ RapidAPI fetch error:", e)

    # ---- Deduplicate and trim ----
    seen, deduped = set(), []
    for r in results:
        if r["name"] not in seen:
            deduped.append(r)
            seen.add(r["name"])

    print(f"✅ Found {len(deduped)} unique businesses.")
    save_results(deduped, query)
    return jsonify({"businesses": deduped[:limit]})

# ------------------------------------------------------
# Optional: Gemini chat endpoint for your helper
# ------------------------------------------------------
@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    message = data.get("message", "")
    if not message:
        return jsonify({"error": "Message required"}), 400

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(
            f"You are Civic Helper, a friendly AI that gives short bullet-point civic/business guidance with links to real resources.\nUser: {message}"
        )
        return jsonify({"reply": response.text})
    except Exception as e:
        print("Chat error:", e)
        return jsonify({"reply": "⚠️ Something went wrong with Gemini."})

# ------------------------------------------------------
# Run Flask
# ------------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
