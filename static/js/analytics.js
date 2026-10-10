let accuracyChart, featureChart, cropHistoryChart;
let analyticsData = null;

const analyticsText = {
    en: {
        accuracy: ["Decision Tree", "Random Forest", "KNN"],
        accuracyLabel: "Test accuracy (%)",
        importance: "Importance",
        recommendations: "Number of recommendations",
        features: {
            Nitrogen: "Nitrogen", Phosphorus: "Phosphorus", Potassium: "Potassium",
            Temperature: "Temperature", Humidity: "Humidity", Rainfall: "Rainfall", pH: "pH"
        }
    },
    bn: {
        accuracy: ["ডিসিশন ট্রি", "র‍্যান্ডম ফরেস্ট", "KNN"],
        accuracyLabel: "পরীক্ষার নির্ভুলতা (%)",
        importance: "গুরুত্ব",
        recommendations: "পরামর্শের সংখ্যা",
        features: {
            Nitrogen: "নাইট্রোজেন", Phosphorus: "ফসফরাস", Potassium: "পটাশিয়াম",
            Temperature: "তাপমাত্রা", Humidity: "আর্দ্রতা", Rainfall: "বৃষ্টিপাত", pH: "pH"
        }
    }
};

function drawAnalytics() {
    if (!analyticsData || typeof Chart === "undefined") return;
    const lang = window.AgriSense?.getLanguage() === "bn" ? "bn" : "en";
    const labels = analyticsText[lang];
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
    };

    const accuracyCanvas = document.getElementById("accuracyChart");
    if (accuracyCanvas) {
        if (accuracyChart) accuracyChart.destroy();
        accuracyChart = new Chart(accuracyCanvas, {
            type: "bar",
            data: {
                labels: labels.accuracy,
                datasets: [{ label: labels.accuracyLabel, data: [97.95, 99.55, 97.95],
                    backgroundColor: ["#a7c99a", "#174d35", "#78a56a"], borderRadius: 7 }]
            },
            options: { ...commonOptions, scales: { y: { min: 90, max: 100, ticks: { callback: value => value + "%" } } } }
        });
    }

    const featureCanvas = document.getElementById("featureChart");
    if (featureCanvas && analyticsData.features?.labels?.length) {
        if (featureChart) featureChart.destroy();
        featureChart = new Chart(featureCanvas, {
            type: "bar",
            data: {
                labels: analyticsData.features.labels.map(name => labels.features[name] || name),
                datasets: [{ label: labels.importance, data: analyticsData.features.values, backgroundColor: "#387b50", borderRadius: 5 }]
            },
            options: { ...commonOptions, indexAxis: "y", scales: { x: { beginAtZero: true } } }
        });
    }

    const historyCanvas = document.getElementById("cropHistoryChart");
    if (historyCanvas) {
        if (cropHistoryChart) cropHistoryChart.destroy();
        const cropLabels = analyticsData.crops.labels.map(name => window.AgriSense?.cropLabel(name, lang) || name);
        cropHistoryChart = new Chart(historyCanvas, {
            type: "bar",
            data: { labels: cropLabels, datasets: [{ label: labels.recommendations, data: analyticsData.crops.values, backgroundColor: "#78a56a", borderRadius: 5 }] },
            options: { ...commonOptions, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
        });
    }
}

async function loadAnalytics() {
    try {
        const response = await fetch("/analytics");
        if (!response.ok) throw new Error("Could not load analytics");
        analyticsData = await response.json();
        drawAnalytics();
    } catch (error) {
        console.error("Analytics error:", error);
    }
}

document.addEventListener("agrisense:languagechange", drawAnalytics);
loadAnalytics();