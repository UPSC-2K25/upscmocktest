/**
 * DYNAMIC MULTI-PAPER ARCHITECTURE:
 * 1. Checks 'papers.json' (registry of available papers).
 * 2. If 'papers.json' is not found, automatically falls back to standard presets + auto-discovery list.
 */

const DEFAULT_CATALOG = [
  { id: "Essay", fileName: "Essay.json", label: "Essay", title: "ESSAY", subTitle: "Civil Services (Main) Examination", marks: 250, time: "3 Hours" },
  { id: "GS1", fileName: "GS1.json", label: "General Studies I", title: "GENERAL STUDIES (PAPER-I)", subTitle: "Indian Heritage & Culture, History & Geography of the World & Society", marks: 250, time: "3 Hours" },
  { id: "GS2", fileName: "GS2.json", label: "General Studies II", title: "GENERAL STUDIES (PAPER-II)", subTitle: "Governance, Constitution, Polity, Social Justice & International Relations", marks: 250, time: "3 Hours" },
  { id: "GS3", fileName: "GS3.json", label: "General Studies III", title: "GENERAL STUDIES (PAPER-III)", subTitle: "Technology, Economic Development, Bio-diversity, Environment, Security & Disaster Management", marks: 250, time: "3 Hours" },
  { id: "GS4", fileName: "GS4.json", label: "General Studies IV", title: "GENERAL STUDIES (PAPER-IV)", subTitle: "Ethics, Integrity and Aptitude", marks: 250, time: "3 Hours" },
  { id: "Geography1", fileName: "Geography1.json", label: "Geography Optional - Paper I", title: "GEOGRAPHY (PAPER-I)", subTitle: "Principles of Geography", marks: 250, time: "3 Hours" },
  { id: "Geography2", fileName: "Geography2.json", label: "Geography Optional - Paper II", title: "GEOGRAPHY (PAPER-II)", subTitle: "Geography of India", marks: 250, time: "3 Hours" },
  { id: "English", fileName: "English.json", label: "Compulsory English", title: "ENGLISH (COMPULSORY)", subTitle: "Qualifying Paper A", marks: 300, time: "3 Hours" },
  { id: "Telugu", fileName: "Telugu.json", label: "Indian Language - Telugu", title: "TELUGU (COMPULSORY / OPTIONAL)", subTitle: "Qualifying Paper / Optional Literature", marks: 300, time: "3 Hours" }
];

let papersRegistry = [];
let currentDataset = [];
let currentPaper = null;

// Timer Engine State
let timerInterval = null;
let timerRemainingSeconds = 0;
let timerInitialSeconds = 0;
let isTimerRunning = false;

// DOM Elements
const paperSelector = document.getElementById("paperSelector");
const yearSelector = document.getElementById("yearSelector");
const paperCanvas = document.getElementById("paperCanvas");
const fullMockTimerBtn = document.getElementById("fullMockTimerBtn");
const printBtn = document.getElementById("printBtn");

const stopwatchWidget = document.getElementById("stopwatchWidget");
const timerContextLabel = document.getElementById("timerContextLabel");
const timerDisplay = document.getElementById("timerDisplay");
const timerToggleBtn = document.getElementById("timerToggleBtn");
const timerResetBtn = document.getElementById("timerResetBtn");
const timerCloseBtn = document.getElementById("timerCloseBtn");

/* ==========================================================
   PAPER REGISTRY INITIALIZATION
========================================================== */

async function initCatalog() {
  showLoading("Checking available examination papers...");

  try {
    const manifestRes = await fetch("papers.json", { cache: "no-store" });
    if (manifestRes.ok) {
      const customCatalog = await manifestRes.json();
      if (Array.isArray(customCatalog) && customCatalog.length > 0) {
        papersRegistry = customCatalog;
        populatePaperSelector();
        loadSelectedPaper(papersRegistry[0]);
        return;
      }
    }
  } catch (e) {
    // papers.json not present, proceed to verification fallback
  }

  const verifiedList = [];
  for (const item of DEFAULT_CATALOG) {
    try {
      const res = await fetch(item.fileName, { method: "HEAD", cache: "no-store" });
      if (res.ok) {
        verifiedList.push(item);
      }
    } catch (_) {}
  }

  papersRegistry = verifiedList.length > 0 ? verifiedList : DEFAULT_CATALOG.slice(0, 5);
  populatePaperSelector();
  loadSelectedPaper(papersRegistry[0]);
}

function populatePaperSelector() {
  paperSelector.innerHTML = "";
  papersRegistry.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.label} (${p.fileName})`;
    paperSelector.appendChild(opt);
  });
}

/* ==========================================================
   DATA FETCHING & NORMALIZATION
========================================================== */

async function loadSelectedPaper(paperObj) {
  currentPaper = paperObj;
  showLoading(`Loading ${paperObj.title || paperObj.label} (${paperObj.fileName})...`);

  try {
    const response = await fetch(paperObj.fileName, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to load '${paperObj.fileName}'`);
    }
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      showEmptyState(`The file '${paperObj.fileName}' contains no question records.`);
      return;
    }

    currentDataset = data;
    populateYearSelector(data);
    renderCurrentPaper();
  } catch (err) {
    showErrorState(`Unable to load <strong>${paperObj.fileName}</strong>.<br><br>
      Ensure <code>${paperObj.fileName}</code> is placed in your repository folder alongside <code>index.html</code>.<br>
      <small style="color:#888;">Error details: ${err.message}</small>`);
  }
}

function populateYearSelector(data) {
  const rawYears = data
    .map(item => item.year)
    .filter(y => y !== null && y !== undefined && y !== "");
  
  const distinctYears = Array.from(new Set(rawYears)).sort((a, b) => Number(b) - Number(a));

  yearSelector.innerHTML = "";

  if (distinctYears.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No Years Found";
    yearSelector.appendChild(opt);
    return;
  }

  distinctYears.forEach(year => {
    const opt = document.createElement("option");
    opt.value = year;
    opt.textContent = year;
    yearSelector.appendChild(opt);
  });

  yearSelector.value = distinctYears[0];
}

/* ==========================================================
   PAPER RENDERING ENGINE
========================================================== */

function renderCurrentPaper() {
  if (!currentDataset || currentDataset.length === 0) return;

  const selectedYear = yearSelector.value;
  if (!selectedYear) {
    showEmptyState("No year selected.");
    return;
  }

  const filteredQuestions = currentDataset.filter(
    item => String(item.year).trim() === String(selectedYear).trim()
  );

  if (filteredQuestions.length === 0) {
    showEmptyState(`No questions found for Year ${selectedYear} in this paper.`);
    return;
  }

  filteredQuestions.sort((a, b) => {
    const qA = parseInt(a.qno, 10) || 0;
    const qB = parseInt(b.qno, 10) || 0;
    return qA - qB;
  });

  const title = currentPaper.title || currentPaper.label.toUpperCase();
  const subTitle = currentPaper.subTitle || "Civil Services Examination";
  const marks = currentPaper.marks || 250;
  const time = currentPaper.time || "3 Hours";

  let html = `
    <div class="exam-header">
      <div class="header-serial">
        <span>SERIAL NO. : UPSC-${selectedYear}-${currentPaper.id}</span>
        <span>DO NOT OPEN THIS TEST BOOKLET UNTIL YOU ARE TOLD TO DO SO</span>
      </div>
      <div class="exam-title-main">UNION PUBLIC SERVICE COMMISSION</div>
      <div class="exam-sub-title">Civil Services (Main) Examination, ${selectedYear}</div>
      <div class="exam-paper-name">${title}</div>
      <div style="font-size: 13px; font-weight: 600; margin-bottom: 12px; color: #444;">
        ${subTitle}
      </div>
      <div class="meta-time-marks">
        <span>Time Allowed : ${time}</span>
        <span>Maximum Marks : ${marks}</span>
      </div>
    </div>

    <div class="instructions-box">
      <div class="instructions-heading">QUESTION PAPER SPECIFIC INSTRUCTIONS</div>
      <ol>
        <li>Please read each of the following instructions carefully before attempting questions:</li>
        <li>Word limit in questions, wherever specified, should be adhered to.</li>
        <li>Any page or portion of the page left blank in the Answer Booklet must be clearly struck off.</li>
      </ol>
    </div>
  `;

  const hasSections = filteredQuestions.some(q => q.sec && String(q.sec).trim() !== "");

  if (hasSections) {
    const sectionsMap = new Map();
    filteredQuestions.forEach(q => {
      const secKey = q.sec ? String(q.sec).trim().toUpperCase() : "GENERAL";
      if (!sectionsMap.has(secKey)) sectionsMap.set(secKey, []);
      sectionsMap.get(secKey).push(q);
    });

    sectionsMap.forEach((questions, secName) => {
      if (secName !== "GENERAL" || sectionsMap.size > 1) {
        html += `
          <div class="section-divider">
            <span class="section-title">SECTION '${secName}'</span>
          </div>
        `;
      }
      questions.forEach(q => { html += renderQuestionBlock(q); });
    });
  } else {
    filteredQuestions.forEach(q => { html += renderQuestionBlock(q); });
  }

  paperCanvas.innerHTML = html;
  attachQuestionActionListeners();
}

function renderQuestionBlock(q) {
  const qno = q.qno !== null && q.qno !== undefined ? q.qno : "•";
  const metaText = q.marks_words_time ? String(q.marks_words_time).trim() : "";
  const targetMinutes = extractTargetMinutes(metaText);

  let bodyHtml = "";
  if (Array.isArray(q.question)) {
    bodyHtml = q.question.map(subQ => {
      const text = String(subQ).trim();
      const labelMatch = text.match(/^(\(?[a-zA-Z0-9]+\)?[.:])\s*(.*)$/);
      if (labelMatch) {
        return `
          <div class="sub-question-item">
            <span class="sub-q-label">${escapeHtml(labelMatch[1])}</span>
            <span class="sub-q-text">${escapeHtml(labelMatch[2])}</span>
          </div>
        `;
      } else {
        return `
          <div class="sub-question-item">
            <span class="sub-q-label">•</span>
            <span class="sub-q-text">${escapeHtml(text)}</span>
          </div>
        `;
      }
    }).join("");
  } else {
    bodyHtml = escapeHtml(q.question || "No question text provided.");
  }

  return `
    <article class="question-block" id="q-block-${escapeHtml(String(qno))}">
      <div class="q-row">
        <div class="q-number">Q.${qno}</div>
        <div class="q-body">${bodyHtml}</div>
        <div class="q-meta">
          ${metaText ? `<span class="marks-badge">${escapeHtml(metaText)}</span>` : ""}
          ${targetMinutes ? `
            <button class="btn-practice-q" data-qno="${escapeHtml(String(qno))}" data-minutes="${targetMinutes}">
              <svg viewBox="0 0 24 24"><path d="M12 20c4.4 0 8-3.6 8-8s-3.6-8-8-8-8 3.6-8 8 3.6 8 8 8zm0-18c5.5 0 10 4.5 10 10s-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2zm1 5h-2v6h6v-2h-4z"/></svg>
              <span>Practice (${targetMinutes}m)</span>
            </button>
          ` : `
            <button class="btn-practice-q" data-qno="${escapeHtml(String(qno))}" data-minutes="10">
              <svg viewBox="0 0 24 24"><path d="M12 20c4.4 0 8-3.6 8-8s-3.6-8-8-8-8 3.6-8 8 3.6 8 8 8zm0-18c5.5 0 10 4.5 10 10s-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2zm1 5h-2v6h6v-2h-4z"/></svg>
              <span>Practice</span>
            </button>
          `}
        </div>
      </div>
    </article>
  `;
}

function extractTargetMinutes(str) {
  if (!str) return null;
  const text = String(str).trim();

  const minMatch = text.match(/(\d+)\s*(?:min(?:ute)?s?)\b/i);
  if (minMatch) return parseInt(minMatch[1], 10);

  const slashMatch = text.match(/\/\s*(\d+)\s*m\b/i);
  if (slashMatch) return parseInt(slashMatch[1], 10);

  const marksMatch = text.match(/(\d+)\s*M\b/);
  if (marksMatch) {
    const marks = parseInt(marksMatch[1], 10);
    if (marks === 10) return 7;
    if (marks === 15) return 11;
    if (marks === 20) return 15;
  }

  return null;
}

function escapeHtml(string) {
  if (!string) return "";
  return String(string)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showLoading(msg) {
  paperCanvas.innerHTML = `
    <div class="state-message">
      <div class="state-spinner"></div>
      <p>${escapeHtml(msg)}</p>
    </div>
  `;
}

function showEmptyState(msg) {
  paperCanvas.innerHTML = `
    <div class="state-message">
      <p style="font-size: 15px; margin-bottom: 8px;">📂</p>
      <p>${escapeHtml(msg)}</p>
    </div>
  `;
}

function showErrorState(htmlMsg) {
  paperCanvas.innerHTML = `
    <div class="state-message" style="color: #991b1b; text-align: left; max-width: 600px; margin: 0 auto;">
      <h4 style="font-family: var(--font-sans); margin-bottom: 8px; font-weight: 700;">File Loading Error</h4>
      <p style="font-family: var(--font-sans); font-size: 13.5px; line-height: 1.6;">${htmlMsg}</p>
    </div>
  `;
}

/* ==========================================================
   STOPWATCH ENGINE
========================================================== */

function initTimer(minutes, labelText) {
  clearInterval(timerInterval);
  isTimerRunning = false;
  timerInitialSeconds = minutes * 60;
  timerRemainingSeconds = timerInitialSeconds;
  
  timerContextLabel.textContent = labelText;
  updateTimerDisplay();
  
  timerToggleBtn.textContent = "Start";
  timerToggleBtn.classList.add("timer-btn-primary");
  
  stopwatchWidget.classList.remove("minimized");
  timerDisplay.classList.remove("time-warning");
}

function toggleTimer() {
  if (isTimerRunning) {
    clearInterval(timerInterval);
    isTimerRunning = false;
    timerToggleBtn.textContent = "Resume";
  } else {
    if (timerRemainingSeconds <= 0) timerRemainingSeconds = timerInitialSeconds;
    isTimerRunning = true;
    timerToggleBtn.textContent = "Pause";
    
    timerInterval = setInterval(() => {
      if (timerRemainingSeconds > 0) {
        timerRemainingSeconds--;
        updateTimerDisplay();
        if (timerRemainingSeconds <= 60 && timerRemainingSeconds > 0) {
          timerDisplay.classList.add("time-warning");
        }
      } else {
        clearInterval(timerInterval);
        isTimerRunning = false;
        timerToggleBtn.textContent = "Finished";
        timerDisplay.textContent = "00:00";
        alert(`⏰ Time is up for ${timerContextLabel.textContent}!`);
      }
    }, 1000);
  }
}

function resetTimer() {
  clearInterval(timerInterval);
  isTimerRunning = false;
  timerRemainingSeconds = timerInitialSeconds;
  timerToggleBtn.textContent = "Start";
  timerDisplay.classList.remove("time-warning");
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const hours = Math.floor(timerRemainingSeconds / 3600);
  const minutes = Math.floor((timerRemainingSeconds % 3600) / 60);
  const seconds = timerRemainingSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");

  if (hours > 0) {
    timerDisplay.textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  } else {
    timerDisplay.textContent = `${pad(minutes)}:${pad(seconds)}`;
  }
}

function attachQuestionActionListeners() {
  document.querySelectorAll(".btn-practice-q").forEach(btn => {
    btn.addEventListener("click", () => {
      const qno = btn.getAttribute("data-qno");
      const minutes = parseInt(btn.getAttribute("data-minutes"), 10) || 10;
      initTimer(minutes, `Q.${qno} (${minutes} Min Practice)`);
    });
  });
}

/* ==========================================================
   EVENT LISTENERS
========================================================== */

paperSelector.addEventListener("change", (e) => {
  const selected = papersRegistry.find(p => p.id === e.target.value);
  if (selected) loadSelectedPaper(selected);
});

yearSelector.addEventListener("change", () => {
  renderCurrentPaper();
});

fullMockTimerBtn.addEventListener("click", () => {
  const title = currentPaper ? (currentPaper.title || currentPaper.label) : "Exam";
  const year = yearSelector.value || "";
  initTimer(180, `${title} (${year}) - Full Mock (3h)`);
  toggleTimer();
});

timerToggleBtn.addEventListener("click", toggleTimer);
timerResetBtn.addEventListener("click", resetTimer);
timerCloseBtn.addEventListener("click", () => {
  clearInterval(timerInterval);
  isTimerRunning = false;
  stopwatchWidget.classList.add("minimized");
});

printBtn.addEventListener("click", () => window.print());

window.addEventListener("DOMContentLoaded", initCatalog);