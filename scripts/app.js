/**
 * Classes
 * - Login gate + course catalog
 * - CLS exam runner
 * - Local autosave via localStorage
 */

/* -------------------------
   Auth + Views
------------------------- */

const AUTH_KEY = "qw_auth";
const VIEW_KEY = "qw_view";
const AUTH_USER = "GoArmy";
const AUTH_PASS = "GoArmy";

let currentView = "login";

function isAuthed(){
  return localStorage.getItem(AUTH_KEY) === "true";
}

function setView(view){
  currentView = view;
  if(isAuthed()){
    localStorage.setItem(VIEW_KEY, view);
  }
  renderView();
}

function renderView(){
  const authed = isAuthed();
  if(!authed){
    currentView = "login";
    localStorage.removeItem(VIEW_KEY);
  }else{
    currentView = localStorage.getItem(VIEW_KEY) || currentView || "courses";
  }

  el("loginView").classList.toggle("hidden", currentView !== "login");
  el("coursesView").classList.toggle("hidden", currentView !== "courses");
  el("examView").classList.toggle("hidden", currentView !== "exam");

  el("courseControls").classList.toggle("hidden", currentView !== "courses");
  el("examControls").classList.toggle("hidden", currentView !== "exam");

  if(currentView === "exam"){
    setText("siteTitle", "Classes");
    setText("siteSubtitle", "by QuayeWorks");
    startTimer();
  }else{
    setText("siteTitle", "Classes");
    setText("siteSubtitle", "by QuayeWorks");
    stopTimer();
  }
}

function handleLogin(){
  const user = el("loginUser").value.trim();
  const pass = el("loginPass").value.trim();
  if(user === AUTH_USER && pass === AUTH_PASS){
    localStorage.setItem(AUTH_KEY, "true");
    localStorage.setItem("qw_auth_ts", Date.now().toString());
    el("loginError").classList.add("hidden");
    setView("courses");
  }else{
    el("loginError").classList.remove("hidden");
  }
}

function handleLogout(){
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(VIEW_KEY);
  localStorage.removeItem("qw_auth_ts");
  setView("login");
}

function showToast(msg){
  const t = el("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(()=>{
    t.classList.remove("show");
  }, 2200);
}

/* -------------------------
   State + Persistence
------------------------- */

const STORAGE_KEY = "qw_cls_exam_state_v1";

const state = {
  startedAt: null,
  elapsed: 0,
  currentIndex: 0,
  questionOrder: [],
  // answers stored by question id
  answers: {},
  flagged: {},
  submitted: false,
  lastScore: null
};

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const parsed = JSON.parse(raw);
    Object.assign(state, parsed);
  }catch(e){
    console.warn("Failed to load state", e);
  }
}
function saveState(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setText("saveLabel", "On");
  }catch(e){
    setText("saveLabel", "Off");
    console.warn("Failed to save state", e);
  }
}
function resetState(){
  localStorage.removeItem(STORAGE_KEY);
  state.startedAt = null;
  state.elapsed = 0;
  state.currentIndex = 0;
  state.questionOrder = [];
  state.answers = {};
  state.flagged = {};
  state.submitted = false;
  state.lastScore = null;
  ensureQuestionOrder(true);
  renderAll();
}

/* -------------------------
   Helpers
------------------------- */

function el(id){ return document.getElementById(id); }
function setText(id, txt){ el(id).textContent = txt; }
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
function deepCopy(x){ return JSON.parse(JSON.stringify(x)); }

function shuffle(arr){
  const copy = [...arr];
  for(let i = copy.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function questionTypeLabel(q){
  switch(q.type){
    case "single": return "Multiple choice (single)";
    case "multi": return "Select all that apply";
    case "multi_not": return "Select all that do NOT apply";
    case "match": return "Drag & drop matching";
    case "order": return "Drag & drop ordering";
    case "true_false": return "True / False";
    default: return q.type;
  }
}

function getQuestionsInOrder(){
  const map = new Map(EXAM.questions.map(q => [q.id, q]));
  const order = Array.isArray(state.questionOrder) && state.questionOrder.length
    ? state.questionOrder
    : EXAM.questions.map(q => q.id);
  return order.map(id => map.get(id)).filter(Boolean);
}

function ensureQuestionOrder(force = false){
  const ids = EXAM.questions.map(q => q.id);
  const hasAll = Array.isArray(state.questionOrder)
    && state.questionOrder.length === ids.length
    && state.questionOrder.every(id => ids.includes(id));

  if(!force && hasAll) return;

  state.questionOrder = shuffle(ids);
  state.currentIndex = 0;
  saveState();
}

function getAnsweredCount(){
  let c = 0;
  for(const q of getQuestionsInOrder()){
    const a = state.answers[q.id];
    if(a == null) continue;
    if(q.type === "single" && Number.isInteger(a)) c++;
    else if(q.type === "true_false" && typeof a === "boolean") c++;
    else if((q.type === "multi" || q.type === "multi_not") && Array.isArray(a) && a.length) c++;
    else if(q.type === "match" && a && typeof a === "object" && Object.keys(a).length) c++;
    else if(q.type === "order" && Array.isArray(a) && a.length) c++;
  }
  return c;
}

function isAnswered(q){
  const a = state.answers[q.id];
  if(a == null) return false;
  if(q.type === "single") return Number.isInteger(a);
  if(q.type === "true_false") return typeof a === "boolean";
  if(q.type === "multi" || q.type === "multi_not") return Array.isArray(a) && a.length > 0;
  if(q.type === "match") return a && typeof a === "object" && Object.keys(a).length > 0;
  if(q.type === "order") return Array.isArray(a) && a.length === q.steps.length;
  return false;
}

function normalizeIndexArray(arr){
  return [...new Set(arr)].sort((a,b)=>a-b);
}

/* -------------------------
   Grading
------------------------- */

function grade(){
  let earned = 0;
  let possible = 0;
  const perQ = [];

  for(const q of getQuestionsInOrder()){
    possible += q.points;
    let qEarn = 0;

    const a = state.answers[q.id];

    if(q.type === "single"){
      if(Number.isInteger(a) && a === q.answer[0]) qEarn = q.points;
    }

    if(q.type === "true_false"){
      if(typeof a === "boolean" && a === q.answer) qEarn = q.points;
    }

    if(q.type === "multi" || q.type === "multi_not"){
      if(Array.isArray(a)){
        const ans = normalizeIndexArray(a);
        const key = normalizeIndexArray(q.answer);
        // exact match scoring (simple + strict)
        if(ans.length === key.length && ans.every((v,i)=>v===key[i])) qEarn = q.points;
      }
    }

    if(q.type === "match"){
      // a is {defId: termKey}
      if(a && typeof a === "object"){
        const total = q.definitions.length;
        let correct = 0;
        for(const d of q.definitions){
          if(a[d.id] && a[d.id] === d.expect) correct++;
        }
        // partial credit
        qEarn = Math.round((correct / total) * q.points * 100) / 100;
      }
    }

    if(q.type === "order"){
      if(Array.isArray(a) && a.length === q.answer.length){
        let correctPos = 0;
        for(let i=0;i<q.answer.length;i++){
          if(a[i] === q.answer[i]) correctPos++;
        }
        // partial credit
        qEarn = Math.round((correctPos / q.answer.length) * q.points * 100) / 100;
      }
    }

    earned += qEarn;
    perQ.push({ id:q.id, earned:qEarn, possible:q.points, type:q.type });
  }

  const pct = possible ? Math.round((earned/possible)*100) : 0;
  return { earned, possible, pct, perQ };
}

/* -------------------------
   Rendering
------------------------- */

function renderNav(){
  const grid = el("navGrid");
  grid.innerHTML = "";

  const ordered = getQuestionsInOrder();

  ordered.forEach((q, i)=>{
    const b = document.createElement("div");
    b.className = "navBtn";
    b.textContent = (i+1);

    if(i === state.currentIndex) b.classList.add("current");
    if(isAnswered(q)) b.classList.add("answered");
    if(state.flagged[q.id]) b.title = "Flagged";

    b.addEventListener("click", ()=>{
      state.currentIndex = i;
      saveState();
      renderAll();
    });

    grid.appendChild(b);
  });
}

function renderHeader(){
  setText("modeLabel", EXAM.mode || "Practice");
  setText("totalCount", getQuestionsInOrder().length);
  setText("answeredCount", getAnsweredCount());

  const pct = Math.round((getAnsweredCount() / getQuestionsInOrder().length) * 100);
  el("progressBar").style.width = pct + "%";
}

function renderQuestion(){
  const ordered = getQuestionsInOrder();
  const q = ordered[state.currentIndex];
  if(!q) return;

  setText("qTitle", `Question ${state.currentIndex+1}`);
  setText("qMeta", `${questionTypeLabel(q)} • ${q.points} pt${q.points===1?"":"s"}`);
  setText("qText", q.prompt);
  setText("qHint", q.hint || "");
  setText("qNote", q.note || "");

  const area = el("qArea");
  area.innerHTML = "";

  if(q.type === "single" || q.type === "multi" || q.type === "multi_not"){
    const answersDiv = document.createElement("div");
    answersDiv.className = "answers";

    const current = state.answers[q.id];

    q.options.forEach((opt, idx)=>{
      const row = document.createElement("div");
      row.className = "opt";
      const input = document.createElement("input");
      input.type = (q.type === "single") ? "radio" : "checkbox";
      input.name = q.id;
      input.checked = (q.type === "single")
        ? (current === idx)
        : (Array.isArray(current) && current.includes(idx));

      const label = document.createElement("div");
      label.className = "label";
      label.textContent = opt;

      if(input.checked) row.classList.add("selected");

      row.addEventListener("click", ()=>{
        if(state.submitted) return;
        if(q.type === "single"){
          state.answers[q.id] = idx;
        }else{
          const arr = Array.isArray(state.answers[q.id]) ? deepCopy(state.answers[q.id]) : [];
          const pos = arr.indexOf(idx);
          if(pos >= 0) arr.splice(pos,1);
          else arr.push(idx);
          state.answers[q.id] = arr;
        }
        saveState();
        renderAll();
      });

      row.appendChild(input);
      row.appendChild(label);
      answersDiv.appendChild(row);
    });

    area.appendChild(answersDiv);

    if(q.type === "multi_not"){
      const warn = document.createElement("div");
      warn.className = "small warn";
      warn.style.marginTop = "10px";
      warn.textContent = "Reminder: Choose the items that are NOT correct.";
      area.appendChild(warn);
    }
  }

  if(q.type === "true_false"){
    const answersDiv = document.createElement("div");
    answersDiv.className = "answers";
    const current = state.answers[q.id];
    const options = [
      { label: "True", value: true },
      { label: "False", value: false }
    ];

    options.forEach((opt)=>{
      const row = document.createElement("div");
      row.className = "opt";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = q.id;
      input.checked = current === opt.value;

      const label = document.createElement("div");
      label.className = "label";
      label.textContent = opt.label;

      if(input.checked) row.classList.add("selected");

      row.addEventListener("click", ()=>{
        if(state.submitted) return;
        state.answers[q.id] = opt.value;
        saveState();
        renderAll();
      });

      row.appendChild(input);
      row.appendChild(label);
      answersDiv.appendChild(row);
    });

    area.appendChild(answersDiv);
  }

  if(q.type === "match"){
    area.appendChild(renderMatch(q));
  }

  if(q.type === "order"){
    area.appendChild(renderOrder(q));
  }

  // Prev/Next buttons
  el("btnPrev").disabled = state.currentIndex === 0;
  el("btnNext").disabled = state.currentIndex === ordered.length - 1;
}

function renderMatch(q){
  const container = document.createElement("div");

  const dnd = document.createElement("div");
  dnd.className = "dndGrid";

  const left = document.createElement("div");
  left.className = "dndCol dropTarget";
  left.dataset.zone = "pool";

  const right = document.createElement("div");
  right.className = "dndCol";

  left.innerHTML = `<div class="dndColTitle"><span>Terms</span><span class="small">Drag</span></div>`;
  right.innerHTML = `<div class="dndColTitle"><span>Definitions</span><span class="small">Drop</span></div>`;

  const saved = (state.answers[q.id] && typeof state.answers[q.id] === "object") ? state.answers[q.id] : {};
  // which term keys are already assigned?
  const assigned = new Set(Object.values(saved));

  // Terms pool
  for(const t of q.terms){
    if(assigned.has(t.key)) continue;
    left.appendChild(makeChip(t.key, t.label, q.id, "match"));
  }

  // Definitions with slots
  for(const d of q.definitions){
    const row = document.createElement("div");
    row.className = "matchRow";

    const slot = document.createElement("div");
    slot.className = "slot dropTarget";
    slot.dataset.defid = d.id;
    slot.dataset.qid = q.id;
    slot.dataset.qtype = "match";

    const filledKey = saved[d.id];
    if(filledKey){
      const t = q.terms.find(x=>x.key===filledKey);
      slot.classList.add("filled");
      slot.textContent = t ? t.label : filledKey;
      slot.dataset.filled = filledKey;

      // allow click to clear
      slot.style.cursor = state.submitted ? "default" : "pointer";
      slot.title = state.submitted ? "" : "Tap to remove";
      slot.addEventListener("click", ()=>{
        if(state.submitted) return;
        // remove assignment and return term to pool
        const next = { ...(state.answers[q.id] || {}) };
        delete next[d.id];
        state.answers[q.id] = next;
        saveState();
        renderAll();
      });
    }else{
      slot.textContent = "Drop term here";
    }

    const def = document.createElement("div");
    def.className = "def";
    def.textContent = d.text;

    row.appendChild(slot);
    row.appendChild(def);
    right.appendChild(row);
  }

  dnd.appendChild(left);
  dnd.appendChild(right);
  container.appendChild(dnd);

  wireDnD(container, q);
  return container;
}

function renderOrder(q){
  const container = document.createElement("div");
  const col = document.createElement("div");
  col.className = "dndCol dropTarget";
  col.dataset.zone = "order";

  col.innerHTML = `<div class="dndColTitle"><span>Steps</span><span class="small">Drag to reorder</span></div>`;

  // current order in state
  const saved = state.answers[q.id];
  let orderKeys = Array.isArray(saved) && saved.length === q.steps.length
    ? saved
    : q.steps.map(s=>s.key);

  // persist initial order on first view (optional)
  if(!Array.isArray(saved)){
    state.answers[q.id] = orderKeys;
    saveState();
  }

  for(const key of orderKeys){
    const step = q.steps.find(s=>s.key===key);
    col.appendChild(makeChip(step.key, step.label, q.id, "order"));
  }

  container.appendChild(col);
  wireDnD(container, q);
  return container;
}

/* -------------------------
   Drag & Drop Engine
------------------------- */

let dragData = null;

function makeChip(key, label, qid, qtype){
  const chip = document.createElement("div");
  chip.className = "chip";
  chip.draggable = !state.submitted;
  chip.dataset.key = key;
  chip.dataset.qid = qid;
  chip.dataset.qtype = qtype;
  chip.textContent = label;

  chip.addEventListener("dragstart", (e)=>{
    if(state.submitted) return;
    dragData = {
      key,
      qid,
      qtype,
      from: chip.parentElement
    };
    chip.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    try{ e.dataTransfer.setData("text/plain", key); }catch{}
  });

  chip.addEventListener("dragend", ()=>{
    chip.classList.remove("dragging");
    dragData = null;
    document.querySelectorAll(".dropTarget").forEach(x=>x.classList.remove("over"));
  });

  return chip;
}

function wireDnD(root, q){
  const targets = root.querySelectorAll(".dropTarget");
  targets.forEach(t=>{
    t.addEventListener("dragover", (e)=>{
      if(state.submitted) return;
      e.preventDefault();
      t.classList.add("over");
    });
    t.addEventListener("dragleave", ()=>{
      t.classList.remove("over");
    });
    t.addEventListener("drop", (e)=>{
      if(state.submitted) return;
      e.preventDefault();
      t.classList.remove("over");
      if(!dragData) return;

      if(q.type === "match"){
        // drop into slot or pool
        const defid = t.dataset.defid;
        if(defid){
          const next = { ...(state.answers[q.id] || {}) };

          // if this term is already assigned elsewhere, remove it
          for(const k of Object.keys(next)){
            if(next[k] === dragData.key) delete next[k];
          }
          next[defid] = dragData.key;
          state.answers[q.id] = next;
          saveState();
          renderAll();
        }
      }

      if(q.type === "order"){
        // reorder within same column by dropping on container
        const col = t.closest(".dndCol");
        if(!col) return;

        const order = deepCopy(state.answers[q.id]);
        const draggedKey = dragData.key;

        // Determine insertion point: if dropped on a chip, insert before it
        const dropChip = e.target.closest(".chip");
        const fromIndex = order.indexOf(draggedKey);
        if(fromIndex < 0) return;

        order.splice(fromIndex, 1);

        if(dropChip){
          const targetKey = dropChip.dataset.key;
          const toIndex = order.indexOf(targetKey);
          if(toIndex >= 0) order.splice(toIndex, 0, draggedKey);
          else order.push(draggedKey);
        }else{
          order.push(draggedKey);
        }

        state.answers[q.id] = order;
        saveState();
        renderAll();
      }
    });
  });
}

/* -------------------------
   Review Mode (simple)
------------------------- */

function showReview(){
  const g = grade();
  state.lastScore = g;
  state.submitted = true;
  saveState();

  // show result panel
  el("resultBox").classList.remove("hidden");
  el("helpBox").classList.add("hidden");

  setText("scoreBig", `${g.pct}%`);

  const bd = el("breakdown");
  bd.innerHTML = "";
  const lines = [
    `Points: ${g.earned} / ${g.possible}`,
    `Answered: ${getAnsweredCount()} / ${getQuestionsInOrder().length}`,
    `Flagged: ${Object.keys(state.flagged).length}`
  ];
  for(const s of lines){
    const div = document.createElement("div");
    div.textContent = s;
    bd.appendChild(div);
  }

  renderAll();
}

/* -------------------------
   Timer
------------------------- */

let timerHandle = null;
function startTimer(){
  if(timerHandle) clearInterval(timerHandle);
  if(!state.startedAt){
    state.startedAt = Date.now() - (state.elapsed || 0) * 1000;
  }

  timerHandle = setInterval(()=>{
    const now = Date.now();
    const elapsed = Math.floor((now - state.startedAt)/1000);
    state.elapsed = elapsed;

    // enforce time limit if set
    if(EXAM.timeLimitSeconds && elapsed >= EXAM.timeLimitSeconds && !state.submitted){
      state.elapsed = EXAM.timeLimitSeconds;
      saveState();
      showReview();
    }else{
      saveState();
    }
    renderTimer();
  }, 1000);
}

function stopTimer(){
  if(timerHandle) clearInterval(timerHandle);
  timerHandle = null;
}

function renderTimer(){
  let s = state.elapsed || 0;
  if(EXAM.timeLimitSeconds){
    s = Math.max(0, EXAM.timeLimitSeconds - s);
  }
  const mm = String(Math.floor(s/60)).padStart(2,"0");
  const ss = String(s%60).padStart(2,"0");
  setText("timer", `${mm}:${ss}`);
}

/* -------------------------
   Events
------------------------- */

function bindUI(){
  el("btnPrev").addEventListener("click", ()=>{
    state.currentIndex = clamp(state.currentIndex - 1, 0, getQuestionsInOrder().length-1);
    saveState(); renderAll();
  });
  el("btnNext").addEventListener("click", ()=>{
    state.currentIndex = clamp(state.currentIndex + 1, 0, getQuestionsInOrder().length-1);
    saveState(); renderAll();
  });

  el("btnFlag").addEventListener("click", ()=>{
    const q = getQuestionsInOrder()[state.currentIndex];
    state.flagged[q.id] = !state.flagged[q.id];
    saveState(); renderAll();
  });

  el("btnReview").addEventListener("click", ()=>{
    // If not submitted, this acts like a "check progress" screen but we keep it simple:
    // submit only if user wants
    alert("Review shows after Submit. Use Submit when you're ready to grade.");
  });

  el("btnSubmit").addEventListener("click", ()=>{
    if(state.submitted){
      // Already submitted: just re-render
      renderAll();
      return;
    }
    const unanswered = getQuestionsInOrder().length - getAnsweredCount();
    const proceed = confirm(unanswered
      ? `You have ${unanswered} unanswered question(s). Submit anyway?`
      : "Submit and grade now?"
    );
    if(!proceed) return;
    showReview();
  });

  el("btnReset").addEventListener("click", ()=>{
    const ok = confirm("Reset all answers and restart?");
    if(ok) resetState();
  });

  el("btnLogin").addEventListener("click", handleLogin);
  el("loginPass").addEventListener("keydown", (e)=>{
    if(e.key === "Enter") handleLogin();
  });

  document.querySelectorAll(".logoutBtn").forEach(btn => {
    btn.addEventListener("click", handleLogout);
  });

  el("courseCls").addEventListener("click", ()=>{
    if(!isAuthed()) return;
    ensureQuestionOrder();
    setView("exam");
    renderAll();
  });

  el("courseCisco").addEventListener("click", (e)=>{
    e.preventDefault();
    showToast("Cisco IT is coming soon.");
  });
}

/* -------------------------
   Render All
------------------------- */

function renderAll(){
  renderHeader();
  renderNav();
  renderTimer();

  const q = getQuestionsInOrder()[state.currentIndex];

  // Update flag button label
  el("btnFlag").textContent = state.flagged[q.id] ? "Flagged" : "Flag";

  // Disable interactions after submit
  el("btnSubmit").textContent = state.submitted ? "Submitted" : "Submit";
  el("btnSubmit").disabled = false;

  // If submitted, show results panel
  if(state.submitted && state.lastScore){
    el("resultBox").classList.remove("hidden");
    el("helpBox").classList.add("hidden");
  }

  renderQuestion();
}

/* -------------------------
   Init
------------------------- */

function init(){
  loadState();
  ensureQuestionOrder();

  // Ensure currentIndex in bounds
  state.currentIndex = clamp(state.currentIndex || 0, 0, getQuestionsInOrder().length-1);

  setText("modeLabel", EXAM.mode || "Practice");
  setText("totalCount", getQuestionsInOrder().length);

  bindUI();
  renderAll();

  if(isAuthed()){
    currentView = localStorage.getItem(VIEW_KEY) || "courses";
  }
  renderView();
}

init();
