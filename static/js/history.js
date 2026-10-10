document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("historyTableBody");
    const tableWrap = document.getElementById("historyTableWrap");
    const message = document.getElementById("historyMessage");
    const emptyState = document.getElementById("historyEmpty");
    const searchInput = document.getElementById("historySearch");
    const countLabel = document.getElementById("historyCount");
    const refreshButton = document.getElementById("refreshHistory");
    const totalElement = document.getElementById("totalPredictions");
    const uniqueElement = document.getElementById("uniqueCrops");
    const latestElement = document.getElementById("latestCrop");
    let allRecords = [];

    const bn = () => window.AgriSense?.getLanguage() === "bn";
    const t = (en, bengali) => bn() ? bengali : en;
    const cropName = value => window.AgriSense?.cropLabel(value) || String(value || "Unknown");

    const formatNumber = value => {
        const number = Number(value);
        return Number.isFinite(number) ? number.toLocaleString(bn() ? "bn-IN" : "en-IN", { maximumFractionDigits: 2 }) : "—";
    };

    const formatDate = value => {
        if (!value) return "—";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString(bn() ? "bn-IN" : "en-IN", {
            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
        });
    };

    function makeCell(value, className = "") {
        const cell = document.createElement("td");
        cell.textContent = value ?? "—";
        if (className) cell.className = className;
        return cell;
    }

    function renderRecords(records) {
        tableBody.replaceChildren();
        records.forEach(record => {
            const row = document.createElement("tr");
            const cropCell = document.createElement("td");
            const badge = document.createElement("span");
            badge.className = "crop-badge";
            badge.textContent = cropName(record.recommended_crop);
            cropCell.appendChild(badge);
            row.appendChild(cropCell);
            row.appendChild(makeCell(formatNumber(record.nitrogen)));
            row.appendChild(makeCell(formatNumber(record.phosphorus)));
            row.appendChild(makeCell(formatNumber(record.potassium)));
            row.appendChild(makeCell(formatNumber(record.temperature)));
            row.appendChild(makeCell(formatNumber(record.humidity)));
            row.appendChild(makeCell(formatNumber(record.ph)));
            row.appendChild(makeCell(formatNumber(record.rainfall)));
            row.appendChild(makeCell(formatDate(record.created_at), "date-cell"));
            tableBody.appendChild(row);
        });
        tableWrap.hidden = records.length === 0;
        emptyState.hidden = records.length !== 0;
    }

    function updateSummary(records) {
        totalElement.textContent = formatNumber(records.length);
        const crops = new Set(records.map(record => String(record.recommended_crop || "").toLowerCase()).filter(Boolean));
        uniqueElement.textContent = formatNumber(crops.size);
        latestElement.textContent = records.length ? cropName(records[0].recommended_crop) : "—";
    }

    function applySearch() {
        const query = searchInput.value.trim().toLocaleLowerCase();
        const filteredRecords = allRecords.filter(record =>
            String(record.recommended_crop || "").toLocaleLowerCase().includes(query) ||
            String(window.AgriSense?.cropLabel(record.recommended_crop) || "").toLocaleLowerCase().includes(query)
        );
        countLabel.textContent = t(
            `Showing ${filteredRecords.length} of ${allRecords.length} records`,
            `${formatNumber(filteredRecords.length)}টির মধ্যে ${formatNumber(allRecords.length)}টি রেকর্ড`
        );
        renderRecords(filteredRecords);
        const title = emptyState.querySelector("h3");
        const description = emptyState.querySelector("p");
        if (allRecords.length > 0 && filteredRecords.length === 0) {
            title.textContent = t("No matching crops", "মিল পাওয়া যায়নি");
            description.textContent = t("Try searching with another crop name.", "অন্য ফসলের নাম দিয়ে খুঁজুন।");
        } else {
            title.textContent = t("No matching records", "কোনও রেকর্ড নেই");
            description.textContent = t("Try another crop name or make a new crop prediction.", "অন্য ফসলের নাম খুঁজুন অথবা নতুন পূর্বাভাস নিন।");
        }
    }

    async function loadHistory() {
        refreshButton.disabled = true;
        message.hidden = false;
        message.textContent = t("Loading your prediction history…", "আপনার পূর্বাভাসের ইতিহাস লোড হচ্ছে…");
        tableWrap.hidden = true;
        emptyState.hidden = true;
        try {
            const response = await fetch("/history", { cache: "no-store" });
            if (!response.ok) throw new Error("Could not load prediction history.");
            const data = await response.json();
            if (!Array.isArray(data)) throw new Error("Unexpected response from the server.");
            allRecords = data;
            updateSummary(allRecords);
            applySearch();
            message.hidden = true;
            if (allRecords.length === 0) {
                emptyState.hidden = false;
                emptyState.querySelector("h3").textContent = t("No predictions yet", "এখনও কোনও পূর্বাভাস নেই");
                emptyState.querySelector("p").textContent = t(
                    "Your crop recommendations will appear here after your first prediction.",
                    "প্রথমবার ফসলের পরামর্শ নিলে তা এখানে দেখা যাবে।"
                );
            }
        } catch (error) {
            console.error("History loading error:", error);
            message.textContent = t(
                "Unable to load history. Please check that the Flask server is running and try again.",
                "ইতিহাস লোড করা যায়নি। Flask সার্ভার চালু আছে কি না দেখে আবার চেষ্টা করুন।"
            );
            message.hidden = false;
        } finally {
            refreshButton.disabled = false;
        }
    }

    searchInput.addEventListener("input", applySearch);
    refreshButton.addEventListener("click", loadHistory);
    document.addEventListener("agrisense:languagechange", () => {
        updateSummary(allRecords);
        applySearch();
    });
    loadHistory();
});