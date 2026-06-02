let searchHistory = [];
let currentProfileData = null; 

// --- ROBUST WINDOW OBJECT FOR BUILD TIME INJECTIONS ---
const CONFIG = {
    PASSWORD: "TEMPLATE_API_PASSWORD",
    TARGET_URL: "TEMPLATE_TARGET_API_URL",
    PROXY_URL: "TEMPLATE_CORS_PROXY_URL"
};
// -----------------------------------------------------

function autoDetectCNIC(text) {
    const cnicRegex = /\b\d{5}-?\d{7}-?\d\b/g;
    const matches = text.match(cnicRegex);
    return matches ? matches[0] : null;
}

function formatCNIC(cnic) {
    let clean = cnic.replace(/\D/g, '');
    if (clean.length === 13) return `${clean.slice(0,5)}-${clean.slice(5,12)}-${clean.slice(12)}`;
    return cnic;
}

function normalizeInput(text) {
    let clean = text.replace(/\D/g, ''); 
    if (clean.length === 13) return clean; 
    if (clean.length >= 9 && clean.length <= 12) {
        if (clean.startsWith('92')) clean = clean.slice(2);
        if (!clean.startsWith('0')) clean = '0' + clean;
        return clean; 
    }
    return clean;
}

async function searchData() {
    let input = document.getElementById("number").value.trim();
    if (!input) { alert("Please provide a search target."); return; }
    const detected = autoDetectCNIC(input);
    if (detected) input = detected;
    await executeQuery(normalizeInput(input));
}

async function executeQuery(queryValue) {
    const status = document.getElementById("status");
    const container = document.getElementById("result-container");
    status.innerHTML = `<span style="color: var(--primary)">● Querying target [${queryValue}]...</span>`;
    container.innerHTML = `<div class="placeholder-text" style="color: var(--primary)">Fetching verified entry...</div>`;
    currentProfileData = null;

    try {
        const queryEndpoint = `${CONFIG.TARGET_URL}?password=${CONFIG.PASSWORD}&number=${encodeURIComponent(queryValue)}`;
        
        let cleanProxyBase = CONFIG.PROXY_URL;
        if (!cleanProxyBase.endsWith('?')) {
            cleanProxyBase = cleanProxyBase + '?';
        }
        
        const completeRequestUrl = cleanProxyBase + encodeURIComponent(queryEndpoint);

        // Visually flags if your proxy or target links break or are missing components
        alert("Target full transmission string:\n" + completeRequestUrl);

        const response = await fetch(completeRequestUrl);
        let rawData = await response.text();
        let data; try { data = JSON.parse(rawData); } catch(e) { data = null; }

        if (data) {
            const isPureNumberQuery = queryValue.length < 13;
            if (isPureNumberQuery && data.cnic) {
                const cleanCnic = data.cnic.replace(/\D/g, '');
                status.innerHTML = `<span style="color: var(--primary)">● Number matched. Rerouting...</span>`;
                document.getElementById("number").value = formatCNIC(cleanCnic);
                saveToHistory(queryValue);
                setTimeout(() => { executeQuery(cleanCnic); }, 750);
                return; 
            }
            if (data.name || data.cnic || (data.numbers && data.numbers.length > 0)) {
                currentProfileData = data; renderProfile(data);
                status.innerHTML = `<span style="color: var(--success)">● Verification Match Found</span>`;
            } else { renderRawFallback(rawData); status.innerHTML = `<span style="color: var(--success)">● Log Returned</span>`; }
        } else { renderRawFallback(rawData); status.innerHTML = `<span style="color: var(--success)">● Log Returned</span>`; }
        saveToHistory(queryValue);
    } catch (err) {
        status.innerHTML = `<span style="color: var(--danger)">● Fetch Protocol Failed</span>`;
        container.innerHTML = `<div class="placeholder-text" style="color: var(--danger)">Error: ${err.message}</div>`;
    }
}

function renderProfile(data) {
    const container = document.getElementById("result-container");
    const name = data.name || "N/A";
    const cnic = data.cnic ? formatCNIC(data.cnic) : "N/A";
    const address = data.address || "No Registered Address Stated";
    let numbersHtml = "N/A";
    if (data.numbers && data.numbers.length > 0) numbersHtml = data.numbers.map(num => `<span class="number-tag">${num}</span>`).join('');
    container.innerHTML = `
        <div class="profile-card">
            <div class="profile-header">
                <div><div class="profile-name">${name}</div><div class="profile-meta">Verified Record</div></div>
                <button class="copy-btn" onclick="copyProfileToClipboard()"><span id="copy-text">Copy Data</span></button>
            </div>
            <div class="profile-body"><div class="info-grid">
                <div class="info-item"><label>CNIC</label><div class="value">${cnic}</div></div>
                <div class="info-item"><label>Contact Nodes</label><div class="value">${numbersHtml}</div></div>
                <div class="info-item" style="grid-column: 1 / -1;"><label>Address</label><div class="value">${address}</div></div>
            </div></div>
        </div>`;
}

function copyProfileToClipboard() {
    if (!currentProfileData) return;
    const formattedText = `--- VERIFIED RECORD ---\nName: ${currentProfileData.name||"N/A"}\nCNIC: ${currentProfileData.cnic?formatCNIC(currentProfileData.cnic):"N/A"}\nPhones: ${(currentProfileData.numbers)?currentProfileData.numbers.join(', '):"N/A"}\nAddress: ${currentProfileData.address||"N/A"}\n\nApp: https://rebrand.ly/zobitech\n-----------------------`;
    navigator.clipboard.writeText(formattedText).then(() => {
        const btn = document.getElementById("copy-text");
        if (btn) { btn.textContent = "Copied! ✓"; setTimeout(() => { btn.textContent = "Copy Data"; }, 2000); }
    });
}

function renderRawFallback(rawData) {
    document.getElementById("result-container").innerHTML = `<div class="profile-card"><div class="profile-header"><div class="profile-name">Raw Record Return</div></div><div class="profile-body"><pre style="margin:0; font-family:monospace; font-size:13px; color: var(--text-muted);">${rawData}</pre></div></div>`;
}
function saveToHistory(item) { if (!searchHistory.includes(item)) { searchHistory.unshift(item); if (searchHistory.length > 6) searchHistory.pop(); updateHistory(); } }
function updateHistory() { document.getElementById("history-list").innerHTML = searchHistory.map(item => `<span class="tag" onclick="document.getElementById('number').value='${item}'; searchData();">${item}</span>`).join(''); }
document.getElementById("number").addEventListener("keypress", function(e) { if (e.key === "Enter") searchData(); });
document.getElementById("number").addEventListener("paste", function(e) { setTimeout(() => { const pasted = this.value; const detected = autoDetectCNIC(pasted); if (detected && pasted.length > 20) this.value = detected; }, 100); });
