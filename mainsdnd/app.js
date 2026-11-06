let rawMonthData = [];
let availableMonths = [];

const searchInput = document.getElementById('search-input');
const monthSelect = document.getElementById('month-select');
const dateInput = document.getElementById('date-input');

const articlesContainer = document.getElementById('articles-container');
const mainsContainer = document.getElementById('mains-container');
const tabBtns = document.querySelectorAll('.tab-btn');

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initApp();
});

function setupEventListeners() {
    searchInput.addEventListener('input', renderViews);
    dateInput.addEventListener('change', renderViews);
    
    monthSelect.addEventListener('change', (e) => {
        if (e.target.value) {
            loadMonthData(e.target.value, true);
        }
    });

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const view = btn.getAttribute('data-view');
            if (view === 'articles') {
                articlesContainer.classList.remove('hidden');
                mainsContainer.classList.add('hidden');
            } else {
                articlesContainer.classList.add('hidden');
                mainsContainer.classList.remove('hidden');
            }
        });
    });
}

// 1. Fetch manifest of month keys
async function initApp() {
    try {
        const response = await fetch('./data/index.json');
        if (!response.ok) throw new Error('Could not fetch data/index.json');
        
        availableMonths = await response.json();
        
        if (availableMonths.length === 0) {
            monthSelect.innerHTML = `<option value="">No months found</option>`;
            return;
        }

        monthSelect.innerHTML = availableMonths.map(m => `
            <option value="${m}">${formatMonthLabel(m)}</option>
        `).join('');

        loadMonthData(availableMonths[0], true);
    } catch (err) {
        monthSelect.innerHTML = `<option value="">Error loading index.json</option>`;
        articlesContainer.innerHTML = `<div class="card loading-text">Failed to initialize manifest.</div>`;
    }
}

// 2. Fetch selected month's JSON and pick the latest available date on initial load
async function loadMonthData(monthKey, setLatestDate = false) {
    articlesContainer.innerHTML = `<div class="card loading-text">Loading data for ${monthKey}...</div>`;
    try {
        const response = await fetch(`./data/${monthKey}.json`);
        if (!response.ok) throw new Error(`data/${monthKey}.json not found`);
        
        rawMonthData = await response.json(); // Array of days
        
        if (setLatestDate && rawMonthData.length > 0) {
            // Sort days descending to set the initial date picker to the latest day
            const sortedDays = [...rawMonthData].sort((a, b) => b.date.localeCompare(a.date));
            dateInput.value = sortedDays[0].date;
        }

        renderViews();
    } catch (err) {
        rawMonthData = [];
        articlesContainer.innerHTML = `<div class="card loading-text">No file found for <code>data/${monthKey}.json</code>.</div>`;
        mainsContainer.innerHTML = articlesContainer.innerHTML;
    }
}

// 3. Smart Filter Logic:
// - If search is active: Search the entire month sorted newest to oldest.
// - If search is empty: Restrict to selected date.
function monthDataMapper(data, targetDate, query) {
    // Sort month days in descending order (newest date first)
    const sortedData = [...data].sort((a, b) => b.date.localeCompare(a.date));

    return sortedData.map(dayGroup => {
        // If NO search query is typed, strictly filter by selected date
        if (!query && targetDate && dayGroup.date !== targetDate) {
            return null;
        }

        if (!dayGroup.articles) return null;

        const matchedArticles = dayGroup.articles.filter(article => {
            if (!query) return true;
            return article.topic.toLowerCase().includes(query) || 
                   article.summary.toLowerCase().includes(query);
        });

        if (matchedArticles.length === 0) return null;

        return {
            date: dayGroup.date,
            articles: matchedArticles
        };
    }).filter(Boolean);
}

function renderViews() {
    const query = searchInput.value.trim().toLowerCase();
    const selectedDate = dateInput.value;
    const filteredData = monthDataMapper(rawMonthData, selectedDate, query);

    renderArticles(filteredData, query);
    renderMains(filteredData, query);
}

function renderArticles(data, query) {
    if (data.length === 0) {
        articlesContainer.innerHTML = `<div class="card loading-text">${query ? 'No matching articles found in this month.' : 'No articles found for the selected date.'}</div>`;
        return;
    }

    articlesContainer.innerHTML = data.map(day => `
        <div class="day-group">
            <div class="day-header">
                <span><i class="fa-regular fa-calendar"></i> ${formatDate(day.date)}</span>
                <span class="badge">${day.articles.length} Article${day.articles.length > 1 ? 's' : ''}</span>
            </div>
            <div class="day-feed">
                ${day.articles.map(art => `
                    <div class="article-card">
                        <div class="article-header">
                            <span class="badge">${art.gs_paper}</span>
                        </div>
                        <h4 class="article-title">${art.topic}</h4>
                        <p class="article-summary">${art.summary}</p>
                        ${art.mainsquestion ? `
                            <div class="mains-box">
                                <strong>Mains Question:</strong> ${art.mainsquestion}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function renderMains(data, query) {
    const mainsList = [];
    data.forEach(day => {
        if (day.articles) {
            day.articles.forEach(art => {
                if (art.mainsquestion) {
                    mainsList.push({
                        date: day.date,
                        gs: art.gs_paper,
                        topic: art.topic,
                        question: art.mainsquestion
                    });
                }
            });
        }
    });

    if (mainsList.length === 0) {
        mainsContainer.innerHTML = `<div class="card loading-text">${query ? 'No matching Mains questions found in this month.' : 'No Mains practice questions found for current selection.'}</div>`;
        return;
    }

    mainsContainer.innerHTML = `
        <div class="day-group">
            <div class="day-header">
                <span><i class="fa-solid fa-pen-nib"></i> Mains Practice Questions</span>
                <span class="badge">${mainsList.length} Question${mainsList.length > 1 ? 's' : ''}</span>
            </div>
            <div class="day-feed">
                ${mainsList.map((item, idx) => `
                    <div class="article-card">
                        <div class="article-header">
                            <span class="badge">${item.gs}</span>
                            <span class="badge" style="background-color: var(--border-color);">${formatDate(item.date)}</span>
                        </div>
                        <h4 class="article-title">Q${idx + 1}. ${item.question}</h4>
                        <p class="article-summary"><strong>Context:</strong> ${item.topic}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
}

function formatMonthLabel(monthKey) {
    const [year, month] = monthKey.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
