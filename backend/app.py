from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Flask
app = Flask(__name__)
CORS(app)

# === API Keys ===
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")
YELP_API_KEY = os.getenv("YELP_API_KEY")
RAPID_API_KEY = os.getenv("RAPID_API_KEY")

# === API Endpoints ===
GOOGLE_PLACES_API_BASE = "https://maps.googleapis.com/maps/api/place"
YELP_API_BASE = "https://api.yelp.com/v3"
RAPID_API_HOST = "local-business-data.p.rapidapi.com"


# ------------------------------------------------------
# SEARCH ENDPOINT — combines Yelp, Google Places, RapidAPI
# ------------------------------------------------------
@app.route("/api/search")
def search_businesses():
    query = request.args.get("query")
    if not query:
        return jsonify({"error": "Query parameter is required"}), 400

    results = []

    # === Yelp ===
    try:
        yelp_url = f"{YELP_API_BASE}/businesses/search"
        yelp_headers = {"Authorization": f"Bearer {YELP_API_KEY}"}
        yelp_params = {
            "term": query,
            "location": "Memphis, TN",
            "limit": 3,
            "sort_by": "rating",
        }
        yelp_resp = requests.get(yelp_url, headers=yelp_headers, params=yelp_params, timeout=8)
        if yelp_resp.status_code == 200:
            for b in yelp_resp.json().get("businesses", []):
                results.append({
                    "source": "Yelp",
                    "name": b["name"],
                    "rating": b.get("rating"),
                    "address": " ".join(b["location"]["display_address"]),
                    "phone": b.get("display_phone"),
                    "url": b.get("url"),
                })
        else:
            print("Yelp API error:", yelp_resp.text)
    except Exception as e:
        print("Yelp Exception:", e)

    # === Google Places ===
    try:
        g_url = f"{GOOGLE_PLACES_API_BASE}/textsearch/json"
        g_params = {"query": f"{query} Memphis TN", "key": GOOGLE_PLACES_API_KEY}
        g_resp = requests.get(g_url, params=g_params, timeout=8)
        if g_resp.status_code == 200:
            for g in g_resp.json().get("results", []):
                results.append({
                    "source": "Google Places",
                    "name": g["name"],
                    "rating": g.get("rating"),
                    "address": g.get("formatted_address"),
                    "url": f"https://www.google.com/maps/place/?q=place_id:{g['place_id']}",
                })
        else:
            print("Google API error:", g_resp.text)
    except Exception as e:
        print("Google Exception:", e)

    # === RapidAPI Local Business Data ===
    try:
        r_url = "https://local-business-data.p.rapidapi.com/search"
        r_headers = {
            "X-RapidAPI-Key": RAPID_API_KEY,
            "X-RapidAPI-Host": RAPID_API_HOST,
        }
        r_params = {"query": query, "city": "Memphis", "limit": "3"}
        r_resp = requests.get(r_url, headers=r_headers, params=r_params, timeout=8)
        if r_resp.status_code == 200:
            for r in r_resp.json().get("data", []):
                results.append({
                    "source": "RapidAPI",
                    "name": r.get("name"),
                    "address": r.get("address"),
                    "url": r.get("website"),
                })
        else:
            print("RapidAPI error:", r_resp.text)
    except Exception as e:
        print("RapidAPI Exception:", e)

    return jsonify({"businesses": results})


# ------------------------------------------------------
# MOCK ENDPOINTS — for frontend demo flow
# ------------------------------------------------------
@app.route("/api/procurements", methods=["POST"])
def create_procurement():
    content = request.get_json()
    print("New procurement posted:", content)
    return jsonify({"status": "success", "message": "Procurement received"})


@app.route("/api/proposals", methods=["POST"])
def submit_proposal():
    content = request.get_json()
    print("New proposal submitted:", content)
    return jsonify({"status": "success", "message": "Proposal received"})


# ------------------------------------------------------
# Start the Flask server
# ------------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
