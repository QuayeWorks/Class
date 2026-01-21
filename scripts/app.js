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

const VIEW_COURSES = "courses";
const VIEW_MODULES = "clsModules";
const VIEW_EXAM = "exam";

let currentView = "login";
let EXAM = null;
let RAW_DATA = null;
let MODULES = [];
let FINAL_PROFILE = null;
let storageKey = null;
let currentCourseId = null;
let currentProfile = null;
let currentModuleId = null;

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
    currentView = localStorage.getItem(VIEW_KEY) || currentView || VIEW_COURSES;
  }

  el("loginView").classList.toggle("hidden", currentView !== "login");
  el("coursesView").classList.toggle("hidden", currentView !== VIEW_COURSES);
  el("clsModulesView").classList.toggle("hidden", currentView !== VIEW_MODULES);
  el("examView").classList.toggle("hidden", currentView !== VIEW_EXAM);

  el("courseControls").classList.toggle("hidden", !(currentView === VIEW_COURSES || currentView === VIEW_MODULES));
  el("examControls").classList.toggle("hidden", currentView !== VIEW_EXAM);

  if(currentView === VIEW_EXAM){
    setText("siteTitle", "Classes");
    setText("siteSubtitle", "by QuayeWorks");
    if(EXAM){
      startTimer();
    }
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
    setView(VIEW_COURSES);
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

const COURSE_ID = "cls";
const STORAGE_VERSION = "v1";
const FINAL_BUNDLE_KEY = "qw_cls_final_exam_bundle_v1";
const LAST_EXAM_KEY = "qw_cls_last_exam_v1";

const defaultState = {
  startedAt: null,
  elapsed: 0,
  currentIndex: 0,
  questionOrder: [],
  answers: {},
  flagged: {},
  orderTouched: {},
  helpOpen: {},
  submitted: false,
  lastScore: null,
  examId: null
};

const state = { ...defaultState };

function resetStateObject(){
  Object.keys(state).forEach((key)=>{
    delete state[key];
  });
  Object.assign(state, deepCopy(defaultState));
}

function loadState(key){
  try{
    if(!key) return;
    const raw = localStorage.getItem(key);
    if(!raw) return;
    const parsed = JSON.parse(raw);
    Object.assign(state, parsed);
  }catch(e){
    console.warn("Failed to load state", e);
  }
}
function saveState(key){
  try{
    if(!key) return;
    localStorage.setItem(key, JSON.stringify(state));
    setText("saveLabel", "On");
  }catch(e){
    setText("saveLabel", "Off");
    console.warn("Failed to save state", e);
  }
}
function resetStateForCurrentExam(){
  if(storageKey){
    localStorage.removeItem(storageKey);
  }
  if(EXAM && FINAL_PROFILE && EXAM.id === FINAL_PROFILE.id){
    localStorage.removeItem(FINAL_BUNDLE_KEY);
  }
  stopTimer();
  resetStateObject();
  ensureQuestionOrder(true);
  state.currentIndex = 0;
  renderAll();
  startTimer();
}

/* -------------------------
   Helpers
------------------------- */

function el(id){ return document.getElementById(id); }
function setText(id, txt){ el(id).textContent = txt; }
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
function deepCopy(x){ return JSON.parse(JSON.stringify(x)); }
function normalizeModuleId(moduleId){
  const raw = String(moduleId ?? "").trim();
  if(/^\d+$/.test(raw)){
    return raw.padStart(2, "0");
  }
  return raw;
}
function buildStorageKey({ courseId, profile, moduleId, version = STORAGE_VERSION }){
  if(!courseId || !profile) return null;
  const parts = ["qw", String(courseId).toLowerCase(), profile];
  if(profile === "module" && moduleId){
    parts.push(normalizeModuleId(moduleId));
  }
  parts.push(version);
  return parts.join(":");
}

function setExamContext({ courseId, profile, moduleId }){
  currentCourseId = courseId;
  currentProfile = profile;
  currentModuleId = moduleId ?? null;
  storageKey = buildStorageKey({
    courseId: currentCourseId,
    profile: currentProfile,
    moduleId: currentModuleId
  });
}

function normalizePrompt(q){
  const prompt = String(q.prompt ?? "").trim();
  if(q.type === "multi" || q.type === "multi_not"){
    const instruction = q.type === "multi"
      ? "Select ALL that apply."
      : "Select ALL that do NOT apply.";
    if(prompt.toLowerCase().includes(instruction.toLowerCase())) return prompt;
    return prompt ? `${instruction}\n${prompt}` : instruction;
  }
  if(q.type === "order"){
    const instruction = "Place the following steps in the correct order.";
    if(prompt.toLowerCase().includes(instruction.toLowerCase())) return prompt;
    return prompt ? `${prompt}\n${instruction}` : instruction;
  }
  return prompt;
}

function getQuestionCountsByModule(questions){
  const counts = {};
  (questions || []).forEach((q)=>{
    const id = normalizeModuleId(q.module);
    if(!id) return;
    counts[id] = (counts[id] || 0) + 1;
  });
  return counts;
}

function normalizeQuestions(raw){
  const questions = (raw.questions || []).map((q)=> {
    if(q.type === "true_false"){
      return {
        ...q,
        module: normalizeModuleId(q.module),
        prompt: normalizePrompt(q),
        options: ["True", "False"],
        answer: typeof q.answer === "boolean" ? q.answer : Boolean(q.answer)
      };
    }
    return { ...q, module: normalizeModuleId(q.module), prompt: normalizePrompt(q) };
  });

  return questions;
}

function shuffle(arr){
  const copy = [...arr];
  for(let i = copy.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function seededRng(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, rng){
  const copy = [...arr];
  for(let i = copy.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildDefaultModules(){
  return Array.from({ length: 20 }, (_, i)=>{
    const id = String(i + 1).padStart(2, "0");
    return {
      id,
      title: `Module ${id}`,
      locked: true,
      questionCount: 0
    };
  });
}

function buildModules(raw){
  const base = Array.isArray(raw.modules) && raw.modules.length
    ? deepCopy(raw.modules)
    : buildDefaultModules();

  const counts = getQuestionCountsByModule(raw.questions);

  return base.map((mod)=>{
    const normalizedId = normalizeModuleId(mod.id);
    const count = counts[normalizedId] || 0;
    return {
      id: normalizedId,
      title: mod.title || `Module ${normalizedId}`,
      locked: count === 0,
      questionCount: count
    };
  });
}

function buildFinalProfile(raw, modules){
  const fallback = {
    id: "FINAL",
    title: "Final Exam",
    totalQuestions: 50,
    timeLimitSeconds: 50 * 60,
    difficultyMix: { min: 2, max: 5 },
    includeModules: modules.filter(m => !m.locked).map(m => m.id),
    preferScenarioPct: 40
  };
  const profile = raw.profiles && raw.profiles.finalExam ? raw.profiles.finalExam : fallback;
  const unlocked = new Set(modules.filter(m => !m.locked).map(m => normalizeModuleId(m.id)));
  return {
    ...fallback,
    ...profile,
    includeModules: (profile.includeModules || fallback.includeModules)
      .map((id)=> normalizeModuleId(id))
      .filter(id => unlocked.has(id))
  };
}

function buildExamForModule(moduleId){
  const normalizedId = normalizeModuleId(moduleId);
  const moduleInfo = MODULES.find(m => m.id === normalizedId);
  const questions = RAW_DATA.questions.filter(q => q.module === normalizedId);
  return {
    id: `MODULE_${normalizedId}`,
    title: moduleInfo ? moduleInfo.title : `Module ${normalizedId}`,
    mode: moduleInfo ? moduleInfo.title : `Module ${normalizedId}`,
    timeLimitSeconds: 25 * 60,
    questions
  };
}

function buildFinalExam(){
  const profile = FINAL_PROFILE;
  const bundle = getOrCreateFinalExamBundle(profile);
  const map = new Map(RAW_DATA.questions.map(q => [q.id, q]));
  const questions = bundle.questionIds.map(id => map.get(id)).filter(Boolean);
  return {
    id: profile.id,
    title: profile.title,
    mode: profile.title,
    timeLimitSeconds: profile.timeLimitSeconds,
    questions,
    order: bundle.order
  };
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
  saveState(storageKey);
}

function getOrCreateFinalExamBundle(profile){
  try{
    const raw = localStorage.getItem(FINAL_BUNDLE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      const map = new Map(RAW_DATA.questions.map(q => [q.id, q]));
      const valid = Array.isArray(parsed.questionIds)
        && parsed.questionIds.length
        && parsed.questionIds.every(id => map.has(id));
      if(valid){
        return parsed;
      }
    }
  }catch(e){
    console.warn("Failed to read final exam bundle", e);
  }

  const seed = Math.floor(Math.random() * 2**31);
  const rng = seededRng(seed);
  const questions = selectFinalExamQuestions(profile, rng);
  const order = seededShuffle(questions.map(q => q.id), rng);
  const bundle = {
    seed,
    questionIds: questions.map(q => q.id),
    order,
    profile: {
      totalQuestions: profile.totalQuestions,
      includeModules: profile.includeModules,
      difficultyMix: profile.difficultyMix,
      preferScenarioPct: profile.preferScenarioPct
    },
    createdAt: Date.now()
  };

  try{
    localStorage.setItem(FINAL_BUNDLE_KEY, JSON.stringify(bundle));
  }catch(e){
    console.warn("Failed to store final exam bundle", e);
  }
  return bundle;
}

function selectFinalExamQuestions(profile, rng){
  const minDifficulty = profile.difficultyMix?.min ?? 1;
  const maxDifficulty = profile.difficultyMix?.max ?? 5;
  const includeModules = (profile.includeModules || []).map((id)=> normalizeModuleId(id));
  const eligible = RAW_DATA.questions.filter((q)=>{
    const inModule = includeModules.includes(q.module);
    const diff = q.difficulty ?? 1;
    return inModule && diff >= minDifficulty && diff <= maxDifficulty;
  });

  if(!eligible.length){
    return [];
  }

  const totalQuestions = Math.min(profile.totalQuestions, eligible.length);
  const scenarioTarget = Math.round(totalQuestions * ((profile.preferScenarioPct || 0) / 100));

  const modulePools = {};
  eligible.forEach((q)=>{
    if(!modulePools[q.module]) modulePools[q.module] = [];
    modulePools[q.module].push(q);
  });

  const moduleIds = Object.keys(modulePools);
  const moduleCount = moduleIds.length;
  let minPerModule = 0;
  if(totalQuestions >= moduleCount * 5 && moduleIds.every(id => modulePools[id].length >= 5)){
    minPerModule = 5;
  }else if(totalQuestions >= moduleCount && moduleIds.every(id => modulePools[id].length >= 1)){
    minPerModule = 1;
  }

  const totalAvailable = moduleIds.reduce((sum, id)=> sum + modulePools[id].length, 0);
  const allocations = {};
  moduleIds.forEach((id)=>{
    const base = Math.floor(totalQuestions * (modulePools[id].length / totalAvailable));
    allocations[id] = Math.min(modulePools[id].length, Math.max(base, minPerModule));
  });

  let allocated = Object.values(allocations).reduce((sum, v)=> sum + v, 0);
  while(allocated > totalQuestions){
    const sortable = moduleIds
      .map(id => ({ id, count: allocations[id] }))
      .sort((a,b)=> b.count - a.count);
    for(const mod of sortable){
      if(allocations[mod.id] > 0){
        allocations[mod.id] -= 1;
        allocated -= 1;
        if(allocated === totalQuestions) break;
      }
    }
  }

  while(allocated < totalQuestions){
    const sortable = moduleIds
      .map(id => ({ id, remaining: modulePools[id].length - allocations[id] }))
      .filter(mod => mod.remaining > 0)
      .sort((a,b)=> b.remaining - a.remaining);
    if(!sortable.length) break;
    allocations[sortable[0].id] += 1;
    allocated += 1;
  }

  let scenarioRemaining = scenarioTarget;
  const selected = [];
  const selectedIds = new Set();

  moduleIds.forEach((id)=>{
    const pool = seededShuffle(modulePools[id], rng);
    const scenarios = pool.filter(q => q.scenario);
    const nonScenarios = pool.filter(q => !q.scenario);
    const count = allocations[id] || 0;
    const picked = [];

    if(scenarioRemaining > 0){
      const takeScenario = Math.min(scenarioRemaining, scenarios.length, count);
      picked.push(...scenarios.slice(0, takeScenario));
      scenarioRemaining -= takeScenario;
    }

    if(picked.length < count){
      const remaining = count - picked.length;
      const fill = nonScenarios.slice(0, remaining);
      picked.push(...fill);
    }

    if(picked.length < count){
      const remaining = count - picked.length;
      const extra = scenarios.slice(picked.filter(q => q.scenario).length, picked.filter(q => q.scenario).length + remaining);
      picked.push(...extra);
    }

    picked.forEach(q => {
      if(!selectedIds.has(q.id)){
        selected.push(q);
        selectedIds.add(q.id);
      }
    });
  });

  if(selected.length < totalQuestions){
    const remainingPool = seededShuffle(eligible.filter(q => !selectedIds.has(q.id)), rng);
    selected.push(...remainingPool.slice(0, totalQuestions - selected.length));
  }

  return selected.slice(0, totalQuestions);
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
    else if(q.type === "order"
      && Array.isArray(a)
      && a.length === q.steps.length
      && state.orderTouched[q.id]) c++;
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
  if(q.type === "order") return Array.isArray(a)
    && a.length === q.steps.length
    && state.orderTouched[q.id];
  return false;
}

function normalizeIndexArray(arr){
  return [...new Set(arr)].sort((a,b)=>a-b);
}

function isCorrectAnswer(q){
  const a = state.answers[q.id];
  if(q.type === "single"){
    return Number.isInteger(a) && a === q.answer[0];
  }
  if(q.type === "true_false"){
    return typeof a === "boolean" && a === q.answer;
  }
  if(q.type === "multi" || q.type === "multi_not"){
    if(!Array.isArray(a)) return false;
    const ans = normalizeIndexArray(a);
    const key = normalizeIndexArray(q.answer);
    return ans.length === key.length && ans.every((v,i)=>v===key[i]);
  }
  if(q.type === "match"){
    if(!a || typeof a !== "object") return false;
    return q.definitions.every((d)=> a[d.id] === d.expect);
  }
  if(q.type === "order"){
    if(!Array.isArray(a) || a.length !== q.answer.length) return false;
    return a.every((val, idx)=> val === q.answer[idx]);
  }
  return false;
}

function getCorrectAnswerText(q){
  if(q.type === "single" || q.type === "multi" || q.type === "multi_not"){
    const labels = q.answer.map(idx => q.options[idx]).filter(Boolean);
    return labels.join(", ");
  }
  if(q.type === "true_false"){
    return q.answer ? "True" : "False";
  }
  if(q.type === "match"){
    return q.definitions.map((d)=>{
      const term = q.terms.find(t => t.key === d.expect);
      return `${d.text} → ${term ? term.label : d.expect}`;
    }).join(" • ");
  }
  if(q.type === "order"){
    return q.answer.map((key)=>{
      const step = q.steps.find(s => s.key === key);
      return step ? step.label : key;
    }).join(" → ");
  }
  return "";
}

function getCorrectAnswerLines(q){
  if(q.type === "single" || q.type === "true_false"){
    const line = getCorrectAnswerText(q);
    return line ? [line] : [];
  }
  if(q.type === "multi" || q.type === "multi_not"){
    return q.answer.map(idx => q.options[idx]).filter(Boolean);
  }
  if(q.type === "match"){
    return q.definitions.map((d)=>{
      const term = q.terms.find(t => t.key === d.expect);
      return `${d.text} → ${term ? term.label : d.expect}`;
    });
  }
  if(q.type === "order"){
    return q.answer.map((key)=>{
      const step = q.steps.find(s => s.key === key);
      return step ? step.label : key;
    });
  }
  return [];
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
      saveState(storageKey);
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

  const area = el("qArea");
  area.innerHTML = "";

  if(q.type === "single" || q.type === "multi" || q.type === "multi_not"){
    const answersDiv = document.createElement("div");
    answersDiv.className = "answers";

    const current = state.answers[q.id];

    const correctIndexes = new Set(q.answer || []);

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
      if(state.submitted){
        if(correctIndexes.has(idx)) row.classList.add("correct");
        if(input.checked && !correctIndexes.has(idx)) row.classList.add("incorrect");
      }

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
        saveState(storageKey);
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
      if(state.submitted){
        if(q.answer === opt.value) row.classList.add("correct");
        if(input.checked && q.answer !== opt.value) row.classList.add("incorrect");
      }

      row.addEventListener("click", ()=>{
        if(state.submitted) return;
        state.answers[q.id] = opt.value;
        saveState(storageKey);
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

  if(state.submitted){
    const review = document.createElement("div");
    review.className = "resultBox inline";

    const correct = isCorrectAnswer(q);
    const status = document.createElement("div");
    status.className = `resultStatus ${correct ? "correct" : "incorrect"}`;
    status.textContent = `${correct ? "✅ Correct" : "❌ Incorrect"}`;
    review.appendChild(status);
    area.appendChild(review);
  }

  const helpControls = el("helpControls");
  const helpPanel = el("helpPanel");
  const helpContent = el("helpContent");
  const btnHelpToggle = el("btnHelpToggle");
  const qid = q.id;
  const open = !!(state.helpOpen && state.helpOpen[qid]);

  if(state.submitted){
    helpControls.classList.remove("hidden");
    btnHelpToggle.textContent = open ? "Hide Help" : "View Help";
    helpPanel.classList.toggle("hidden", !open);
    helpContent.innerHTML = "";

    if(open){
      const correctBlock = document.createElement("div");
      const correctLabel = document.createElement("strong");
      correctLabel.textContent = "Correct answer(s):";
      correctBlock.appendChild(correctLabel);

      const lines = getCorrectAnswerLines(q);
      if(lines.length <= 1){
        const text = document.createElement("span");
        text.textContent = ` ${lines[0] || "N/A"}`;
        correctBlock.appendChild(text);
      }else{
        const list = document.createElement("ul");
        list.className = "helpList";
        lines.forEach((line)=>{
          const item = document.createElement("li");
          item.textContent = line;
          list.appendChild(item);
        });
        correctBlock.appendChild(list);
      }
      helpContent.appendChild(correctBlock);

      const rationale = q.rationale || q.note;
      if(rationale){
        const rationaleLine = document.createElement("div");
        const label = document.createElement("strong");
        label.textContent = q.rationale ? "Rationale:" : "Note:";
        rationaleLine.appendChild(label);
        const text = document.createElement("span");
        text.textContent = ` ${rationale}`;
        rationaleLine.appendChild(text);
        helpContent.appendChild(rationaleLine);
      }

      if(q.sourceRef){
        const sourceLine = document.createElement("div");
        const label = document.createElement("strong");
        label.textContent = "Source:";
        sourceLine.appendChild(label);
        const text = document.createElement("span");
        text.textContent = ` ${q.sourceRef}`;
        sourceLine.appendChild(text);
        helpContent.appendChild(sourceLine);
      }
    }
  }else{
    helpControls.classList.add("hidden");
    helpPanel.classList.add("hidden");
    helpContent.innerHTML = "";
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
        saveState(storageKey);
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
  const orderKeys = Array.isArray(saved) && saved.length === q.steps.length
    ? saved
    : q.steps.map(s=>s.key);

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
          saveState(storageKey);
          renderAll();
        }
      }

      if(q.type === "order"){
        // reorder within same column by dropping on container
        const col = t.closest(".dndCol");
        if(!col) return;

        const baseOrder = Array.isArray(state.answers[q.id])
          ? state.answers[q.id]
          : q.steps.map(s=>s.key);
        const order = deepCopy(baseOrder);
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
        state.orderTouched[q.id] = true;
        saveState(storageKey);
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
  state.helpOpen = {};
  saveState(storageKey);

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
   Module Select + Exam Setup
------------------------- */

function renderModuleSelect(){
  const grid = el("moduleGrid");
  if(!grid) return;
  grid.innerHTML = "";

  MODULES.forEach((mod)=>{
    const tile = document.createElement("div");
    tile.className = `courseTile${mod.locked ? " locked" : ""}`;

    const title = document.createElement("div");
    title.className = "courseTitle";
    title.textContent = mod.title || `Module ${mod.id}`;

    const meta = document.createElement("div");
    meta.className = "courseMeta";
    const count = mod.questionCount || 0;
    if(count > 0){
      meta.textContent = `Ready • ${count} question${count === 1 ? "" : "s"}`;
    }else{
      meta.textContent = "Locked / Coming soon";
    }

    tile.appendChild(title);
    tile.appendChild(meta);

    if(mod.locked){
      const lock = document.createElement("div");
      lock.className = "lockBadge";
      lock.textContent = "🔒 Coming soon";
      tile.appendChild(lock);
    }else{
      const tag = document.createElement("div");
      tag.className = "tag";
      tag.innerHTML = "<strong>Start</strong>";
      tile.appendChild(tag);
    }

    tile.addEventListener("click", ()=>{
      if(mod.locked){
        showToast("Module content coming soon.");
        return;
      }
      startModuleExam(mod.id);
    });

    grid.appendChild(tile);
  });

  const finalTile = document.createElement("div");
  finalTile.className = "courseTile";

  const finalTitle = document.createElement("div");
  finalTitle.className = "courseTitle";
  finalTitle.textContent = "Final Exam";

  const finalMeta = document.createElement("div");
  finalMeta.className = "courseMeta";
  finalMeta.textContent = `Randomized subset • ${FINAL_PROFILE.totalQuestions} questions`;

  const finalTag = document.createElement("div");
  finalTag.className = "tag";
  finalTag.innerHTML = "<strong>Launch</strong>";

  finalTile.appendChild(finalTitle);
  finalTile.appendChild(finalMeta);
  finalTile.appendChild(finalTag);

  finalTile.addEventListener("click", ()=>{
    if(!FINAL_PROFILE.includeModules.length){
      showToast("Final exam requires unlocked modules.");
      return;
    }
    startFinalExam();
  });

  grid.appendChild(finalTile);
}

function teardownExam(){
  stopTimer();
  dragData = null;
  document.querySelectorAll(".dropTarget").forEach((el)=> el.classList.remove("over"));
}

function setExamSession(exam, key, orderOverride){
  teardownExam();
  EXAM = exam;
  storageKey = key;
  resetStateObject();
  loadState(storageKey);

  state.examId = exam.id;
  if(!state.orderTouched || typeof state.orderTouched !== "object"){
    state.orderTouched = {};
  }
  if(!state.helpOpen || typeof state.helpOpen !== "object"){
    state.helpOpen = {};
  }

  EXAM.questions.filter(q => q.type === "order").forEach((q)=>{
    const saved = state.answers[q.id];
    if(Array.isArray(saved) && saved.length === q.steps.length){
      const defaultOrder = q.steps.map(s => s.key);
      const touched = !saved.every((val, idx)=> val === defaultOrder[idx]);
      if(touched) state.orderTouched[q.id] = true;
    }
  });

  if(orderOverride && (!Array.isArray(state.questionOrder) || !state.questionOrder.length)){
    state.questionOrder = [...orderOverride];
  }

  ensureQuestionOrder();
  state.currentIndex = clamp(state.currentIndex || 0, 0, getQuestionsInOrder().length-1);

  setText("modeLabel", EXAM.mode || "Practice");
  setText("totalCount", getQuestionsInOrder().length);

  setView(VIEW_EXAM);
  renderAll();
}

function startModuleExam(moduleId){
  const normalizedId = normalizeModuleId(moduleId);
  const exam = buildExamForModule(normalizedId);
  setExamContext({ courseId: COURSE_ID, profile: "module", moduleId: normalizedId });
  const key = storageKey;
  localStorage.setItem(LAST_EXAM_KEY, JSON.stringify({ type: "module", id: normalizedId }));
  setExamSession(exam, key);
}

function startFinalExam(){
  const exam = buildFinalExam();
  localStorage.setItem(LAST_EXAM_KEY, JSON.stringify({ type: "final" }));
  setExamContext({ courseId: COURSE_ID, profile: "final", moduleId: null });
  const key = storageKey;
  setExamSession(exam, key, exam.order);
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
      saveState(storageKey);
      showReview();
    }else{
      saveState(storageKey);
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
    saveState(storageKey); renderAll();
  });
  el("btnNext").addEventListener("click", ()=>{
    state.currentIndex = clamp(state.currentIndex + 1, 0, getQuestionsInOrder().length-1);
    saveState(storageKey); renderAll();
  });

  el("btnFlag").addEventListener("click", ()=>{
    const q = getQuestionsInOrder()[state.currentIndex];
    state.flagged[q.id] = !state.flagged[q.id];
    saveState(storageKey); renderAll();
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

  el("btnHelpToggle").addEventListener("click", ()=>{
    if(!state.submitted) return;
    const q = getQuestionsInOrder()[state.currentIndex];
    if(!q) return;
    if(!state.helpOpen || typeof state.helpOpen !== "object"){
      state.helpOpen = {};
    }
    const current = !!state.helpOpen[q.id];
    state.helpOpen[q.id] = !current;
    saveState(storageKey);
    renderQuestion();
  });

  el("btnReset").addEventListener("click", ()=>{
    const ok = confirm("Reset all answers and restart?");
    if(ok) resetStateForCurrentExam();
  });

  el("btnBackToModules").addEventListener("click", ()=>{
    setView(VIEW_MODULES);
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
    renderModuleSelect();
    setView(VIEW_MODULES);
  });

  el("courseCisco").addEventListener("click", (e)=>{
    e.preventDefault();
    showToast("Cisco IT is coming soon.");
  });

  el("btnBackToCourses").addEventListener("click", ()=>{
    setView(VIEW_COURSES);
  });
}

/* -------------------------
   Render All
------------------------- */

function renderAll(){
  if(!EXAM) return;
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
  }else{
    el("resultBox").classList.add("hidden");
    el("helpBox").classList.remove("hidden");
  }

  renderQuestion();
}

/* -------------------------
   Init
------------------------- */

async function init(){
  try{
    const raw = await window.loadExamData();
    RAW_DATA = raw;
    RAW_DATA.questions = normalizeQuestions(raw);
    MODULES = buildModules(RAW_DATA);
    FINAL_PROFILE = buildFinalProfile(RAW_DATA, MODULES);
    const moduleSet = [...new Set(RAW_DATA.questions.map(q => q.module))];
    console.log("CLS question modules loaded:", moduleSet);
    const countsByModule = getQuestionCountsByModule(RAW_DATA.questions);
    const moduleLockReport = buildDefaultModules().map((mod)=> {
      const count = countsByModule[mod.id] || 0;
      return { module: mod.id, count, locked: count === 0 };
    });
    console.log("CLS module counts/locks:", moduleLockReport);
  }catch(e){
    console.error("Failed to load exam data", e);
    showToast("Failed to load exam data.");
    return;
  }

  bindUI();
  renderModuleSelect();

  if(isAuthed()){
    currentView = localStorage.getItem(VIEW_KEY) || VIEW_COURSES;
  }

  if(isAuthed() && currentView === VIEW_EXAM){
    try{
      const lastExam = JSON.parse(localStorage.getItem(LAST_EXAM_KEY) || "{}");
      if(lastExam.type === "module" && lastExam.id){
        startModuleExam(lastExam.id);
        return;
      }
      if(lastExam.type === "final"){
        startFinalExam();
        return;
      }
    }catch(e){
      console.warn("Failed to restore last exam", e);
    }
    currentView = VIEW_COURSES;
  }
  renderView();
}

init();
