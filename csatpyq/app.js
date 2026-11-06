// ==========================================
// 1. DYNAMIC CONFIGURATION & MASTER REGISTRY
// ==========================================
const YEARS_CONFIG = [2024, 2023, 2022, 2021, 2020];

// State Store
const state = {
  isReviewMode: false,
  currentIndex: 0,
  timeRemaining: 120 * 60,
  timerId: null,
  isPaused: false,
  allQuestions: [],     // All questions loaded from all detected files
  availableYears: [],   // Detected available years
  activeQuestions: [],  // Questions in current test session
  passages: {},         // Keyed by passageid
  userAnswers: {}       // currentIndex -> 'A' | 'B' | 'C' | 'D'
};

// DOM Elements
const elements = {
  appHeaderTitle: document.getElementById('appHeaderTitle'),
  timerDisplay: document.getElementById('timerDisplay'),
  btnPause: document.getElementById('btnPause'),
  btnFullscreen: document.getElementById('btnFullscreen'),
  btnSubmitTop: document.getElementById('btnSubmitTop'),
  btnRetakeTop: document.getElementById('btnRetakeTop'),
  passageContainer: document.getElementById('passageContainer'),
  passageText: document.getElementById('passageText'),
  questionNumber: document.getElementById('questionNumber'),
  reviewMetaGroup: document.getElementById('reviewMetaGroup'),
  topicTag: document.getElementById('topicTag'),
  sourceTag: document.getElementById('sourceTag'),
  questionText: document.getElementById('questionText'),
  optionsContainer: document.getElementById('optionsContainer'),
  reviewDetails: document.getElementById('reviewDetails'),
  userStatusText: document.getElementById('userStatusText'),
  correctAnswerText: document.getElementById('correctAnswerText'),
  explanationText: document.getElementById('explanationText'),
  attemptActions: document.getElementById('attemptActions'),
  reviewActions: document.getElementById('reviewActions'),
  btnPrev: document.getElementById('btnPrev'),
  btnNext: document.getElementById('btnNext'),
  btnClear: document.getElementById('btnClear'),
  btnSaveNext: document.getElementById('btnSaveNext'),
  paletteGrid: document.getElementById('paletteGrid'),
  paletteCount: document.getElementById('paletteCount'),
  paletteLegend: document.getElementById('paletteLegend'),
  startModal: document.getElementById('startModal'),
  selectedYear: document.getElementById('selectedYear'),
  yearSelectorGroup: document.getElementById('yearSelectorGroup'),
  poolAvailableCount: document.getElementById('poolAvailableCount'),
  numQuestionsInput: document.getElementById('numQuestionsInput'),
  qCountLimits: document.getElementById('qCountLimits'),
  timerEstimateHint: document.getElementById('timerEstimateHint'),
  btnStartConfirmed: document.getElementById('btnStartConfirmed'),
  submitModal: document.getElementById('submitModal'),
  submitSummaryStats: document.getElementById('submitSummaryStats'),
  btnCancelSubmit: document.getElementById('btnCancelSubmit'),
  btnConfirmSubmit: document.getElementById('btnConfirmSubmit'),
  resultModal: document.getElementById('resultModal'),
  btnEnterReview: document.getElementById('btnEnterReview')
};

// ==========================================
// 2. DYNAMIC ASYNCHRONOUS DATA LOADER
// ==========================================
async function loadTestData() {
  // A. Load Central Passages
  try {
    const passRes = await fetch('passage.json').catch(() => null) || 
                    await fetch('passages.json').catch(() => null);
    if (passRes && passRes.ok) {
      const pData = await passRes.json();
      pData.forEach(p => { state.passages[p.passageid] = p.passage; });
    }
  } catch (e) {
    console.warn('Passage file not loaded:', e);
  }

  // B. Fetch all question files in parallel
  const yearFetchPromises = YEARS_CONFIG.map(async (yr) => {
    try {
      const res = await fetch(`questions_${yr}.json`);
      if (res.ok) {
        const data = await res.json();
        data.forEach(q => { if (!q.year) q.year = yr; });
        return { year: yr, questions: data };
      }
    } catch (_) {}
    return null;
  });

  const results = await Promise.all(yearFetchPromises);
  const foundYears = new Set();

  results.forEach(res => {
    if (res && Array.isArray(res.questions) && res.questions.length > 0) {
      state.allQuestions.push(...res.questions);
      foundYears.add(res.year);
    }
  });

  state.availableYears = Array.from(foundYears).sort((a, b) => b - a);

  // C. Populate Year Dropdown
  elements.selectedYear.innerHTML = '';
  if (state.availableYears.length > 0) {
    state.availableYears.forEach(yr => {
      const opt = document.createElement('option');
      opt.value = yr;
      const count = state.allQuestions.filter(q => q.year === yr).length;
      opt.textContent = `${yr} (${count} Questions)`;
      elements.selectedYear.appendChild(opt);
    });
  } else {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No question files detected';
    elements.selectedYear.appendChild(opt);
  }
}

// ==========================================
// 3. TIMER LOGIC (90s / Question)
// ==========================================
function startTimer() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    if (!state.isPaused && state.timeRemaining > 0) {
      state.timeRemaining--;
      renderTimer();
      if (state.timeRemaining <= 0) {
        clearInterval(state.timerId);
        handleTestSubmit();
      }
    }
  }, 1000);
}

function renderTimer() {
  const h = String(Math.floor(state.timeRemaining / 3600)).padStart(2, '0');
  const m = String(Math.floor((state.timeRemaining % 3600) / 60)).padStart(2, '0');
  const s = String(state.timeRemaining % 60).padStart(2, '0');
  elements.timerDisplay.textContent = `${h}:${m}:${s}`;
}

// Fullscreen Handler
function toggleFullScreen() {
  const doc = window.document;
  const docEl = doc.documentElement;
  const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
  const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

  if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
    if (req) req.call(docEl).catch(() => {});
    elements.btnFullscreen.textContent = "Exit Fullscreen";
  } else {
    if (exit) exit.call(doc).catch(() => {});
    elements.btnFullscreen.textContent = "Fullscreen";
  }
}

// ==========================================
// 4. QUESTION & PASSAGE RENDERING
// ==========================================
function renderQuestion(index) {
  if (!state.activeQuestions || state.activeQuestions.length === 0) return;
  state.currentIndex = index;
  const q = state.activeQuestions[index];

  // 1. Passage Rendering (Rendered above question with internal scroll)
  if (q.passageid && state.passages[q.passageid]) {
    elements.passageContainer.style.display = 'flex';
    elements.passageText.textContent = state.passages[q.passageid];
    elements.passageText.scrollTop = 0;
  } else {
    elements.passageContainer.style.display = 'none';
  }

  // 2. Question Text & Header
  elements.questionNumber.textContent = `Question ${index + 1} of ${state.activeQuestions.length}`;
  elements.questionText.textContent = q.question;

  // 3. Topic & Source Meta: Strictly visible ONLY in Review Mode
  if (state.isReviewMode) {
    elements.reviewMetaGroup.style.display = 'flex';
    elements.topicTag.textContent = q.topic || 'General Aptitude';
    elements.sourceTag.textContent = `Year: ${q.year || 'N/A'} | PYQ QNo: ${q.qno || (index + 1)}`;
  } else {
    elements.reviewMetaGroup.style.display = 'none';
  }

  // 4. Options
  elements.optionsContainer.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];
  const currentSelected = state.userAnswers[index];

  q.options.forEach((optText, i) => {
    const letter = letters[i];
    const label = document.createElement('label');
    label.className = `option-item ${currentSelected === letter ? 'selected' : ''}`;

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = `opt_q${index}`;
    input.value = letter;
    input.checked = currentSelected === letter;
    input.disabled = state.isReviewMode;

    if (!state.isReviewMode) {
      label.addEventListener('click', () => {
        state.userAnswers[index] = letter;
        renderQuestion(index);
      });
    }

    const span = document.createElement('span');
    span.textContent = `(${letter}) ${optText}`;

    label.appendChild(input);
    label.appendChild(span);
    elements.optionsContainer.appendChild(label);
  });

  // 5. Review Explanation Details
  if (state.isReviewMode) {
    elements.reviewDetails.style.display = 'block';
    const isAnswered = currentSelected !== undefined;
    const isCorrect = currentSelected === q.answer;

    elements.reviewDetails.className = `review-box ${
      !isAnswered ? '' : (isCorrect ? 'review-correct' : 'review-wrong')
    }`;

    elements.userStatusText.textContent = `Your Answer: ${currentSelected ? `(${currentSelected})` : 'Unattempted'}`;
    elements.userStatusText.style.color = isCorrect ? 'var(--green-attempted)' : (isAnswered ? 'var(--red-wrong)' : 'var(--text-muted)');

    elements.correctAnswerText.textContent = `Official UPSC Key: (${q.answer})`;
    elements.correctAnswerText.style.color = 'var(--green-attempted)';

    elements.explanationText.textContent = q.explanation || 'No explanation provided.';
  } else {
    elements.reviewDetails.style.display = 'none';
  }

  renderPalette();
}

// Replace renderPalette() with this clean, sequential builder:
function renderPalette() {
  elements.paletteGrid.innerHTML = '';
  
  if (!state.activeQuestions || state.activeQuestions.length === 0) {
    elements.paletteCount.textContent = '0/0';
    return;
  }

  const fragment = document.createDocumentFragment();
  let attemptedCount = 0;

  state.activeQuestions.forEach((q, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'q-btn';
    btn.textContent = i + 1; // Strictly sequential: 1, 2, 3 ... N

    if (i === state.currentIndex) {
      btn.classList.add('active');
    }

    const userAns = state.userAnswers[i];
    const isAttempted = userAns !== undefined;
    if (isAttempted) attemptedCount++;

    if (!state.isReviewMode) {
      // Pre-submit: Green for attempted, no color for unattempted
      if (isAttempted) btn.classList.add('attempted');
    } else {
      // Review mode: Green for correct, Red for wrong, no color for unattempted
      if (isAttempted) {
        if (userAns === q.answer) btn.classList.add('rev-correct');
        else btn.classList.add('rev-wrong');
      }
    }

    btn.addEventListener('click', () => {
      renderQuestion(i);
    });

    fragment.appendChild(btn);
  });

  elements.paletteGrid.appendChild(fragment);
  elements.paletteCount.textContent = `${attemptedCount}/${state.activeQuestions.length}`;
}

// Clear Response
function clearResponse() {
  if (state.isReviewMode) return;
  delete state.userAnswers[state.currentIndex];
  renderQuestion(state.currentIndex);
}

// ==========================================
// 5. SUBMIT & SCORING
// ==========================================
function showSubmitConfirmation() {
  const attempted = Object.keys(state.userAnswers).length;
  const unattempted = state.activeQuestions.length - attempted;
  elements.submitSummaryStats.textContent = `Attempted: ${attempted} | Unattempted: ${unattempted}`;
  elements.submitModal.style.display = 'flex';
}

function handleTestSubmit() {
  elements.submitModal.style.display = 'none';
  if (state.timerId) clearInterval(state.timerId);

  let correct = 0;
  let wrong = 0;

  state.activeQuestions.forEach((q, idx) => {
    const userChoice = state.userAnswers[idx];
    if (userChoice) {
      if (userChoice === q.answer) correct++;
      else wrong++;
    }
  });

  const total = state.activeQuestions.length;
  const unattempted = total - (correct + wrong);
  const score = (correct * 2.5) - (wrong * (2.5 / 3));
  const maxPossible = total * 2.5;
  const passThreshold = maxPossible * 0.33;
  const isQualified = score >= passThreshold;

  document.getElementById('resTotal').textContent = total;
  document.getElementById('resAttempted').textContent = correct + wrong;
  document.getElementById('resUnattempted').textContent = unattempted;
  document.getElementById('resCorrect').textContent = correct;
  document.getElementById('resWrong').textContent = wrong;
  document.getElementById('resFinalScore').textContent = `${score.toFixed(2)} / ${maxPossible.toFixed(1)}`;

  const statusEl = document.getElementById('resStatus');
  statusEl.textContent = isQualified ? "QUALIFIED (≥ 33%)" : "NOT QUALIFIED (< 33%)";
  statusEl.style.color = isQualified ? "var(--green-attempted)" : "var(--red-wrong)";

  elements.resultModal.style.display = 'flex';
}

// Enter Review Mode
function enterReviewMode() {
  elements.resultModal.style.display = 'none';
  state.isReviewMode = true;

  elements.appHeaderTitle.textContent = "UPSC CSAT Review Mode";
  elements.timerDisplay.textContent = "Review Mode";
  elements.btnPause.style.display = 'none';
  elements.btnSubmitTop.style.display = 'none';
  elements.btnRetakeTop.style.display = 'inline-block';

  elements.attemptActions.style.display = 'none';
  elements.reviewActions.style.display = 'flex';

  elements.paletteLegend.innerHTML = `
    <strong>Review Status:</strong><br>
    Correct: <span style="color: var(--green-attempted); font-weight: bold;">Green</span> | 
    Wrong: <span style="color: var(--red-wrong); font-weight: bold;">Red</span> | 
    Unattempted: <span>No Color</span>
  `;

  renderQuestion(0);
}

// Retake / Reset Test
function resetToStartModal() {
  if (state.timerId) clearInterval(state.timerId);

  state.isReviewMode = false;
  state.currentIndex = 0;
  state.isPaused = false;
  state.userAnswers = {};

  elements.appHeaderTitle.textContent = "UPSC CSAT Mock Test Engine";
  elements.btnPause.style.display = 'inline-block';
  elements.btnPause.textContent = "Pause";
  elements.btnSubmitTop.style.display = 'inline-block';
  elements.btnRetakeTop.style.display = 'none';

  elements.attemptActions.style.display = 'flex';
  elements.reviewActions.style.display = 'none';
  elements.reviewDetails.style.display = 'none';
  elements.reviewMetaGroup.style.display = 'none';

  elements.paletteLegend.innerHTML = `
    <strong>Status:</strong><br>
    Attempted: <span class="legend-attempted">Green</span> | Unattempted: <span>No Color</span>
  `;

  elements.resultModal.style.display = 'none';
  elements.submitModal.style.display = 'none';
  updateConfigLimits();
  elements.startModal.style.display = 'flex';
}

// ==========================================
// 6. POOL SIZING & COUNTER UPDATES
// ==========================================
function getAvailablePoolInfo() {
  const mode = document.querySelector('input[name="mockMode"]:checked').value;
  if (mode === 'yearwise') {
    const yr = parseInt(elements.selectedYear.value, 10);
    const count = state.allQuestions.filter(q => q.year === yr).length;
    return {
      count: count,
      label: yr ? `Year ${yr}` : 'Selected Year'
    };
  }
  return {
    count: state.allQuestions.length,
    label: 'All Available Years Combined'
  };
}

function updateConfigLimits() {
  const mode = document.querySelector('input[name="mockMode"]:checked').value;
  elements.yearSelectorGroup.style.display = (mode === 'yearwise') ? 'block' : 'none';

  const poolInfo = getAvailablePoolInfo();
  const maxQ = Math.max(1, Math.min(80, poolInfo.count || 80));

  // Update inline "out of (x)" counter
  if (elements.poolAvailableCount) {
    elements.poolAvailableCount.textContent = poolInfo.count;
  }

  // Update Input Bounds & Dynamic Placeholder
  elements.qCountLimits.textContent = `1 - ${maxQ}`;
  elements.numQuestionsInput.max = maxQ;
  elements.numQuestionsInput.placeholder = `e.g. 1 - ${maxQ}`;

  let currentVal = parseInt(elements.numQuestionsInput.value, 10);
  if (isNaN(currentVal) || currentVal < 1 || currentVal > maxQ) {
    currentVal = maxQ;
    elements.numQuestionsInput.value = currentVal;
  }

  updateTimerHint(currentVal);
}

function updateTimerHint(qCount) {
  const count = (!qCount || qCount < 1) ? 1 : qCount;
  const totalSeconds = count * 90;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const timeText = secs > 0 ? `${mins}m ${secs}s` : `${mins} minutes`;
  elements.timerEstimateHint.textContent = `Calculated duration: ${timeText} (90s / question)`;
}

// ==========================================
// 7. EVENT HANDLERS
// ==========================================
function setupEventListeners() {
  elements.btnFullscreen.addEventListener('click', toggleFullScreen);

  elements.btnPause.addEventListener('click', () => {
    state.isPaused = !state.isPaused;
    elements.btnPause.textContent = state.isPaused ? "Resume" : "Pause";
  });

  elements.btnSubmitTop.addEventListener('click', showSubmitConfirmation);
  elements.btnCancelSubmit.addEventListener('click', () => {
    elements.submitModal.style.display = 'none';
  });
  elements.btnConfirmSubmit.addEventListener('click', handleTestSubmit);
  elements.btnEnterReview.addEventListener('click', enterReviewMode);
  elements.btnRetakeTop.addEventListener('click', resetToStartModal);

  elements.btnClear.addEventListener('click', clearResponse);

  elements.btnSaveNext.addEventListener('click', () => {
    if (state.currentIndex < state.activeQuestions.length - 1) {
      renderQuestion(state.currentIndex + 1);
    }
  });

  elements.btnNext.addEventListener('click', () => {
    if (state.currentIndex < state.activeQuestions.length - 1) {
      renderQuestion(state.currentIndex + 1);
    }
  });

  elements.btnPrev.addEventListener('click', () => {
    if (state.currentIndex > 0) {
      renderQuestion(state.currentIndex - 1);
    }
  });

  // Radio mode & Year selector changes
  document.querySelectorAll('input[name="mockMode"]').forEach(radio => {
    radio.addEventListener('change', updateConfigLimits);
  });
  elements.selectedYear.addEventListener('change', updateConfigLimits);

  // Typeable input: updates hint as you type
  elements.numQuestionsInput.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1) {
      updateTimerHint(val);
    }
  });

  // On blur: clamp within [1, maxQ]
  elements.numQuestionsInput.addEventListener('blur', (e) => {
    const poolInfo = getAvailablePoolInfo();
    const maxQ = Math.max(1, Math.min(80, poolInfo.count || 80));
    let val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    if (val > maxQ) val = maxQ;
    e.target.value = val;
    updateTimerHint(val);
  });

  // Start Exam Confirmed
  elements.btnStartConfirmed.addEventListener('click', () => {
    const mode = document.querySelector('input[name="mockMode"]:checked').value;
    let pool = [...state.allQuestions];

    if (mode === 'yearwise') {
      const yr = parseInt(elements.selectedYear.value, 10);
      pool = pool.filter(q => q.year === yr);
    } else {
      pool.sort(() => Math.random() - 0.5);
    }

    const maxQ = Math.max(1, Math.min(80, pool.length));
    let requestedCount = parseInt(elements.numQuestionsInput.value, 10);
    
    // Bounds validation
    if (isNaN(requestedCount) || requestedCount < 1) requestedCount = 1;
    if (requestedCount > maxQ) requestedCount = maxQ;

    elements.numQuestionsInput.value = requestedCount;
    state.activeQuestions = pool.slice(0, requestedCount);
    state.timeRemaining = requestedCount * 90;

    elements.startModal.style.display = 'none';
    renderQuestion(0);
    startTimer();
  });
}

// Initialization
async function init() {
  setupEventListeners();
  await loadTestData();
  updateConfigLimits();
}

window.addEventListener('DOMContentLoaded', init);
