
import sqlite3

conn = sqlite3.connect("crop_history.db")

rows = conn.execute(
    "SELECT * FROM predictions ORDER BY id DESC LIMIT 5"
).fetchall()

print("Saved prediction records:")
for row in rows:
    print(row)

conn.close()