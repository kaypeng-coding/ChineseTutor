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
            else if (mode === 'exam') title = '考古題複習設定';
            document.getElementById('setup-title').textContent = title;
            
            if (mode === 'exam') {
                const imgTabBtn = document.querySelector('.tab-btn[data-tab="image"]');
                if (imgTabBtn) imgTabBtn.click();
                document.querySelector('.tab-btn[data-tab="builtin"]').style.display = 'none';
                document.querySelector('.tab-btn[data-tab="text"]').style.display = 'none';

                const qCountWrap = document.querySelector('.count-selector').closest('.form-group');
                if (qCountWrap) qCountWrap.style.display = 'none';
            } else {
                const builtinTabBtn = document.querySelector('.tab-btn[data-tab="builtin"]');
                if (builtinTabBtn) builtinTabBtn.click();
                document.querySelector('.tab-btn[data-tab="builtin"]').style.display = '';
                document.querySelector('.tab-btn[data-tab="text"]').style.display = '';

                const qCountWrap = document.querySelector('.count-selector').closest('.form-group');
                if (qCountWrap) qCountWrap.style.display = '';
            }
            
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
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            state.scopeContent = files;
            preview.style.display = 'none';
            placeholder.style.display = 'none';
            
            let container = document.getElementById('image-preview-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'image-preview-container';
                container.style.display = 'flex';
                container.style.flexWrap = 'wrap';
                container.style.gap = '10px';
                container.style.marginTop = '10px';
                placeholder.parentElement.appendChild(container);
            }
            container.innerHTML = '';
            container.style.display = 'flex';
            
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.style.maxWidth = '100px';
                    img.style.maxHeight = '100px';
                    img.style.borderRadius = 'var(--radius-sm)';
                    img.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                    img.style.objectFit = 'cover';
                    container.appendChild(img);
                }
                reader.readAsDataURL(file);
            });
        }
    });

    // Setup View - Start
    document.getElementById('btn-start-practice').addEventListener('click', handleStartPractice);

    // Results - Home
    document.getElementById('btn-home').addEventListener('click', () => {
        switchView('dashboard');
    });

    // Quiz View - Home
    const btnQuitQuiz = document.getElementById('btn-quit-quiz');
    if (btnQuitQuiz) {
        btnQuitQuiz.addEventListener('click', () => {
            if (confirm('確定要結束目前的測驗，返回首頁嗎？')) {
                switchView('dashboard');
            }
        });
    }

    // Logo Click to Home
    const logoEl = document.querySelector('.logo');
    if (logoEl) {
        logoEl.style.cursor = 'pointer';
        logoEl.addEventListener('click', () => {
            if (document.getElementById('view-quiz').classList.contains('active')) {
                if (confirm('確定要結束目前的測驗，返回首頁嗎？')) {
                    switchView('dashboard');
                }
            } else {
                switchView('dashboard');
            }
        });
    }
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
    let avoidanceContext = '';
    try {
        const mastered = JSON.parse(localStorage.getItem('chinese_tutor_mastered') || '[]');
        if (mastered.length > 0) {
            avoidanceContext = `\n【降低重複率提示】：\n學生前幾次已經正確回答過提及以下焦點的題目，請「盡量避開」同樣的考點或原句，多出一些「新的、不一樣的」生字與語詞：\n${mastered.map(m => `"${m}"`).join(', ')}\n`;
        }
    } catch(e) {}

    let phoneticContext = `\n【注音標示嚴格規範】：\n題目或解析若需標示發音，【絕對不可】使用羅馬字或漢語拼音（如 tiáo jiě），請【一律強制使用台灣標準注音符號】（例如 ㄊㄧㄠˊ ㄐㄧㄝˇ）。\n`;

    if (state.mode === 'character') {
        return `你是一個國語家教。請根據提供的範圍，出 ${count} 題「生字語詞」測驗題。${avoidanceContext}${phoneticContext}
【出題類別要求（請盡量均勻分配下列幾種題型，並模擬小學段考考古題的難度和格式）】：
1. 改錯字題：給出包含幾個錯別字的一句話，找出錯誤並選擇正確的字。
2. 同音/形近字辨析：例如「下列哪一個選項用字完全正確？」或是給出注音要求選出對應的字。
3. 語詞意思與運用：測驗語詞的正確含義，或是「這個語詞的意思為何？」。
4. 句子挖空選擇題：請選出最適合填入空格中的字或語詞。
5. 多音字測驗：選出引號中注音相同或不同的選項。
6. 字義測驗：例如引號中的字，哪一個意思與其他三個不同？

【嚴格禁止事項】：
- 絕對【不需要、也不可以】出跟成語相關的題目。本模式專注於單個生字與一般語詞。
- 絕對【不能】自己發明或生造不存在的語詞！這非常嚴重！例如：絕對禁止把「乾淨」或「乾乾淨淨」硬改成「乾『潔』」或「乾乾『潔』」來考「潔」字。如果要考「潔」，只能用標準詞語如「清潔」、「整潔」、「潔白」、「潔淨」。題目使用的語詞必須是標準正規的中文，或是直接來自課文。
- 【注音符號規範】：所有注音必須完全符合「台灣教育部 / 國家教育研究院」頒布的標準。不可以使用大陸簡體轉換過來的奇異發音，也不可以自創注音（例如：「甚至」的標準台灣注音必須是「ㄕㄣˋ ㄓˋ」，絕對不能寫錯）。
- 題型必須全部為 "multiple_choice" (單題選擇)，【不要】出現任何語詞配對大題。

請回傳單純的 JSON 陣列格式，陣列元素必須完全符合以下結構：
[
  {
    "type": "multiple_choice",
    "question": "題目描述（例如：『三餐不ㄐㄧˋ』的『ㄐㄧˋ』，正確國字是下列哪一個？）",
    "options": ["選項1", "選項2", "選項3", "選項4"],
    "answer": 正確選項的索引(0~3的整數),
    "explanation": "正確解答的完整解釋。如果是形近字或近音字，請『必須』一併說明其他錯誤選項的讀音與意思。（【重要】：解釋時絕對不要寫出如A,B,1,2等選項代號，請直接寫出選項內容起頭，例如：「[選項內容]：詳細解釋...」）"
  }
]`;
    } else if (state.mode === 'idiom') {
        return `你是一個國語家教。請根據提供內容設計「成語」練習題。共 ${count} 題。${avoidanceContext}${phoneticContext}
【嚴格要求】：
- 參考段考考古題的題型，例如：「下列選項何者成語運用最恰當/最錯誤？」、「這間老屋...給人一種什麼感覺？」、「成語的意思為何？」。
- 測驗成語的含義，選項中可包含近義詞與反義詞作為干擾。
- 請混合使用「成語配對大題」(idiom_matching) 與「成語單選題」(multiple_choice)。

請回傳單純的 JSON 陣列格式，陣列元素必須是以下兩種結構之一：
1. 單題選擇：
{
  "type": "multiple_choice",
  "question": "單一成語題目（如：下列何者與某成語意思相近？）",
  "options": ["成語1", "成語2", "成語3", "成語4"],
  "answer": 正確選項的索引(0~3的整數),
  "explanation": "正確解答的解釋，並且『必須』逐一說明這四個選項中每個成語的意思。（【重要】：解釋時絕對不要寫出如A,B,1,2等選項代號，請直接寫出成語內容起頭，例如：「[成語]：詳細解釋...」）"
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
        return `你是一個國語家教。請依照下列常見的考古題題型，針對提供的範圍（課文或文章）出 ${count} 題「修辭練習」測驗題。${phoneticContext}
【修辭範圍】：譬喻、擬人、排比、誇飾、設問、感嘆、映襯、層遞、雙關、借代等。
【強烈要求題型參考】：
1. 給出範圍中的一句話，詢問使用了什麼修辭技巧？（例：在「OOO」一句中使用了什麼修辭？）
2. 給出指定的一種修辭，要求選出下列哪一個選項也使用了相同修辭技巧？
3. 比較題：找出下列四個句子中，哪一個使用的修辭技巧與其他三個不同？
每一題的 explanation (解答說明) 必須清楚指出各選項分別使用了什麼修辭。

請回傳單純的 JSON 陣列格式，陣列元素為以下結構：
{
  "type": "multiple_choice",
  "question": "題目描述",
  "options": ["選項1", "選項2", "選項3", "選項4"],
  "answer": 正確選項的索引(0~3的整數),
  "explanation": "詳細說明每個選項對應的修辭手法與原因。（【重要】：解釋時絕對不要寫出如A,B,1,2等選項代號，請直接寫出選項內容起頭，例如：「[選項內容]：使用了OO修辭...」）"
}

回傳：
[ ... ]`;
    } else if (state.mode === 'exam') {
        return `你是一個專業的國語家教與試卷解析員。使用者會上傳考卷或講義的照片。${phoneticContext}
請幫我精準辨識並萃取出圖片中的國語題目，並將各種題型【全部改編轉換為單選題（multiple_choice）格式】回傳。同時請為每題自動提供詳細的解答說明解析。

【特殊題型轉換與過濾規則（必須嚴格遵守）】：
1. 寫出國字或注音：請將題目改編為選擇題，選項請提供發音相同或相近的國字作為干擾選項（易混淆字）。例如原題「外婆做的『ㄌㄨㄛˊ ˙ㄅㄛ』糕...『ㄒㄧㄢˊ』甜適中」，請將選項設計為整句改寫，如：「(1)蘿蔔...鹹」、「(2)羅啵...嫌」、「(3)蘿蔔...嫌」等，讓學生選出完全正確的用字選項。
2. 改錯字題：請改編為選擇題。選項設計為各種易錯字或正確字的句子組合。例如原題「堂哥的性各賴散」，可以出選項如：「糖哥，性格賴散」、「興各懶散，積級」、「性格懶散」等，讓學生選出修改完全正確的選項。
3. 填入適當的答案/注音（選詞填空）：如果原本是從括弧中選詞填入，或是填入注音，請改為像成語選擇題形式，並且必須設計一些易混淆的干擾選項。
4. 連連看題：請改編為像成語題一樣的選擇題，例如將選項設計為多組配對，讓學生選出配對完全正確的一項。
5. 【重要過濾】：遇到「照樣寫短句」或「造句題」，【直接跳過不需要出題】，請勿產生這類題型。
6. 原本的選擇題與閱讀測驗：照常萃取，如果是題組或閱讀測驗，請將引導文或文章內容附在該大題所有題目的 \`question\` 敘述中。

【JSON 結構與格式要求】：
- 絕對不要遺漏任何一題符合出題條件的題目（造句短句除外），請完整掃描圖片並出完【所有被框選的題目】。
- 選項請放置在 options 陣列中，不用在前面加上選項標籤(如 ① 或 A 或 (1) 等)，直接放入純文字的選項內容即可。
- answer 欄位請填入正確解答在 options 中的 Index (0 起始)。
- explanation 必須針對每個選項提供詳盡的解析。

請回傳單純的 JSON 陣列格式：
[
  {
    "type": "multiple_choice",
    "question": "試卷上完整的題目敘述（若是改編題型請寫出改編後的提問，如果是閱讀測驗，請將引導文附在題目前面）",
    "options": ["選項內容", "選項內容", "選項內容", "選項內容"],
    "answer": 0,
    "explanation": "詳細解析。針對每一個選項解釋為何正確或錯誤。（【重要】：前端系統會隨機打亂選項順序，所以解釋時絕對不要加上如A,B,1,2、選項一等代號！請直接引用選項的文字內容起頭，例如：「[選項內容]：寫出解釋...」）"
  }
]`;
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
        } else if (state.mode === 'exam') {
            return [
                 {
                    "type": "multiple_choice",
                    "question": "(   ) 根據本文，主角做了什麼？",
                    "options": ["吃飯", "睡覺", "看電視", "寫這份考卷"],
                    "answer": 3,
                    "explanation": "文章中有明確提到主角寫了這份考卷。"
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
        const files = Array.isArray(state.scopeContent) ? state.scopeContent : [state.scopeContent];
        for (let file of files) {
            if (!file) continue;
            const base64Image = await fileToBase64(file);
            parts.push({
                inlineData: {
                    mimeType: file.type,
                    data: base64Image
                }
            });
        }
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

    // Fix known common AI Zhuyin typos
    textObj = textObj.replace(/ㄑㄩㄢˇ拔/g, 'ㄒㄩㄢˇ拔');

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
    let finalArray = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? [parsed] : parsed;

    // Shuffle multiple choice options randomly locally securely
    if (Array.isArray(finalArray)) {
        finalArray = finalArray.map(q => {
            if (q.type === 'multiple_choice' && Array.isArray(q.options)) {
                // Ensure answer index gets updated after shuffling
                let answerText = q.options[q.answer];
                if (answerText === undefined) answerText = q.options[0]; // fallback
                for (let i = q.options.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [q.options[i], q.options[j]] = [q.options[j], q.options[i]];
                }
                q.answer = q.options.indexOf(answerText);
            }
            return q;
        });
    }
    
    return finalArray;
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
    } else {
        // Record correct answer to decrease future probability
        if (!q.isMistake) {
            try {
                let mastered = JSON.parse(localStorage.getItem('chinese_tutor_mastered') || '[]');
                mastered.push(q.question);
                if (mastered.length > 20) mastered.shift(); // keep last 20 history
                localStorage.setItem('chinese_tutor_mastered', JSON.stringify(mastered));
            } catch(e) {}
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
                // Record correct answer to decrease future probability
                if (!q.isMistake) {
                    try {
                        let mastered = JSON.parse(localStorage.getItem('chinese_tutor_mastered') || '[]');
                        mastered.push(correctAnswer);
                        if (mastered.length > 20) mastered.shift(); 
                        localStorage.setItem('chinese_tutor_mastered', JSON.stringify(mastered));
                    } catch(e) {}
                }
            } else {
                slot.classList.add('wrong');
                slot.innerHTML = `<del>${userAnswer}</del> <span class="text-green">${correctAnswer}</span>`;
                allCorrect = false;

                let formattedExp = formatExplanation(q.sentences[index].explanation, q.options);
                
                // 針對錯的特別說明意思
                explanationHtml += `
            <div class="explanation-item wrong-answer-bg" style="margin-bottom: 1rem; border-radius: 8px; padding: 1rem;">
                        <h4 class="text-red"><i class="fas fa-exclamation-triangle"></i> 第 ${index + 1} 題</h4>
                        <p><strong>正確解答：<span class="text-green">${correctAnswer}</span></strong></p>
                        <p>${formattedExp}</p>
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

function formatExplanation(text, options = []) {
    if (!text) return '';
    let formatted = text;
    // Enforce line breaks for option descriptions
    formatted = formatted.replace(/(選項[0-9A-Da-d一二三四])/g, '\n$1');

    if (options && options.length > 0) {
        options.forEach(opt => {
            const escapedOpt = opt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Check if option is followed by "：" or ":"
            const regex = new RegExp(`(${escapedOpt}[:：])`, 'g');
            formatted = formatted.replace(regex, '\n$1');
        });
    }

    formatted = formatted.split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .join('<br>');

    return formatted;
}

function showFeedback(isCorrect, explanation) {
    const feedbackDiv = document.getElementById('feedback-container');
    feedbackDiv.style.display = 'block';

    const q = state.questions[state.currentQuestionIndex];
    let formattedExplanation = formatExplanation(explanation, q ? q.options : []);

    let fbHtml = `
            <div class="feedback-card ${isCorrect ? 'bg-green-light' : 'bg-red-light'}">
                <div class="feedback-icon text-${isCorrect ? 'green' : 'red'}">
                    <i class="fas fa-${isCorrect ? 'check-circle' : 'times-circle'}"></i>
                    ${isCorrect ? '答對了！' : '答錯了喔！'}
                </div>
            ${formattedExplanation ? `<div class="explanation-text">${formattedExplanation}</div>` : ''}
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
