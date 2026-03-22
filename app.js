// State
const state = {
    apiKey: localStorage.getItem('gemini_api_key') || '',
    mode: null, // 'character' or 'idiom'
    questionCount: 20,
    scopeType: 'builtin', // 'builtin', 'text' or 'image'
    scopeContent: null, // String or File on start
    questions: [],
    currentQuestionIndex: 0,
    mistakes: [],
    totalMistakesCount: 0
};

// DOM Elements
const views = {
    dashboard: document.getElementById('view-dashboard'),
    setup: document.getElementById('view-setup'),
    quiz: document.getElementById('view-quiz'),
    results: document.getElementById('view-results')
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    renderBuiltInList();
});

function renderBuiltInList() {
    const listContainer = document.getElementById('builtin-list');
    if (!listContainer || typeof builtInTextbooks === 'undefined') return;

    let html = '';
    builtInTextbooks.forEach(lesson => {
        html += `
            <label class="builtin-item">
                <input type="checkbox" value="${lesson.id}" class="builtin-checkbox">
                <div class="builtin-info">
                    <span class="builtin-badge">${lesson.publisher} ${lesson.grade}</span>
                    <span class="builtin-title">${lesson.lesson}：${lesson.title}</span>
                </div>
            </label>
        `;
    });
    listContainer.innerHTML = html;
}

function initEventListeners() {
    // Settings Modal
    const modalSettings = document.getElementById('modal-settings');
    const inputApiKey = document.getElementById('api-key');

    document.getElementById('btn-settings').addEventListener('click', () => {
        inputApiKey.value = state.apiKey;
        modalSettings.classList.add('active');
    });

    document.querySelector('.close-btn').addEventListener('click', () => {
        modalSettings.classList.remove('active');
    });

    document.getElementById('btn-save-settings').addEventListener('click', () => {
        const key = inputApiKey.value.trim();
        if (key) {
            state.apiKey = key;
            localStorage.setItem('gemini_api_key', key);
            modalSettings.classList.remove('active');
            showToast('設定已儲存！');
        } else {
            showToast('請輸入 API Key');
        }
    });

    // Dashboard Mode Selection
    document.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const mode = e.currentTarget.dataset.mode;
            state.mode = mode;
            let title = '';
            if (mode === 'character') title = '生字語詞練習設定';
            else if (mode === 'idiom') title = '成語練習設定';
            else if (mode === 'rhetoric') title = '修辭練習設定';
            document.getElementById('setup-title').textContent = title;
            switchView('setup');
        });
    });

    // Setup View - Back
    document.querySelector('.back-btn').addEventListener('click', () => {
        switchView('dashboard');
    });

    // Setup View - Range Slider
    const countSlider = document.getElementById('question-count');
    const countDisplay = document.getElementById('question-count-display');
    countSlider.addEventListener('input', (e) => {
        state.questionCount = parseInt(e.target.value);
        countDisplay.textContent = `${state.questionCount} 題`;
    });

    // Setup View - Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            const target = e.target;
            target.classList.add('active');
            state.scopeType = target.dataset.tab;
            document.getElementById(`tab-${state.scopeType}`).classList.add('active');
        });
    });

    // Setup View - Image Upload Preview
    const fileInput = document.getElementById('scope-image');
    const preview = document.getElementById('image-preview');
    const placeholder = document.querySelector('.upload-placeholder');

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            state.scopeContent = file;
            const reader = new FileReader();
            reader.onload = function (e) {
                preview.src = e.target.result;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
            }
            reader.readAsDataURL(file);
        }
    });

    // Setup View - Start
    document.getElementById('btn-start-practice').addEventListener('click', handleStartPractice);

    // Results - Home
    document.getElementById('btn-home').addEventListener('click', () => {
        switchView('dashboard');
    });
}

function switchView(viewName) {
    Object.values(views).forEach(view => view.classList.remove('active'));
    views[viewName].classList.add('active');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

async function handleStartPractice() {
    if (!state.apiKey) {
        showToast('請先點擊右上角設定 API Key');
        document.getElementById('modal-settings').classList.add('active');
        return;
    }



    if (state.scopeType === 'builtin') {
        const checkedBoxes = document.querySelectorAll('.builtin-checkbox:checked');
        if (checkedBoxes.length === 0) {
            showToast('請至少選擇一課內容');
            return;
        }
        let combinedText = '';
        checkedBoxes.forEach(cb => {
            const lesson = builtInTextbooks.find(L => L.id === cb.value);
            if (lesson) {
                combinedText += lesson.content + '\n\n---\n\n';
            }
        });
        state.scopeContent = combinedText.trim();
    } else if (state.scopeType === 'text') {
        state.scopeContent = document.getElementById('scope-text').value.trim();
        if (!state.scopeContent) {
            showToast('請輸入練習範圍內容');
            return;
        }
    } else if (state.scopeType === 'image' && !state.scopeContent) {
        showToast('請上傳圖片');
        return;
    }

    document.getElementById('btn-start-practice').style.display = 'none';
    document.getElementById('loading-indicator').style.display = 'block';

    try {
        const questions = await fetchQuestionsFromGemini();

        if (!questions || questions.length === 0) {
            throw new Error('無法產生題目，請重試或換一個範圍內容。');
        }

        state.questions = questions;
        state.currentQuestionIndex = 0;
        state.mistakes = [];
        state.totalMistakesCount = 0;

        switchView('quiz');
        renderQuestion();

    } catch (error) {
        console.error(error);
        showToast('生成題目失敗：' + error.message);
    } finally {
        document.getElementById('btn-start-practice').style.display = 'flex';
        document.getElementById('loading-indicator').style.display = 'none';
    }
}

async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            let encoded = reader.result.toString().replace(/^data:(.*,)?/, '');
            if ((encoded.length % 4) > 0) {
                encoded += '='.repeat(4 - (encoded.length % 4));
            }
            resolve(encoded);
        };
        reader.onerror = error => reject(error);
    });
}

function getGeminiPrompt() {
    const count = state.questionCount;
    if (state.mode === 'character') {
        return `你是一個國語家教。請根據提供的範圍，出 ${count} 題「生字語詞」練習題。
【嚴格要求】：
- 包含一定比例的「語詞配對大題」(idiom_matching) 與「單題選擇」(multiple_choice)。
- 測驗語詞的含義，包含近義詞與反義詞的辨析，選項中必須包含相似或相反意思的語詞。
- 每一題都要有詳細的解答說明。

請回傳單純的 JSON 陣列格式，陣列元素必須是以下兩種結構之一：
1. 單題選擇：
{
  "type": "multiple_choice",
  "question": "題目描述",
  "options": ["選項1", "選項2", "選項3", "選項4"],
  "answer": 正確選項的索引(0~3的整數),
  "explanation": "正確解答的解釋，並且『必須』逐一說明這四個選項的意思"
}

2. 語詞配對大題：
{
  "type": "idiom_matching",
  "options": ["選項語詞1", "選項語詞2", "選項語詞3", ...],
  "hints": { "選項語詞1": "解釋", "選項語詞2": "解釋", ... },
  "sentences": [
    { "text": "句子內容，要填空的地方請用___表示", "answer": "正確選項語詞", "explanation": "說明" }
  ]
}

回傳：
[ ... ]`;
    } else if (state.mode === 'idiom') {
        return `你是一個國語家教。請根據提供內容設計「成語」練習題。共 ${count} 題。
【嚴格要求】：
- 測驗成語的含義，選項中可包含近義詞與反義詞作為干擾。
- 請混合使用「成語配對大題」(idiom_matching) 與「成語單選題」(multiple_choice)。

請回傳單純的 JSON 陣列格式，陣列元素必須是以下兩種結構之一：
1. 單題選擇：
{
  "type": "multiple_choice",
  "question": "單一成語題目（如：下列何者與某成語意思相近？）",
  "options": ["成語1", "成語2", "成語3", "成語4"],
  "answer": 正確選項的索引(0~3的整數),
  "explanation": "正確解答的解釋，並且『必須』逐一說明這四個選項中每個成語的意思"
}

2. 成語配對大題：
{
  "type": "idiom_matching",
  "options": ["成語1", "成語2", "成語3", ...],
  "hints": { "成語1": "成語解釋", "成語2": "成語解釋", ... },
  "sentences": [
    { "text": "句子內容，要填空的地方請用___表示", "answer": "正確成語", "explanation": "該句中成語用法的說明" }
  ]
}

回傳：
[ ... ]`;
    } else if (state.mode === 'rhetoric') {
        return `你是一個國語家教。請根據提供的範圍(課文或文章)，設計「修辭練習」測驗。
【修辭範圍】：包含譬喻、擬人、排比、誇飾、設問、感嘆、映襯、層遞、雙關、借代等。
出 ${count} 題選擇題。每一題的 explanation (解答說明) 必須清楚指出各選項分別使用了什麼修辭。

請回傳單純的 JSON 陣列格式，陣列元素為以下結構：
{
  "type": "multiple_choice",
  "question": "題目描述",
  "options": ["選項1", "選項2", "選項3", "選項4"],
  "answer": 正確選項的索引(0~3的整數),
  "explanation": "詳細說明每個選項對應的修辭手法與原因"
}

回傳：
[ ... ]`;
    }
}

async function fetchQuestionsFromGemini() {
    if (state.apiKey === 'TEST') {
        await new Promise(r => setTimeout(r, 1000)); // Simulate delay
        if (state.mode === 'character') {
            return [
                {
                    "type": "multiple_choice",
                    "question": "下列哪一個語詞的意思與「勤奮」最為【相反】？",
                    "options": ["努力", "懶散", "認真", "打拼"],
                    "answer": 1,
                    "explanation": "勤奮：努力而不懈。懶散：懶惰散漫。兩者意思相反。"
                }
            ];
        } else if (state.mode === 'idiom') {
            return [
                {
                    "type": "multiple_choice",
                    "question": "「這間老屋經過翻修後，給人一種____的感覺。」空格中填入哪一個成語最恰當？",
                    "options": ["煥然一新", "因小失大", "一塵不染", "各有千秋"],
                    "answer": 0,
                    "explanation": "煥然一新：形容景象完全改變，呈現出清新的氣象。適合用在翻修後的老屋。"
                }
            ];
        } else if (state.mode === 'rhetoric') {
            return [
                {
                    "type": "multiple_choice",
                    "question": "「我游水像一艘白色遊艇」這句話使用了哪一種修辭手法？",
                    "options": ["擬人", "譬喻", "誇飾", "排比"],
                    "answer": 1,
                    "explanation": "原句中用「像」將「我(鵝)」比作「遊艇」，屬於譬喻法。"
                }
            ];
        }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.apiKey}`;

    let parts = [];
    const prompt = getGeminiPrompt();
    parts.push({ text: prompt });

    if (state.scopeType === 'text' || state.scopeType === 'builtin') {
        parts.push({ text: "\n\n練習範圍內容如下：\n" + state.scopeContent });
    } else if (state.scopeType === 'image') {
        const base64Image = await fileToBase64(state.scopeContent);
        parts.push({
            inlineData: {
                mimeType: state.scopeContent.type,
                data: base64Image
            }
        });
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{ parts: parts }],
            generationConfig: {
                temperature: 0.7,
                responseMimeType: "application/json"
            }
        })
    });

    if (!response.ok) {
        const err = await response.json();
        let msg = (err.error && err.error.message) ? err.error.message : 'API 請求失敗';
        if (msg.includes('Quota exceeded') || response.status === 429) {
            msg = 'API 免費使用次數達上限，請等待約 1 分鐘後再重試';
        }
        throw new Error(msg);
    }

    const data = await response.json();
    let textObj = data.candidates[0].content.parts[0].text;

    // Attempt to parse JSON
    let parsed;
    try {
        parsed = JSON.parse(textObj);
    } catch (e) {
        console.error("Failed to parse JSON directly. Attempting to clean markdown text.");
        textObj = textObj.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(textObj);
    }

    // Ensure we always return an array
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return [parsed];
    }
    return parsed;
}

function renderQuestion() {
    const contentDiv = document.getElementById('quiz-content');
    const q = state.questions[state.currentQuestionIndex];
    const isMistakeRepetition = q.isMistake;

    // Update header stats
    let totalCurrentQueue = state.questions.length;
    document.getElementById('question-counter').textContent = `題 ${state.currentQuestionIndex + 1} / ${totalCurrentQueue}`;
    document.getElementById('mistake-counter').innerHTML = `<i class="fas fa-times-circle"></i> ${state.totalMistakesCount}`;

    const progress = ((state.currentQuestionIndex) / totalCurrentQueue) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;

    let html = `
        <h3 class="question-title ${isMistakeRepetition ? 'text-red' : ''}">
            ${isMistakeRepetition ? '<i class="fas fa-redo"></i> 錯題複習：' : ''}${q.question}
        </h3>
    `;

    if (q.type === 'multiple_choice') {
        html += `<div class="options-container">`;
        q.options.forEach((opt, idx) => {
            html += `<button class="option-btn" data-index="${idx}">${opt}</button>`;
        });
        html += `</div>`;
    } else if (q.type === 'idiom_matching') {
        let sentencesHtml = q.sentences.map((s, idx) => {
            let textHtml = s.text.replace(/___/g, `<span class="idiom-slot" data-slot-id="slot-${idx}" id="slot-${idx}"></span>`);
            return `<div class="sentence-row">
                        <span class="sentence-number">${idx + 1}.</span> 
                        <span class="sentence-text">${textHtml}</span>
                    </div>`;
        }).join('');

        let hintsHtml = '';
        if (q.hints) {
            hintsHtml = Object.entries(q.hints)
                .map(([word, hint]) => `<p><strong>${word}</strong>：${hint}</p>`)
                .join('');
        }

        const label = state.mode === 'idiom' ? '成語' : '語詞';
        html = `
            <div class="idiom-exercise-container">
                <div class="word-bank-header">
                    <h3>請點選下方${label}來填入句子空格中：</h3>
                    <button id="btn-idiom-hints" class="icon-btn textbook-hint-btn"><i class="fas fa-lightbulb"></i> ${label}解釋</button>
                </div>
                
                <div class="word-bank">
                    ${q.options.map((opt, idx) => `<button class="word-bank-item" id="bank-opt-${idx}" data-word="${opt}">${opt}</button>`).join('')}
                </div>

                <div id="idiom-hints-panel" class="hints-panel" style="display:none;">
                    <h4>📚 ${label}小百科</h4>
                    <div class="hints-grid">
                        ${hintsHtml}
                    </div>
                </div>

                <div class="sentences-list">
                    ${sentencesHtml}
                </div>
            </div>
            <div class="action-row">
                <button id="btn-submit-idiom" class="primary-btn pulse-animation">批改答案</button>
            </div>
            <div id="feedback-container" class="feedback-box" style="display:none;"></div>
            <div class="action-row" id="next-action-row" style="display:none;">
                <button id="btn-next" class="primary-btn pulse-animation">下一題 <i class="fas fa-arrow-right"></i></button>
            </div>
        `;
        contentDiv.innerHTML = html;
        initIdiomInteraction(q);
        return; // Early return as interaction is handled separately

    }

    html += `
        <div id="feedback-container" class="feedback-box" style="display:none;"></div>
        <div class="action-row" style="display:none;">
            <button id="btn-next" class="primary-btn">下一題 <i class="fas fa-arrow-right"></i></button>
        </div>
    `;

    contentDiv.innerHTML = html;

    // Attach events based on type
    if (q.type === 'multiple_choice') {
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('click', handleOptionClick);
        });
    }
}

function handleOptionClick(e) {
    if (document.querySelector('.option-btn.selected')) return; // already answered

    const selectedBtn = e.target;
    const selectedIndex = parseInt(selectedBtn.dataset.index);
    const q = state.questions[state.currentQuestionIndex];
    const isCorrect = selectedIndex === q.answer;

    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.disabled = true;
        if (parseInt(btn.dataset.index) === q.answer) {
            btn.classList.add('correct');
        }
    });

    selectedBtn.classList.add('selected');
    if (!isCorrect) {
        selectedBtn.classList.add('wrong');

        // Record mistake if this is not already a mistake loop
        if (!q.isMistake) {
            state.totalMistakesCount++;
            document.getElementById('mistake-counter').innerHTML = `<i class="fas fa-times-circle"></i> ${state.totalMistakesCount}`;
            // Add a clone to mistakes array to be pushed later
            state.mistakes.push({ ...q, isMistake: true });
        } else {
            // If they got the mistake wrong AGAIN, add it to mistakes again!
            state.mistakes.push({ ...q, isMistake: true });
        }
    }

    showFeedback(isCorrect, q.explanation);
}

function initIdiomInteraction(q) {
    let selectedWordBtn = null;
    let filledSlots = {}; // slotId -> wordBtn

    const bankItems = document.querySelectorAll('.word-bank-item');
    const slots = document.querySelectorAll('.idiom-slot');
    const submitBtn = document.getElementById('btn-submit-idiom');
    const hintBtn = document.getElementById('btn-idiom-hints');
    const hintPanel = document.getElementById('idiom-hints-panel');

    if (hintBtn && hintPanel) {
        hintBtn.addEventListener('click', () => {
            const isHidden = hintPanel.style.display === 'none';
            if (isHidden) {
                hintPanel.style.display = 'block';
                hintBtn.classList.add('active-hint');
            } else {
                hintPanel.style.display = 'none';
                hintBtn.classList.remove('active-hint');
            }
        });
    }

    bankItems.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (btn.classList.contains('used')) return;

            // Deselect previous
            if (selectedWordBtn) {
                selectedWordBtn.classList.remove('selected');
            }

            // Select new
            if (selectedWordBtn !== btn) {
                btn.classList.add('selected');
                selectedWordBtn = btn;
            } else {
                selectedWordBtn = null; // Toggle off
            }
        });
    });

    slots.forEach((slot, index) => {
        slot.addEventListener('click', () => {
            // If clicking a filled slot, remove the word and return it to bank
            if (slot.classList.contains('filled')) {
                const associatedBtn = filledSlots[slot.id];
                associatedBtn.classList.remove('used');
                slot.textContent = '';
                slot.classList.remove('filled');
                delete filledSlots[slot.id];
            }
            // If clicking an empty slot with a word selected in bank, fill it
            else if (selectedWordBtn) {
                slot.textContent = selectedWordBtn.dataset.word;
                slot.classList.add('filled');
                selectedWordBtn.classList.remove('selected');
                selectedWordBtn.classList.add('used');
                filledSlots[slot.id] = selectedWordBtn;
                selectedWordBtn = null;
            }
        });
    });

    submitBtn.addEventListener('click', () => {
        const totalBlanks = q.sentences.length;
        if (Object.keys(filledSlots).length < totalBlanks) {
            showToast('請將所有空格填滿再交卷喔！');
            return;
        }

        submitBtn.style.display = 'none';

        let allCorrect = true;
        let explanationHtml = '<div class="idiom-explanations">';

        slots.forEach((slot, index) => {
            const userAnswer = slot.textContent;
            const correctAnswer = q.sentences[index].answer;
            const isSlotCorrect = userAnswer === correctAnswer;

            if (isSlotCorrect) {
                slot.classList.add('correct');
            } else {
                slot.classList.add('wrong');
                slot.innerHTML = `<del>${userAnswer}</del> <span class="text-green">${correctAnswer}</span>`;
                allCorrect = false;

                // 針對錯的特別說明意思
                explanationHtml += `
            <div class="explanation-item wrong-answer-bg" style="margin-bottom: 1rem; border-radius: 8px; padding: 1rem;">
                        <h4 class="text-red"><i class="fas fa-exclamation-triangle"></i> 第 ${index + 1} 題</h4>
                        <p><strong>正確解答：<span class="text-green">${correctAnswer}</span></strong></p>
                        <p>${q.sentences[index].explanation}</p>
                    </div>
            `;
            }
        });
        explanationHtml += '</div>';

        if (!allCorrect) {
            state.totalMistakesCount++;
            document.getElementById('mistake-counter').innerHTML = `<i class="fas fa-times-circle"></i> ${state.totalMistakesCount}`;
            // If it's not currently a mistake reprint, add it to queue
            if (!q.isMistake) {
                state.mistakes.push({ ...q, isMistake: true });
            } else {
                state.mistakes.push({ ...q, isMistake: true });
            }
        }

        const feedbackDiv = document.getElementById('feedback-container');
        feedbackDiv.style.display = 'block';

        let headerMessage = allCorrect ? '成語配對全對！太棒了！' : '有些成語用錯囉！請看下方的訂正說明。';

        feedbackDiv.innerHTML = `
            <div class="feedback-card ${allCorrect ? 'bg-green-light' : 'bg-red-light'}">
                <div class="feedback-icon text-${allCorrect ? 'green' : 'red'}">
                    <i class="fas fa-${allCorrect ? 'check-circle' : 'times-circle'}"></i>
                    ${headerMessage}
                </div>
            </div>
            ${!allCorrect ? explanationHtml : ''}
        `;

        document.getElementById('next-action-row').style.display = 'flex';
        document.getElementById('btn-next').addEventListener('click', nextQuestion, { once: true });

        // Disable bank items and slots
        bankItems.forEach(b => b.classList.add('disabled'));
        slots.forEach(s => s.classList.add('disabled'));

        // Disable hint button to clean up UI
        if (hintBtn) {
            hintBtn.disabled = true;
            hintPanel.style.display = 'none';
        }
    });
}

function showFeedback(isCorrect, explanation) {
    const feedbackDiv = document.getElementById('feedback-container');
    feedbackDiv.style.display = 'block';

    let fbHtml = `
            <div class="feedback-card ${isCorrect ? 'bg-green-light' : 'bg-red-light'}">
                <div class="feedback-icon text-${isCorrect ? 'green' : 'red'}">
                    <i class="fas fa-${isCorrect ? 'check-circle' : 'times-circle'}"></i>
                    ${isCorrect ? '答對了！' : '答錯了喔！'}
                </div>
            ${explanation ? `<div class="explanation-text">${explanation}</div>` : ''}
        </div>
            `;

    // Append feedback
    feedbackDiv.innerHTML = fbHtml;

    const actionRow = document.querySelector('.action-row');
    actionRow.style.display = 'block';

    document.getElementById('btn-next').addEventListener('click', nextQuestion, { once: true });
}

function nextQuestion() {
    state.currentQuestionIndex++;

    if (state.currentQuestionIndex < state.questions.length) {
        renderQuestion();
    } else {
        // Queue finished. Check mistakes.
        if (state.mistakes.length > 0) {
            // Add mistakes to queue and reset index
            state.questions = [...state.mistakes];
            state.mistakes = [];
            state.currentQuestionIndex = 0;

            showToast('接下來複習剛剛答錯的題目！');
            renderQuestion();
        } else {
            // Completely finished!
            finishPractice();
        }
    }
}

function finishPractice() {
    document.getElementById('res-total').textContent = state.questionCount;
    document.getElementById('res-mistakes').textContent = state.totalMistakesCount;

    if (state.totalMistakesCount === 0) {
        document.getElementById('res-message').textContent = '太棒了！你一次就全對了，你是小天才！🌟';
    } else {
        document.getElementById('res-message').textContent = `經過重覆練習，你已經把 ${state.totalMistakesCount} 個錯誤都學會了！進步很大喔！💪`;
    }

    switchView('results');
}
