
from flask import Flask, request, jsonify, render_template
import pandas as pd
import joblib
import sqlite3
from datetime import datetime
from pathlib import Path

app = Flask(__name__)

# Project paths
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "crop_model.pkl"
DATABASE = BASE_DIR / "crop_history.db"

# Load trained machine learning model
model = joblib.load(MODEL_PATH)

# Input features required by the model
features = [
    "N",
    "P",
    "K",
    "temperature",
    "humidity",
    "ph",
    "rainfall"
]

# Display names for feature importance chart
feature_names = [
    "Nitrogen",
    "Phosphorus",
    "Potassium",
    "Temperature",
    "Humidity",
    "pH",
    "Rainfall"
]


# ---------------- DATABASE ----------------

def get_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nitrogen REAL,
            phosphorus REAL,
            potassium REAL,
            temperature REAL,
            humidity REAL,
            ph REAL,
            rainfall REAL,
            recommended_crop TEXT,
            created_at TEXT
        )
    """)

    conn.commit()
    conn.close()


init_db()


# ---------------- HOME PAGE ----------------

@app.route("/")
def home():
    return render_template("index.html")


# ---------------- CROP PREDICTION ----------------

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({
                "error": "Please provide valid input data."
            }), 400

        # Check all seven input fields
        missing_features = [
            feature for feature in features
            if feature not in data
        ]

        if missing_features:
            return jsonify({
                "error": "Missing input values: "
                         + ", ".join(missing_features)
            }), 400

        # Convert inputs to numbers
        values = [float(data[feature]) for feature in features]

        # Reject invalid numeric values
        if not all(pd.notna(value) for value in values):
            return jsonify({
                "error": "Please enter valid numeric values."
            }), 400

        # Prepare input for ML model
        input_data = pd.DataFrame(
            [values],
            columns=features
        )

        # Predict the recommended crop
        prediction = str(model.predict(input_data)[0])

        # Save prediction to database
        conn = get_connection()

        try:
            conn.execute("""
                INSERT INTO predictions (
                    nitrogen,
                    phosphorus,
                    potassium,
                    temperature,
                    humidity,
                    ph,
                    rainfall,
                    recommended_crop,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                *values,
                prediction,
                datetime.now().isoformat(timespec="seconds")
            ))

            conn.commit()
        finally:
            conn.close()

        print("Crop recommended:", prediction)

        # Return prediction to frontend
        return jsonify({
            "recommended_crop": prediction,
            "message": "Crop recommendation generated successfully."
        }), 200

    except (ValueError, TypeError):
        return jsonify({
            "error": "All input values must be valid numbers."
        }), 400

    except Exception as e:
        app.logger.exception("Crop prediction failed")
        return jsonify({
            "error": "Prediction failed. Please check the server console."
        }), 500


# ---------------- PREDICTION HISTORY API ----------------

@app.route("/history", methods=["GET"])
def history():
    conn = get_connection()

    try:
        rows = conn.execute("""
            SELECT *
            FROM predictions
            ORDER BY id DESC
            LIMIT 50
        """).fetchall()

        return jsonify([dict(row) for row in rows]), 200

    finally:
        conn.close()


# ---------------- HISTORY PAGE ----------------

@app.route("/history-page")
def history_page():
    return render_template("history.html")


# ---------------- ANALYTICS API ----------------

@app.route("/analytics", methods=["GET"])
def analytics():
    # Feature importance from the trained model
    importance = getattr(model, "feature_importances_", None)

    if importance is None and hasattr(model, "named_steps"):
        final_model = list(model.named_steps.values())[-1]
        importance = getattr(
            final_model,
            "feature_importances_",
            None
        )

    if importance is None:
        feature_data = {
            "labels": [],
            "values": []
        }
    else:
        feature_data = {
            "labels": feature_names,
            "values": [
                round(float(value), 4)
                for value in importance
            ]
        }

    # Crop recommendation counts from SQLite
    conn = get_connection()

    try:
        rows = conn.execute("""
            SELECT recommended_crop, COUNT(*) AS total
            FROM predictions
            GROUP BY recommended_crop
            ORDER BY total DESC
        """).fetchall()

        crop_data = {
            "labels": [row["recommended_crop"] for row in rows],
            "values": [row["total"] for row in rows]
        }

    finally:
        conn.close()

    return jsonify({
        "features": feature_data,
        "crops": crop_data
    }), 200


# ---------------- RUN APPLICATION ----------------

if __name__ == "__main__":
    app.run(debug=True)