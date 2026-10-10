# AgriSense — Bilingual Smart Crop Recommendation

## What's new
- English / বাংলা language toggle on the home and history pages.
- Per-field microphone controls for spoken numeric input (browser Web Speech API).
- Spoken crop recommendation with a listen-again button.
- Bengali crop labels, Bengali number/date formatting in history, and translated analytics chart labels.
- Responsive voice controls styled to match the existing forest-green and cream design.
- Existing Flask routes and model input keys remain unchanged.

## Run on Windows
1. Extract this folder.
2. Open a terminal in the folder containing `app.py`.
3. Activate your existing virtual environment if you have one, or install packages:
   `pip install -r requirements.txt`
4. Run:
   `python app.py`
5. Open `http://127.0.0.1:5000` in Google Chrome.

## Voice notes
- Allow microphone access when Chrome asks.
- Select বাংলা before speaking Bengali values, or English before speaking English values.
- Tap the microphone beside a field and say the number for that field only.
- Speech recognition availability depends on the browser, device, and network. If it is unavailable, type the value manually.
- Spoken crop results use your browser's installed Bengali/English text-to-speech voice where available.

## Important
Crop suggestions are model predictions, not guarantees of yield or profitability. Check local conditions and consult agricultural extension experts before making planting decisions.
