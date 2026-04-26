from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import datetime
import os

app = Flask(__name__)
CORS(app)

# -------------------------------
# MEMORY TO STORE LATEST ESP DATA
# -------------------------------
latest_reading = {
    "quality": None,
    "raw": None,
    "timestamp": None
}


# ----------------------------------------------------
# ESP32 → SERVER (POST JSON)
# ----------------------------------------------------
@app.route("/update", methods=["POST"])
def update_data():
    try:
        data = request.get_json(force=True)
        q = data.get("quality") or data.get("q")

        latest_reading.update({
            "quality": q,
            "raw": data,
            "timestamp": datetime.datetime.utcnow().isoformat()
        })

        return jsonify({"status": "ok", "received": latest_reading})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ----------------------------------------------------
# WEBSITE → SERVER (GET JSON)
# ----------------------------------------------------
@app.route("/quality", methods=["GET"])
def get_quality():
    response = {
        "quality": latest_reading.get("quality") or "Unknown",
        "timestamp": latest_reading.get("timestamp"),
        "raw": latest_reading.get("raw")
    }
    return jsonify(response)


# ----------------------------------------------------
# SERVE YOUR FRONTEND FILES
# index.html
# script.js
# style.css
# ----------------------------------------------------
@app.route("/")
def home():
    return send_from_directory(".", "index.html")


@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(".", filename)


# ----------------------------------------------------
# RUN SERVER
# ----------------------------------------------------
if __name__ == "__main__":
    print("Server running at http://0.0.0.0:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
