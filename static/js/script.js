document.addEventListener("DOMContentLoaded", () => {
    const cropForm = document.getElementById("cropForm");
    if (!cropForm) return;

    const predictButton = document.getElementById("predictButton");
    const buttonText = document.getElementById("buttonText");
    const formError = document.getElementById("formError");
    const resultTitle = document.getElementById("resultTitle");
    const resultDescription = document.getElementById("resultDescription");
    const resultOverline = document.getElementById("resultOverline");
    const t = (en, bn) => window.AgriSense?.getLanguage() === "bn" ? bn : en;

    // Add a microphone to each numeric field; the recognised value goes only into that field.
    const fields = [
        ["N", "Nitrogen", "নাইট্রোজেন"], ["P", "Phosphorus", "ফসফরাস"],
        ["K", "Potassium", "পটাশিয়াম"], ["ph", "pH", "পি এইচ"],
        ["temperature", "Temperature", "তাপমাত্রা"], ["humidity", "Humidity", "আর্দ্রতা"],
        ["rainfall", "Rainfall", "বৃষ্টিপাত"]
    ];

    function makeNumber(text) {
        const digitMap = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" };
        let normalized = String(text).replace(/[০-৯]/g, d => digitMap[d]).replace(/,/g, ".");
        const match = normalized.match(/-?\d+(?:\.\d+)?/);
        if (match) return Number(match[0]);

        const bengaliNumbers = {
            "শূন্য": 0, "এক": 1, "দুই": 2, "তিন": 3, "চার": 4, "পাঁচ": 5,
            "ছয়": 6, "ছয়": 6, "সাত": 7, "আট": 8, "নয়": 9, "নয়": 9,
            "দশ": 10, "বিশ": 20, "তিরিশ": 30, "ত্রিশ": 30, "চল্লিশ": 40,
            "পঞ্চাশ": 50, "ষাট": 60, "সত্তর": 70, "আশি": 80, "নব্বই": 90,
            "একশ": 100, "একশো": 100, "দেড়": 1.5, "দেড়": 1.5
        };
        const key = normalized.trim().replace(/[।.!?]/g, "");
        return Object.prototype.hasOwnProperty.call(bengaliNumbers, key) ? bengaliNumbers[key] : NaN;
    }

    function addVoiceButtons() {
        fields.forEach(([id, en, bn]) => {
            const input = document.getElementById(id);
            const field = input?.closest(".field");
            if (!input || !field || field.querySelector(".field-mic")) return;
            const button = document.createElement("button");
            button.type = "button";
            button.className = "field-mic";
            button.innerHTML = '<span aria-hidden="true">🎙</span><span class="mic-label">Speak</span>';
            button.setAttribute("aria-label", `Speak ${en} value`);
            button.title = `Speak ${en} value`;
            button.addEventListener("click", () => listenForValue(input, button, en, bn));
            field.appendChild(button);
        });
    }

    function listenForValue(input, button, en, bn) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showError(t(
                "Voice input is not supported by this browser. Please use Google Chrome or type the value.",
                "এই ব্রাউজারে ভয়েস ইনপুট সমর্থিত নয়। Google Chrome ব্যবহার করুন অথবা মানটি লিখুন।"
            ));
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = window.AgriSense?.getLanguage() === "bn" ? "bn-IN" : "en-IN";
        recognition.interimResults = false;
        recognition.maxAlternatives = 3;
        button.classList.add("is-listening");
        button.querySelector(".mic-label").textContent = t("Listening…", "শুনছি…");
        recognition.onresult = event => {
            const alternatives = Array.from(event.results[0]).map(item => item.transcript);
            let value = NaN;
            for (const transcript of alternatives) {
                value = makeNumber(transcript);
                if (Number.isFinite(value)) break;
            }
            if (Number.isFinite(value)) {
                input.value = value;
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
                showError("");
            } else {
                showError(t(
                    `I heard you, but couldn't identify a number for ${en}. Please say the number clearly or type it.`,
                    `${bn} মানটি বুঝতে পারিনি। সংখ্যাটি পরিষ্কার করে বলুন অথবা লিখুন।`
                ));
            }
        };
        recognition.onerror = event => {
            showError(event.error === "not-allowed"
                ? t("Please allow microphone access in your browser.", "ব্রাউজারে মাইক্রোফোন ব্যবহারের অনুমতি দিন।")
                : t("Voice input did not work. Please try again or type the value.", "ভয়েস ইনপুট কাজ করেনি। আবার চেষ্টা করুন অথবা মানটি লিখুন।"));
        };
        recognition.onend = () => {
            button.classList.remove("is-listening");
            button.querySelector(".mic-label").textContent = t("Speak", "বলুন");
        };
        try { recognition.start(); }
        catch (error) {
            button.classList.remove("is-listening");
            button.querySelector(".mic-label").textContent = t("Speak", "বলুন");
            showError(t("Microphone is busy. Please try again.", "মাইক্রোফোন ব্যস্ত। আবার চেষ্টা করুন।"));
        }
    }

    function showError(message) {
        if (!formError) return;
        formError.textContent = message;
        formError.hidden = !message;
    }

    function valueIsInvalid(value) {
        return !Number.isFinite(value);
    }

    function speakRecommendation(crop) {
        const cropLabel = window.AgriSense?.cropLabel(crop) || crop;
        const speech = window.AgriSense?.getLanguage() === "bn"
            ? `আপনার জমির তথ্য অনুযায়ী প্রস্তাবিত ফসল হলো ${cropLabel}। চাষের সিদ্ধান্ত নেওয়ার আগে স্থানীয় আবহাওয়া, মাটির অবস্থা এবং কৃষি বিশেষজ্ঞের পরামর্শ যাচাই করুন।`
            : `Your recommended crop is ${cropLabel}. Before deciding what to plant, check local growing conditions and consult an agricultural expert if possible.`;
        window.AgriSense?.speak(speech);
    }

    addVoiceButtons();

    cropForm.addEventListener("submit", async event => {
        event.preventDefault();
        showError("");

        const formData = new FormData(cropForm);
        const data = {};
        for (const [key, value] of formData.entries()) data[key] = Number(value);

        const requiredFields = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"];
        for (const field of requiredFields) {
            if (!Object.prototype.hasOwnProperty.call(data, field) || valueIsInvalid(data[field])) {
                showError(t("Please enter valid values in all seven fields.", "অনুগ্রহ করে সাতটি ঘরেই সঠিক মান দিন।"));
                document.getElementById(field)?.focus();
                return;
            }
        }

        if (
            data.N < 0 || data.N > 300 || data.P < 0 || data.P > 300 ||
            data.K < 0 || data.K > 300 || data.ph < 0 || data.ph > 14 ||
            data.humidity < 0 || data.humidity > 100 || data.rainfall < 0
        ) {
            showError(t(
                "Please check your values. N, P and K must be 0–300, pH 0–14, humidity 0–100, and rainfall cannot be negative.",
                "মানগুলো যাচাই করুন। N, P ও K ০–৩০০, pH ০–১৪, আর্দ্রতা ০–১০০ হতে হবে এবং বৃষ্টিপাত ঋণাত্মক হতে পারবে না।"
            ));
            return;
        }

        predictButton.disabled = true;
        buttonText.textContent = t("Analyzing your field…", "আপনার জমির তথ্য বিশ্লেষণ হচ্ছে…");
        resultOverline.textContent = t("ANALYSING FIELD DATA", "জমির তথ্য বিশ্লেষণ হচ্ছে");
        resultTitle.textContent = t("Please wait…", "একটু অপেক্ষা করুন…");
        resultDescription.textContent = t(
            "The machine learning model is analysing your soil and environmental conditions.",
            "মেশিন লার্নিং মডেল আপনার মাটি ও পরিবেশের তথ্য বিশ্লেষণ করছে।"
        );

        try {
            const response = await fetch("/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            const output = await response.json();
            if (!response.ok) throw new Error(output.error || "Prediction failed. Please try again.");
            if (!output.recommended_crop) throw new Error("The server did not return a crop recommendation.");
            if (output.history_saved === false) {
                console.warn("Crop prediction succeeded, but history was not saved.");
            }

            const crop = String(output.recommended_crop);
            resultOverline.textContent = t("YOUR RECOMMENDED CROP", "আপনার জন্য প্রস্তাবিত ফসল");
            resultTitle.textContent = window.AgriSense?.cropLabel(crop) || crop.charAt(0).toUpperCase() + crop.slice(1);
            resultDescription.textContent = t(
                "This suggestion is based on the seven values you provided. Check local growing conditions before making a farming decision.",
                "আপনার দেওয়া সাতটি মানের ভিত্তিতে এই পরামর্শ দেওয়া হয়েছে। চাষের সিদ্ধান্ত নেওয়ার আগে স্থানীয় পরিস্থিতি যাচাই করুন।"
            );

            let speakButton = document.getElementById("speakResult");
            if (!speakButton) {
                speakButton = document.createElement("button");
                speakButton.type = "button";
                speakButton.id = "speakResult";
                speakButton.className = "speak-result";
                speakButton.addEventListener("click", () => speakRecommendation(crop));
                document.querySelector(".result-bottom")?.before(speakButton);
            }
            speakButton.textContent = t("🔊 Listen to recommendation", "🔊 পরামর্শ শুনুন");
            speakButton.onclick = () => speakRecommendation(crop);
            speakButton.hidden = false;
            showError("");
            // Speak only after a successful user-requested prediction.
            speakRecommendation(crop);
        } catch (error) {
            console.error("Crop prediction error:", error);
            resultOverline.textContent = t("RECOMMENDATION UNAVAILABLE", "পরামর্শ পাওয়া যায়নি");
            resultTitle.textContent = t("Something went wrong.", "সমস্যা হয়েছে।");
            resultDescription.textContent = error.message || t("Could not connect to the server. Please try again.", "সার্ভারের সঙ্গে সংযোগ করা যায়নি। আবার চেষ্টা করুন।");
            showError(error.message || t("Could not connect to the server.", "সার্ভারের সঙ্গে সংযোগ করা যায়নি।"));
        } finally {
            predictButton.disabled = false;
            buttonText.textContent = t("Recommend My Crop", "আমার ফসলের পরামর্শ দিন");
        }
    });

    document.addEventListener("agrisense:languagechange", () => {
        buttonText.textContent = t("Recommend My Crop", "আমার ফসলের পরামর্শ দিন");
        document.querySelectorAll(".field-mic .mic-label").forEach(el => {
            if (!el.parentElement.classList.contains("is-listening")) el.textContent = t("Speak", "বলুন");
        });
        const speakButton = document.getElementById("speakResult");
        if (speakButton) speakButton.textContent = t("🔊 Listen to recommendation", "🔊 পরামর্শ শুনুন");
    });
});