
from flask import Flask, request, jsonify, render_template
import pandas as pd
import joblib
import sqlite3
import math
from datetime import datetime, timezone
from pathlib import Path

app = Flask(__name__)

# ---------------- PROJECT PATHS ----------------

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "crop_model.pkl"
DATABASE = BASE_DIR / "crop_history.db"

# ---------------- LOAD ML MODEL ----------------

try:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model file not found: {MODEL_PATH}"
        )

    model = joblib.load(MODEL_PATH)
    app.logger.info("Crop ML model loaded successfully.")

except Exception:
    app.logger.exception("Failed to load crop ML model.")
    raise

# ---------------- INPUT FEATURES ----------------

features = [
    "N",
    "P",
    "K",
    "temperature",
    "humidity",
    "ph",
    "rainfall"
]

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
    conn = sqlite3.connect(DATABASE, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()

    try:
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
        app.logger.info("Prediction database initialized.")

    finally:
        conn.close()


try:
    init_db()
except Exception:
    # A database initialization failure should be visible in logs.
    app.logger.exception("Database initialization failed.")
    raise

# ---------------- HOME PAGE ----------------

@app.route("/")
def home():
    return render_template("index.html")


# ---------------- HEALTH CHECK ----------------

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model_loaded": model is not None
    }), 200


# ---------------- CROP PREDICTION ----------------

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({
                "error": "Please provide valid JSON input."
            }), 400

        missing_features = [
            feature for feature in features
            if feature not in data
        ]

        if missing_features:
            return jsonify({
                "error": "Missing input values: "
                + ", ".join(missing_features)
            }), 400

        # Validate all seven numeric inputs.
        try:
            values = [float(data[key]) for key in features]
        except (ValueError, TypeError, OverflowError):
            return jsonify({
                "error": "All input values must be valid numbers."
            }), 400

        if not all(math.isfinite(value) for value in values):
            return jsonify({
                "error": "Input values must be finite numbers."
            }), 400

        input_data = pd.DataFrame(
            [values],
            columns=features
        )

        # Step 1: Generate the prediction.
        try:
            prediction = str(model.predict(input_data)[0])
            app.logger.info(
                "ML prediction successful: %s", prediction
            )
        except Exception:
            app.logger.exception("ML model prediction failed.")
            return jsonify({
                "error": "The crop model could not generate a prediction."
            }), 500

        # Step 2: Save the prediction.
        # Return the crop even if history storage fails.
        history_saved = True

        try:
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
                    datetime.now(timezone.utc).isoformat(
                        timespec="seconds"
                    )
                ))

                conn.commit()

            finally:
                conn.close()

        except Exception:
            history_saved = False
            app.logger.exception(
                "Prediction succeeded, but history save failed."
            )

        return jsonify({
            "recommended_crop": prediction,
            "message": "Crop recommendation generated successfully.",
            "history_saved": history_saved
        }), 200

    except Exception:
        app.logger.exception("Unexpected crop prediction error.")

        return jsonify({
            "error": "An unexpected server error occurred."
        }), 500


# ---------------- PREDICTION HISTORY API ----------------

@app.route("/history", methods=["GET"])
def history():
    try:
        conn = get_connection()

        try:
            rows = conn.execute("""
                SELECT *
                FROM predictions
                ORDER BY id DESC
                LIMIT 50
            """).fetchall()

            return jsonify([
                dict(row) for row in rows
            ]), 200

        finally:
            conn.close()

    except Exception:
        app.logger.exception("Failed to retrieve prediction history.")

        return jsonify({
            "error": "Prediction history is currently unavailable."
        }), 500


# ---------------- HISTORY PAGE ----------------

@app.route("/history-page")
def history_page():
    return render_template("history.html")


# ---------------- ANALYTICS API ----------------

@app.route("/analytics", methods=["GET"])
def analytics():
    # Feature importance from the trained model.
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

    try:
        conn = get_connection()

        try:
            rows = conn.execute("""
                SELECT recommended_crop, COUNT(*) AS total
                FROM predictions
                GROUP BY recommended_crop
                ORDER BY total DESC
            """).fetchall()

            crop_data = {
                "labels": [
                    row["recommended_crop"] for row in rows
                ],
                "values": [
                    row["total"] for row in rows
                ]
            }

        finally:
            conn.close()

    except Exception:
        app.logger.exception("Analytics database query failed.")

        return jsonify({
            "error": "Analytics data is currently unavailable."
        }), 500

    return jsonify({
        "features": feature_data,
        "crops": crop_data
    }), 200


# ---------------- RUN LOCALLY ----------------

if __name__ == "__main__":
    app.run(debug=True)
