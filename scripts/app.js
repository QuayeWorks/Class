/**
 * Classes
 * - Login gate + course catalog
 * - Separate CLS and Security+ courses
 * - Security+ domains plus unscored supplemental study sections
 * - Shared exam runner with course-isolated local autosave
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
const VIEW_DOMAIN = "domain";
const VIEW_REVIEW = "review";
const VIEW_EXAM = "exam";

const FINAL_EXAM_MIN = 50;
const FINAL_EXAM_MAX = 75;
const FINAL_EXAM_DEFAULT = 60;
const FINAL_EXAM_MIN_PER_MODULE = 2;
const FINAL_EXAM_MAX_SHARE = 0.2;
const FINAL_EXAM_SCENARIO_PCT = 35;
const FINAL_EXAM_MIN_MODULES_READY = 5;
const FINAL_EXAM_WEIGHTS = null;

const PARTIAL_CREDIT_MULTI_MIN_CORRECT = 3;
const PARTIAL_CREDIT_MIN_POINTS = 3;

let currentView = "login";
let COURSE_MANIFEST = { courses: [] };
let CURRENT_COURSE = null;
let EXAM = null;
let RAW_DATA = null;
let MODULES = [];
let DOMAINS = [];
let SUPPLEMENTAL_SECTIONS = [];
let FINAL_PROFILE = null;
let storageKey = null;
let currentCourseId = null;
let currentProfile = null;
let currentModuleId = null;
let currentDomainId = null;
let reviewModuleId = null;

const CURRENT_COURSE_KEY = "qw_current_course_v1";
const courseDataCache = new Map();

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
  el("domainView").classList.toggle("hidden", currentView !== VIEW_DOMAIN);
  el("reviewView").classList.toggle("hidden", currentView !== VIEW_REVIEW);
  el("examView").classList.toggle("hidden", currentView !== VIEW_EXAM);

  el("courseControls").classList.toggle(
    "hidden",
    !(
      currentView === VIEW_COURSES
      || currentView === VIEW_MODULES
      || currentView === VIEW_DOMAIN
      || currentView === VIEW_REVIEW
    )
  );
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

const STORAGE_VERSION = "v1";

function getLastExamKey(courseId){
  return courseId === "cls"
    ? "qw_cls_last_exam_v1"
    : `qw_${String(courseId).toLowerCase()}_last_exam_v1`;
}

function getReviewModuleKey(courseId){
  return `qw:${String(courseId).toLowerCase()}:review-module:${STORAGE_VERSION}`;
}

function getCurrentDomainKey(courseId){
  return `qw:${String(courseId).toLowerCase()}:current-domain:${STORAGE_VERSION}`;
}

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
  examId: null,
  finalExam: null
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
function setHidden(id, hidden){
  const node = el(id);
  if(!node) return;
  node.classList.toggle("hidden", hidden);
}
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
  if((profile === "module" || profile === "domain") && moduleId){
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

function normalizeMultiPrompt(prompt, instruction, instructionRegex){
  let remaining = String(prompt ?? "").trim();
  if(!remaining) return instruction;
  while(instructionRegex.test(remaining)){
    remaining = remaining.replace(instructionRegex, "").trim();
  }
  if(!remaining) return `${instruction}:`;
  return `${instruction}: ${remaining}`;
}

function normalizePrompt(q){
  const prompt = String(q.prompt ?? "").trim();
  if(q.type === "multi"){
    return normalizeMultiPrompt(
      prompt,
      "Select ALL that apply",
      /^select\s+all\s+that\s+apply\s*(?:[.:]|\n|$)\s*/i
    );
  }
  if(q.type === "multi_not"){
    return normalizeMultiPrompt(
      prompt,
      "Select ALL that do NOT apply",
      /^select\s+all\s+that\s+do\s+not\s+apply\s*(?:[.:]|\n|$)\s*/i
    );
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
  const sourceModules = Array.isArray(raw.modules) && raw.modules.length
    ? raw.modules
    : raw.sourceModules;
  const base = Array.isArray(sourceModules) && sourceModules.length
    ? deepCopy(sourceModules)
    : buildDefaultModules();

  const counts = getQuestionCountsByModule(raw.questions);

  return base.map((mod)=>{
    const normalizedId = normalizeModuleId(mod.id);
    const count = counts[normalizedId] || 0;
    return {
      ...mod,
      id: normalizedId,
      title: mod.title || `Module ${normalizedId}`,
      locked: count === 0,
      questionCount: count
    };
  });
}

function buildDomains(raw, modules){
  if(!Array.isArray(raw.domains)) return [];
  return raw.domains.map((domain)=>{
    const chapterIds = (domain.chapterIds || [])
      .map(id => normalizeModuleId(id))
      .filter(id => modules.some(module => module.id === id));
    const questionCount = raw.questions.filter(q => chapterIds.includes(q.module)).length;
    return {
      ...domain,
      id: normalizeModuleId(domain.id),
      chapterIds,
      questionCount,
      locked: !chapterIds.length || questionCount === 0
    };
  });
}

function buildSupplementalSections(raw, modules){
  if(!Array.isArray(raw.supplementalSections)) return [];
  return raw.supplementalSections
    .map((section)=>{
      const chapterIds = (section.chapterIds || [])
        .map(id => normalizeModuleId(id))
        .filter(id => modules.some(module => module.id === id));
      const questionCount = raw.questions.filter(
        q => chapterIds.includes(q.module)
      ).length;
      return {
        ...section,
        chapterIds,
        questionCount,
        locked: !chapterIds.length || questionCount === 0
      };
    })
    .filter(section => section.chapterIds.length);
}

function getCourseDomainIdForModule(module){
  if(!module?.domainId) return null;
  const domainId = normalizeModuleId(module.domainId);
  return DOMAINS.some(domain => domain.id === domainId) ? domainId : null;
}

function buildFinalProfile(raw, modules){
  const unlockedModules = modules.filter(m => !m.locked).map(m => m.id);
  const eligibleModules = unlockedModules;
  const fallback = {
    id: "FINAL",
    title: "Final Exam",
    totalQuestions: FINAL_EXAM_DEFAULT,
    timeLimitSeconds: FINAL_EXAM_DEFAULT * 60,
    difficultyMix: { min: 2, max: 5 },
    includeModules: eligibleModules,
    preferScenarioPct: FINAL_EXAM_SCENARIO_PCT,
    minQuestions: FINAL_EXAM_MIN,
    maxQuestions: FINAL_EXAM_MAX,
    minModulesReady: FINAL_EXAM_MIN_MODULES_READY,
    minPerModule: FINAL_EXAM_MIN_PER_MODULE,
    maxModuleShare: FINAL_EXAM_MAX_SHARE,
    moduleWeights: FINAL_EXAM_WEIGHTS
  };
  const profile = raw.profiles && raw.profiles.finalExam ? raw.profiles.finalExam : fallback;
  const unlocked = new Set(modules.filter(m => !m.locked).map(m => normalizeModuleId(m.id)));
  const minQuestions = profile.minQuestions ?? fallback.minQuestions;
  const maxQuestions = profile.maxQuestions ?? fallback.maxQuestions;
  const resolvedTotal = clamp(
    profile.totalQuestions ?? fallback.totalQuestions,
    minQuestions,
    maxQuestions
  );
  return {
    ...fallback,
    ...profile,
    minQuestions,
    maxQuestions,
    totalQuestions: resolvedTotal,
    timeLimitSeconds: profile.timeLimitSeconds ?? resolvedTotal * 60,
    includeModules: (profile.includeModules || fallback.includeModules)
      .map((id)=> normalizeModuleId(id))
      .filter(id => unlocked.has(id))
  };
}

function getOrCreateChapterExamBundle(moduleId, pool, targetCount){
  const poolMap = new Map(pool.map(q => [q.id, q]));
  const stored = readStoredState(storageKey);
  if(stored?.finalExam?.questionIds?.length === targetCount){
    const valid = stored.finalExam.questionIds.every(id => poolMap.has(id));
    if(valid){
      const storedOrder = Array.isArray(stored.questionOrder)
        && stored.questionOrder.length === targetCount
        ? stored.questionOrder
        : stored.finalExam.questionIds;
      return { ...stored.finalExam, order: storedOrder };
    }
  }

  const seed = Math.floor(Math.random() * 2**31);
  const rng = seededRng(seed);
  const pbqTypes = new Set(["match", "order", "multi", "multi_not"]);
  const shuffledPbqs = seededShuffle(pool.filter(q => pbqTypes.has(q.type)), rng);
  const requiredPbqs = shuffledPbqs.slice(0, Math.min(3, targetCount));
  const requiredIds = new Set(requiredPbqs.map(q => q.id));
  const remaining = seededShuffle(
    pool.filter(q => !requiredIds.has(q.id)),
    rng
  );
  const selected = [
    ...requiredPbqs,
    ...remaining.slice(0, Math.max(0, targetCount - requiredPbqs.length))
  ];
  const shuffled = seededShuffle(selected, rng);
  const featured = shuffled.filter(q => pbqTypes.has(q.type)).slice(0, 3);
  const featuredIds = new Set(featured.map(q => q.id));
  const order = [
    ...featured,
    ...shuffled.filter(q => !featuredIds.has(q.id))
  ].map(q => q.id);
  const bundle = {
    seed: String(seed),
    moduleId,
    questionIds: selected.map(q => q.id),
    totalQuestions: selected.length,
    createdAt: new Date().toISOString()
  };
  writeStoredState(storageKey, {
    ...deepCopy(defaultState),
    finalExam: bundle,
    questionOrder: order
  });
  return { ...bundle, order };
}

function buildExamForModule(moduleId){
  const normalizedId = normalizeModuleId(moduleId);
  const moduleInfo = MODULES.find(m => m.id === normalizedId);
  const pool = RAW_DATA.questions.filter(q => q.module === normalizedId);
  let questions = pool;
  let order = null;
  if(CURRENT_COURSE?.domainMode && pool.length){
    const targetCount = Math.min(
      RAW_DATA.practiceQuestionCount || pool.length,
      pool.length
    );
    const bundle = getOrCreateChapterExamBundle(
      normalizedId,
      pool,
      targetCount
    );
    const questionMap = new Map(pool.map(q => [q.id, q]));
    questions = bundle.questionIds.map(id => questionMap.get(id)).filter(Boolean);
    order = bundle.order;
  }
  const title = moduleInfo
    ? `${CURRENT_COURSE?.domainMode ? `Chapter ${Number(normalizedId)}: ` : ""}${moduleInfo.title}`
    : `Module ${normalizedId}`;
  return {
    id: `MODULE_${normalizedId}`,
    title,
    mode: title,
    timeLimitSeconds: RAW_DATA.practiceTimeLimitSeconds ?? 25 * 60,
    questions,
    order
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

function selectDomainQuizQuestions(domain, rng){
  const target = Math.min(
    domain.quiz?.totalQuestions || 20,
    RAW_DATA.questions.filter(q => domain.chapterIds.includes(q.module)).length
  );
  const pools = {};
  domain.chapterIds.forEach((chapterId)=>{
    pools[chapterId] = seededShuffle(
      RAW_DATA.questions.filter(q => q.module === chapterId && !q.excludeFromDomainQuiz),
      rng
    );
  });

  const selected = [];
  const used = new Set();
  let round = 0;
  while(selected.length < target){
    let addedThisRound = false;
    for(const chapterId of domain.chapterIds){
      const candidate = pools[chapterId][round];
      if(candidate && !used.has(candidate.id)){
        selected.push(candidate);
        used.add(candidate.id);
        addedThisRound = true;
        if(selected.length >= target) break;
      }
    }
    if(!addedThisRound) break;
    round += 1;
  }

  if(selected.length < target){
    const remaining = seededShuffle(
      RAW_DATA.questions.filter(q =>
        domain.chapterIds.includes(q.module)
        && !q.excludeFromDomainQuiz
        && !used.has(q.id)
      ),
      rng
    );
    selected.push(...remaining.slice(0, target - selected.length));
  }
  return selected;
}

function getOrCreateDomainExamBundle(domain){
  const pool = RAW_DATA.questions.filter(q => domain.chapterIds.includes(q.module));
  const poolMap = new Map(pool.map(q => [q.id, q]));
  const stored = readStoredState(storageKey);
  if(stored?.finalExam?.questionIds?.length){
    const valid = stored.finalExam.questionIds.every(id => poolMap.has(id));
    if(valid){
      const storedOrder = Array.isArray(stored.questionOrder)
        && stored.questionOrder.length === stored.finalExam.questionIds.length
        ? stored.questionOrder
        : stored.finalExam.questionIds;
      return { ...stored.finalExam, order: storedOrder };
    }
  }

  const seed = Math.floor(Math.random() * 2**31);
  const rng = seededRng(seed);
  const selected = selectDomainQuizQuestions(domain, rng);
  const shuffled = seededShuffle(selected, rng);
  const pbqTypes = new Set(["match", "order", "multi", "multi_not"]);
  const pbqFirst = domain.quiz?.pbqFirst || 3;
  const featured = shuffled.filter(q => pbqTypes.has(q.type)).slice(0, pbqFirst);
  const featuredIds = new Set(featured.map(q => q.id));
  const order = [
    ...featured,
    ...shuffled.filter(q => !featuredIds.has(q.id))
  ].map(q => q.id);
  const bundle = {
    seed: String(seed),
    questionIds: selected.map(q => q.id),
    totalQuestions: selected.length,
    createdAt: new Date().toISOString()
  };
  writeStoredState(storageKey, {
    ...deepCopy(defaultState),
    finalExam: bundle,
    questionOrder: order
  });
  return { ...bundle, order };
}

function buildDomainExam(domainId){
  const domain = DOMAINS.find(item => item.id === normalizeModuleId(domainId));
  if(!domain) return null;
  const bundle = getOrCreateDomainExamBundle(domain);
  const questionMap = new Map(RAW_DATA.questions.map(q => [q.id, q]));
  return {
    id: `DOMAIN_${domain.id}`,
    title: `${domain.title} Test`,
    mode: `${domain.title} Test`,
    timeLimitSeconds: domain.quiz?.timeLimitSeconds || bundle.totalQuestions * 60,
    questions: bundle.questionIds.map(id => questionMap.get(id)).filter(Boolean),
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

function readStoredState(key){
  try{
    if(!key) return null;
    const raw = localStorage.getItem(key);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){
    console.warn("Failed to read stored state", e);
    return null;
  }
}

function writeStoredState(key, next){
  try{
    if(!key) return;
    localStorage.setItem(key, JSON.stringify(next));
  }catch(e){
    console.warn("Failed to write stored state", e);
  }
}

function getOrCreateFinalExamBundle(profile){
  const stored = readStoredState(storageKey);
  if(stored && stored.finalExam && Array.isArray(stored.finalExam.questionIds)){
    const map = new Map(RAW_DATA.questions.map(q => [q.id, q]));
    const valid = stored.finalExam.questionIds.length
      && stored.finalExam.questionIds.every(id => map.has(id));
    if(valid){
      const storedOrder = Array.isArray(stored.questionOrder)
        && stored.questionOrder.length === stored.finalExam.questionIds.length
        ? stored.questionOrder
        : null;
      return {
        ...stored.finalExam,
        order: storedOrder
      };
    }
  }

  const seed = Math.floor(Math.random() * 2**31);
  const rng = seededRng(seed);
  const questions = selectFinalExamQuestions(profile, rng);
  const shuffledQuestions = seededShuffle(questions, rng);
  let orderedQuestions = shuffledQuestions;
  if(profile.pbqFirst){
    const pbqTypes = new Set(["match", "order", "multi", "multi_not"]);
    const pbqs = shuffledQuestions.filter(q => pbqTypes.has(q.type));
    const featured = pbqs.slice(0, profile.pbqFirst);
    const featuredIds = new Set(featured.map(q => q.id));
    orderedQuestions = [
      ...featured,
      ...shuffledQuestions.filter(q => !featuredIds.has(q.id))
    ];
  }
  const order = orderedQuestions.map(q => q.id);
  const bundle = {
    seed: String(seed),
    questionIds: questions.map(q => q.id),
    totalQuestions: questions.length,
    createdAt: new Date().toISOString()
  };

  const nextState = {
    ...deepCopy(defaultState),
    finalExam: bundle,
    questionOrder: order
  };
  writeStoredState(storageKey, nextState);
  return { ...bundle, order };
}

function selectFinalExamQuestions(profile, rng){
  const includeModules = (profile.includeModules || []).map((id)=> normalizeModuleId(id));
  const eligible = RAW_DATA.questions.filter((q)=>{
    const inModule = includeModules.includes(q.module);
    return inModule && !q.excludeFromFinalExam;
  });

  const minQuestions = profile.minQuestions ?? FINAL_EXAM_MIN;
  const maxQuestions = profile.maxQuestions ?? FINAL_EXAM_MAX;
  const desiredCount = clamp(
    profile.totalQuestions || FINAL_EXAM_DEFAULT,
    minQuestions,
    maxQuestions
  );
  const eligiblePool = eligible.map((q)=>({
    ...q,
    difficulty: q.difficulty ?? 3,
    scenario: q.scenario ?? false
  }));
  console.log("FINAL: desiredCount", desiredCount);
  console.log("FINAL: unlockedModules", includeModules);
  console.log("FINAL: eligiblePool size", eligiblePool.length);
  console.log("FINAL: eligible modules breakdown", eligiblePool.reduce((m,q)=>{
    const k = String(q.module).padStart(2,"0");
    m[k] = (m[k]||0)+1;
    return m;
  }, {}));

  if(eligiblePool.length < minQuestions){
    console.warn("Final Exam pool too small:", eligiblePool.length);
    showToast(`Final Exam pool too small (${eligiblePool.length}).`);
  }

  if(!eligiblePool.length){
    return [];
  }

  const totalQuestions = Math.min(
    desiredCount,
    eligiblePool.length
  );
  const scenarioPct = profile.preferScenarioPct ?? FINAL_EXAM_SCENARIO_PCT;
  const scenarioTarget = Math.round(totalQuestions * (scenarioPct / 100));

  const modulePools = {};
  eligiblePool.forEach((q)=>{
    if(!modulePools[q.module]) modulePools[q.module] = [];
    modulePools[q.module].push(q);
  });

  const moduleIds = Object.keys(modulePools);
  const minPerModule = profile.minPerModule ?? FINAL_EXAM_MIN_PER_MODULE;
  const maxModuleShare = profile.maxModuleShare ?? FINAL_EXAM_MAX_SHARE;
  const minEligibleModules = moduleIds.filter(id => modulePools[id].length >= minPerModule);
  const minApplies = totalQuestions >= minEligibleModules.length * minPerModule;
  const maxPerModule = Math.ceil(totalQuestions * maxModuleShare);

  const configuredWeights = profile.moduleWeights ?? FINAL_EXAM_WEIGHTS;
  let useManualWeights = configuredWeights && Object.keys(configuredWeights).length;
  let weights = {};
  moduleIds.forEach((id)=>{
    const weight = useManualWeights
      ? (configuredWeights[id] ?? 0)
      : modulePools[id].length;
    weights[id] = weight;
  });

  let totalWeight = moduleIds.reduce((sum, id)=> sum + Math.max(0, weights[id]), 0);
  if(useManualWeights && totalWeight === 0){
    useManualWeights = false;
    weights = {};
    moduleIds.forEach((id)=>{
      weights[id] = modulePools[id].length;
    });
    totalWeight = moduleIds.reduce((sum, id)=> sum + Math.max(0, weights[id]), 0);
  }
  const allocations = {};
  let minTotal = 0;

  moduleIds.forEach((id)=>{
    const poolSize = modulePools[id].length;
    const weight = Math.max(0, weights[id]);
    const minForModule = (minApplies && poolSize >= minPerModule)
      && (!useManualWeights || weight > 0)
      ? Math.min(minPerModule, poolSize, maxPerModule)
      : 0;
    allocations[id] = minForModule;
    minTotal += minForModule;
  });

  let remainingSlots = totalQuestions - minTotal;
  if(remainingSlots < 0){
    remainingSlots = 0;
  }

  moduleIds.forEach((id)=>{
    const weight = Math.max(0, weights[id]);
    if(!weight || !totalWeight || remainingSlots <= 0) return;
    const add = Math.floor(remainingSlots * (weight / totalWeight));
    allocations[id] += add;
  });

  moduleIds.forEach((id)=>{
    const cap = Math.min(modulePools[id].length, maxPerModule);
    allocations[id] = Math.min(allocations[id], cap);
  });

  let allocated = Object.values(allocations).reduce((sum, v)=> sum + v, 0);
  while(allocated < totalQuestions){
    const sortable = moduleIds
      .map(id => ({
        id,
        weight: Math.max(0, weights[id]),
        remaining: Math.min(modulePools[id].length, maxPerModule) - allocations[id]
      }))
      .filter(mod => mod.remaining > 0 && (!useManualWeights || mod.weight > 0))
      .sort((a,b)=> b.remaining - a.remaining || b.weight - a.weight);
    if(!sortable.length) break;
    allocations[sortable[0].id] += 1;
    allocated += 1;
  }

  while(allocated > totalQuestions){
    const sortable = moduleIds
      .map(id => ({
        id,
        count: allocations[id],
        weight: Math.max(0, weights[id])
      }))
      .filter(mod => mod.count > 0)
      .sort((a,b)=> b.count - a.count || a.weight - b.weight);
    if(!sortable.length) break;
    allocations[sortable[0].id] -= 1;
    allocated -= 1;
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
    const remainingPool = seededShuffle(eligiblePool.filter(q => !selectedIds.has(q.id)), rng);
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

function shouldApplyMultiPartialCredit(q){
  const correctCount = Array.isArray(q.answer) ? q.answer.length : 0;
  return correctCount >= PARTIAL_CREDIT_MULTI_MIN_CORRECT || q.points >= PARTIAL_CREDIT_MIN_POINTS;
}

function scoreMultiPartial(q, selections){
  if(!Array.isArray(selections) || !Array.isArray(q.answer) || !q.answer.length){
    return 0;
  }
  const correct = new Set(q.answer);
  const student = new Set(selections);
  let tp = 0;
  let fp = 0;
  correct.forEach((idx)=>{
    if(student.has(idx)) tp += 1;
  });
  student.forEach((idx)=>{
    if(!correct.has(idx)) fp += 1;
  });
  const raw = (tp - fp) / correct.size;
  const fraction = clamp(raw, 0, 1);
  const earned = fraction * q.points;
  return Math.round(earned * 100) / 100;
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
      return `${d.text} -> ${term ? term.label : d.expect}`;
    }).join(" | ");
  }
  if(q.type === "order"){
    return q.answer.map((key)=>{
      const step = q.steps.find(s => s.key === key);
      return step ? step.label : key;
    }).join(" -> ");
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
      return `${d.text} -> ${term ? term.label : d.expect}`;
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
        if(ans.length === key.length && ans.every((v,i)=>v===key[i])){
          qEarn = q.points;
        }else if(shouldApplyMultiPartialCredit(q)){
          qEarn = scoreMultiPartial(q, ans);
        }
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
  const metaParts = [];
  if(
    EXAM
    && (
      (FINAL_PROFILE && EXAM.id === FINAL_PROFILE.id)
      || currentProfile === "domain"
    )
  ){
    const moduleInfo = MODULES.find(m => m.id === q.module);
    if(moduleInfo){
      metaParts.push(
        CURRENT_COURSE?.domainMode
          ? `Chapter ${Number(moduleInfo.id)}: ${moduleInfo.title}`
          : moduleInfo.title
      );
    }
  }
  metaParts.push(questionTypeLabel(q));
  metaParts.push(`${q.points} pt${q.points===1?"":"s"}`);
  setText("qMeta", metaParts.join(" | "));
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
    status.textContent = correct ? "Correct" : "Incorrect";
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
  setHidden("resultBox", false);
  setHidden("helpPanel", true);

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

function renderCourseCatalog(){
  const grid = el("courseGrid");
  if(!grid) return;
  grid.innerHTML = "";

  (COURSE_MANIFEST.courses || []).forEach((course)=>{
    const isOpen = course.status === "open";
    const tile = document.createElement("div");
    tile.className = `courseTile${isOpen ? "" : " locked"}`;
    tile.title = isOpen ? `Open ${course.title}` : "Coming soon";

    const title = document.createElement("div");
    title.className = "courseTitle";
    title.textContent = course.title;

    const meta = document.createElement("div");
    meta.className = "courseMeta";
    meta.textContent = `${course.meta || ""}${course.meta ? " | " : ""}${isOpen ? "Ready" : "Coming soon"}`;

    const status = document.createElement("div");
    status.className = isOpen ? "tag" : "lockBadge";
    status.innerHTML = isOpen ? "<strong>Open</strong>" : "Locked";

    tile.appendChild(title);
    tile.appendChild(meta);
    tile.appendChild(status);
    tile.addEventListener("click", async ()=>{
      if(!isAuthed()) return;
      if(!isOpen){
        showToast(`${course.title} is coming soon.`);
        return;
      }
      try{
        showToast(`Loading ${course.title}...`);
        await activateCourse(course.id);
        setView(VIEW_MODULES);
      }catch(e){
        console.error(`Failed to open ${course.title}`, e);
        showToast(`Failed to load ${course.title}.`);
      }
    });

    grid.appendChild(tile);
  });
}

async function activateCourse(courseId){
  const course = (COURSE_MANIFEST.courses || []).find(item => item.id === courseId);
  if(!course || course.status !== "open"){
    throw new Error(`Course is unavailable: ${courseId}`);
  }

  let raw = courseDataCache.get(courseId);
  if(!raw){
    raw = await window.loadExamData(courseId);
    courseDataCache.set(courseId, raw);
  }

  CURRENT_COURSE = course;
  currentCourseId = courseId;
  localStorage.setItem(CURRENT_COURSE_KEY, courseId);
  RAW_DATA = deepCopy(raw);
  RAW_DATA.questions = normalizeQuestions(RAW_DATA);
  MODULES = buildModules(RAW_DATA);
  DOMAINS = buildDomains(RAW_DATA, MODULES);
  SUPPLEMENTAL_SECTIONS = buildSupplementalSections(RAW_DATA, MODULES);
  FINAL_PROFILE = buildFinalProfile(RAW_DATA, MODULES);

  setText("moduleViewTitle", course.moduleHeading || `${course.title} Module Select`);
  setText(
    "moduleViewMeta",
    course.moduleMeta || "Choose a module or launch the Final Exam. Modules without questions are locked."
  );
  renderModuleSelect();
}

function appendTextItems(containerId, items){
  const container = el(containerId);
  container.innerHTML = "";
  (items || []).forEach((item)=>{
    const node = document.createElement("li");
    node.textContent = item;
    container.appendChild(node);
  });
}

function renderModuleReview(moduleId){
  const normalizedId = normalizeModuleId(moduleId);
  const mod = MODULES.find(item => item.id === normalizedId);
  if(!mod) return;

  reviewModuleId = normalizedId;
  currentDomainId = getCourseDomainIdForModule(mod);
  localStorage.setItem(getReviewModuleKey(currentCourseId), normalizedId);
  const isSupplemental = mod.supplemental === true
    || mod.scored === false
    || SUPPLEMENTAL_SECTIONS.some(section => section.chapterIds.includes(normalizedId));
  setText(
    "reviewObjective",
    isSupplemental
      ? "Supplemental | Unscored"
      : (mod.objective ? `Objective ${mod.objective}` : `Module ${mod.id}`)
  );
  setText(
    "reviewTitle",
    CURRENT_COURSE.domainMode
      ? `Chapter ${Number(mod.id)}: ${mod.title}`
      : (mod.title || `Module ${mod.id}`)
  );
  setText("reviewDomain", mod.domain || CURRENT_COURSE.meta || CURRENT_COURSE.title);
  setText("reviewSummary", mod.summary || "Review the key concepts, then launch practice.");
  const quizCount = Math.min(
    RAW_DATA.practiceQuestionCount || mod.questionCount,
    mod.questionCount
  );
  setText(
    "btnStartModulePractice",
    isSupplemental
      ? `Start ${quizCount}-Question Practice`
      : CURRENT_COURSE.domainMode
      ? `Start ${quizCount}-Question Quiz`
      : "Start Practice"
  );

  const terms = el("reviewKeyTerms");
  terms.innerHTML = "";
  (mod.keyTerms || []).forEach((term)=>{
    const chip = document.createElement("span");
    chip.className = "termChip";
    chip.textContent = term;
    terms.appendChild(chip);
  });

  appendTextItems("reviewFacts", mod.mustKnowFacts);
  appendTextItems("reviewTraps", mod.commonTraps);

  const scenarios = el("reviewScenarios");
  scenarios.innerHTML = "";
  (mod.miniScenarios || []).forEach((scenario, index)=>{
    const card = document.createElement("div");
    card.className = "scenarioCard";
    const title = document.createElement("strong");
    const body = document.createElement("span");
    if(typeof scenario === "string"){
      title.textContent = `Scenario ${index + 1}`;
      body.textContent = scenario;
    }else{
      title.textContent = scenario.title || `Scenario ${index + 1}`;
      body.textContent = scenario.text || "";
    }
    card.appendChild(title);
    card.appendChild(body);
    scenarios.appendChild(card);
  });

  setView(VIEW_REVIEW);
}

function openModule(moduleId){
  if(CURRENT_COURSE && CURRENT_COURSE.reviewMode){
    renderModuleReview(moduleId);
  }else{
    startModuleExam(moduleId);
  }
}

function appendFinalExamTile(grid){
  const finalTile = document.createElement("div");
  const unlockedCount = FINAL_PROFILE.includeModules.length;
  const minModulesReady = FINAL_PROFILE.minModulesReady ?? FINAL_EXAM_MIN_MODULES_READY;
  const eligibleCount = RAW_DATA.questions.filter(q =>
    FINAL_PROFILE.includeModules.includes(q.module) && !q.excludeFromFinalExam
  ).length;
  const finalReady = unlockedCount >= minModulesReady
    && eligibleCount >= Math.min(FINAL_PROFILE.totalQuestions, FINAL_PROFILE.minQuestions);
  finalTile.className = `courseTile${finalReady ? "" : " locked"}`;

  const finalTitle = document.createElement("div");
  finalTitle.className = "courseTitle";
  finalTitle.textContent = "Final Exam";

  const finalMeta = document.createElement("div");
  finalMeta.className = "courseMeta";
  const questionLabel = FINAL_PROFILE.minQuestions === FINAL_PROFILE.maxQuestions
    ? `${FINAL_PROFILE.totalQuestions} Questions`
    : `${FINAL_PROFILE.minQuestions}-${FINAL_PROFILE.maxQuestions} Questions`;
  const timeLabel = `${Math.round(FINAL_PROFILE.timeLimitSeconds / 60)} Minutes`;
  finalMeta.textContent = `${questionLabel} | ${timeLabel} | ${
    finalReady ? "Ready" : `Requires ${minModulesReady}+ ready modules`
  }`;

  finalTile.appendChild(finalTitle);
  finalTile.appendChild(finalMeta);
  if(finalReady){
    const finalTag = document.createElement("div");
    finalTag.className = "tag";
    finalTag.innerHTML = "<strong>Launch</strong>";
    finalTile.appendChild(finalTag);

    const regenTag = document.createElement("button");
    regenTag.type = "button";
    regenTag.className = "tag";
    regenTag.innerHTML = "<strong>Regenerate</strong>";
    regenTag.addEventListener("click", (event)=>{
      event.stopPropagation();
      localStorage.removeItem(buildStorageKey({
        courseId: currentCourseId,
        profile: "final"
      }));
      startFinalExam();
    });
    finalTile.appendChild(regenTag);
  }else{
    const lock = document.createElement("div");
    lock.className = "lockBadge";
    lock.textContent = "Locked";
    finalTile.appendChild(lock);
  }

  finalTile.addEventListener("click", ()=>{
    if(!finalReady){
      showToast("Final exam requires more ready modules or questions.");
      return;
    }
    startFinalExam();
  });

  grid.appendChild(finalTile);
}

function renderClsModuleTiles(grid){
  MODULES.forEach((mod)=>{
    const tile = document.createElement("div");
    tile.className = `courseTile${mod.locked ? " locked" : ""}`;

    const title = document.createElement("div");
    title.className = "courseTitle";
    title.textContent = mod.title || `Module ${mod.id}`;

    const meta = document.createElement("div");
    meta.className = "courseMeta";
    const count = mod.questionCount || 0;
    meta.textContent = count > 0
      ? `Ready | ${count} question${count === 1 ? "" : "s"}`
      : "Locked / Coming soon";

    const tag = document.createElement("div");
    tag.className = mod.locked ? "lockBadge" : "tag";
    tag.innerHTML = mod.locked ? "Locked" : "<strong>Start</strong>";

    tile.appendChild(title);
    tile.appendChild(meta);
    tile.appendChild(tag);
    tile.addEventListener("click", ()=>{
      if(mod.locked){
        showToast("Module content coming soon.");
        return;
      }
      startModuleExam(mod.id);
    });
    grid.appendChild(tile);
  });
}

function renderSecurityDomainTiles(grid){
  DOMAINS.forEach((domain)=>{
    const tile = document.createElement("div");
    tile.className = `courseTile domainTile${domain.locked ? " locked" : ""}`;

    const title = document.createElement("div");
    title.className = "courseTitle";
    title.textContent = domain.title;

    const firstChapter = Number(domain.chapterIds[0]);
    const lastChapter = Number(domain.chapterIds[domain.chapterIds.length - 1]);
    const meta = document.createElement("div");
    meta.className = "courseMeta";
    meta.textContent = `Chapters ${firstChapter}-${lastChapter} | ${domain.questionCount} questions`;

    const tag = document.createElement("div");
    tag.className = domain.locked ? "lockBadge" : "tag";
    tag.innerHTML = domain.locked ? "Locked" : "<strong>Open Domain</strong>";

    tile.appendChild(title);
    tile.appendChild(meta);
    tile.appendChild(tag);
    tile.addEventListener("click", ()=>{
      if(domain.locked){
        showToast("Domain content is not ready.");
        return;
      }
      renderDomainSelect(domain.id);
    });
    grid.appendChild(tile);
  });
}

function renderSupplementalTiles(grid){
  SUPPLEMENTAL_SECTIONS.forEach((section)=>{
    section.chapterIds.forEach((chapterId)=>{
      const chapter = MODULES.find(module => module.id === chapterId);
      if(!chapter) return;

      const locked = section.locked || chapter.locked;
      const tile = document.createElement("div");
      tile.className = `courseTile supplementalTile${locked ? " locked" : ""}`;
      tile.title = section.description || "Supplemental study material";

      const title = document.createElement("div");
      title.className = "courseTitle";
      title.textContent = `Supplemental: ${section.title || chapter.title}`;

      const meta = document.createElement("div");
      meta.className = "courseMeta";
      meta.textContent = `Chapter ${Number(chapter.id)} | ${
        chapter.questionCount
      }-question pool | Unscored`;

      const tag = document.createElement("div");
      tag.className = locked ? "lockBadge" : "tag";
      tag.innerHTML = locked
        ? "Locked"
        : "<strong>Review &amp; Practice</strong>";

      tile.appendChild(title);
      tile.appendChild(meta);
      tile.appendChild(tag);
      tile.addEventListener("click", ()=>{
        if(locked){
          showToast("Supplemental content is not ready.");
          return;
        }
        openModule(chapter.id);
      });
      grid.appendChild(tile);
    });
  });
}

function renderModuleSelect(){
  const grid = el("moduleGrid");
  if(!grid || !CURRENT_COURSE || !FINAL_PROFILE) return;
  grid.innerHTML = "";
  currentDomainId = null;

  if(CURRENT_COURSE.domainMode){
    renderSecurityDomainTiles(grid);
    renderSupplementalTiles(grid);
  }else{
    renderClsModuleTiles(grid);
  }
  appendFinalExamTile(grid);
}

function renderDomainSelect(domainId){
  const normalizedId = normalizeModuleId(domainId);
  const domain = DOMAINS.find(item => item.id === normalizedId);
  if(!domain) return;

  currentDomainId = normalizedId;
  localStorage.setItem(getCurrentDomainKey(currentCourseId), normalizedId);
  setText("domainObjective", `Domain ${Number(domain.id)}`);
  setText("domainViewTitle", domain.title);
  setText(
    "domainViewMeta",
    `Chapters ${Number(domain.chapterIds[0])}-${Number(domain.chapterIds[domain.chapterIds.length - 1])} | Choose a chapter quiz or launch the randomized domain test.`
  );

  const grid = el("chapterGrid");
  grid.innerHTML = "";
  domain.chapterIds.forEach((chapterId)=>{
    const chapter = MODULES.find(module => module.id === chapterId);
    if(!chapter) return;

    const tile = document.createElement("div");
    tile.className = `courseTile${chapter.locked ? " locked" : ""}`;

    const title = document.createElement("div");
    title.className = "courseTitle";
    title.textContent = `Chapter ${Number(chapter.id)}: ${chapter.title}`;

    const meta = document.createElement("div");
    meta.className = "courseMeta";
    const quizCount = Math.min(
      RAW_DATA.practiceQuestionCount || chapter.questionCount,
      chapter.questionCount
    );
    meta.textContent = `${quizCount}-question randomized quiz | ${chapter.questionCount}-question pool${
      chapter.objective ? ` | Objective ${chapter.objective}` : ""
    }`;

    const tag = document.createElement("div");
    tag.className = chapter.locked ? "lockBadge" : "tag";
    tag.innerHTML = chapter.locked ? "Locked" : "<strong>Review &amp; Practice</strong>";

    tile.appendChild(title);
    tile.appendChild(meta);
    tile.appendChild(tag);
    if(!chapter.locked){
      const newQuizTag = document.createElement("button");
      newQuizTag.type = "button";
      newQuizTag.className = "tag";
      newQuizTag.innerHTML = "<strong>New Quiz</strong>";
      newQuizTag.addEventListener("click", (event)=>{
        event.stopPropagation();
        localStorage.removeItem(buildStorageKey({
          courseId: currentCourseId,
          profile: "module",
          moduleId: chapter.id
        }));
        startModuleExam(chapter.id);
      });
      tile.appendChild(newQuizTag);
    }
    tile.addEventListener("click", ()=>{
      if(chapter.locked){
        showToast("Chapter content is not ready.");
        return;
      }
      openModule(chapter.id);
    });
    grid.appendChild(tile);
  });

  const quizTile = document.createElement("div");
  quizTile.className = "courseTile domainQuizTile";
  const quizTitle = document.createElement("div");
  quizTitle.className = "courseTitle";
  quizTitle.textContent = `${domain.title} Test`;
  const quizMeta = document.createElement("div");
  quizMeta.className = "courseMeta";
  quizMeta.textContent = `${domain.quiz.totalQuestions} random questions | ${
    Math.round(domain.quiz.timeLimitSeconds / 60)
  } minutes | All domain chapters`;
  const quizTag = document.createElement("div");
  quizTag.className = "tag";
  quizTag.innerHTML = "<strong>Launch Domain Test</strong>";
  const regenTag = document.createElement("button");
  regenTag.type = "button";
  regenTag.className = "tag";
  regenTag.innerHTML = "<strong>Regenerate</strong>";
  regenTag.addEventListener("click", (event)=>{
    event.stopPropagation();
    localStorage.removeItem(buildStorageKey({
      courseId: currentCourseId,
      profile: "domain",
      moduleId: domain.id
    }));
    startDomainExam(domain.id);
  });
  quizTile.appendChild(quizTitle);
  quizTile.appendChild(quizMeta);
  quizTile.appendChild(quizTag);
  quizTile.appendChild(regenTag);
  quizTile.addEventListener("click", ()=> startDomainExam(domain.id));
  grid.appendChild(quizTile);

  setView(VIEW_DOMAIN);
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
  if(CURRENT_COURSE?.domainMode){
    const module = MODULES.find(item => item.id === normalizedId);
    currentDomainId = getCourseDomainIdForModule(module);
  }
  setExamContext({ courseId: currentCourseId, profile: "module", moduleId: normalizedId });
  const exam = buildExamForModule(normalizedId);
  const key = storageKey;
  localStorage.setItem(
    getLastExamKey(currentCourseId),
    JSON.stringify({ type: "module", id: normalizedId })
  );
  setExamSession(exam, key, exam.order);
}

function startDomainExam(domainId){
  const normalizedId = normalizeModuleId(domainId);
  currentDomainId = normalizedId;
  setExamContext({ courseId: currentCourseId, profile: "domain", moduleId: normalizedId });
  const exam = buildDomainExam(normalizedId);
  if(!exam || !exam.questions.length){
    showToast("No domain questions are available.");
    return;
  }
  localStorage.setItem(
    getLastExamKey(currentCourseId),
    JSON.stringify({ type: "domain", id: normalizedId })
  );
  setExamSession(exam, storageKey, exam.order);
}

function startFinalExam(){
  setExamContext({ courseId: currentCourseId, profile: "final", moduleId: null });
  const exam = buildFinalExam();
  localStorage.setItem(
    getLastExamKey(currentCourseId),
    JSON.stringify({ type: "final" })
  );
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
    if(CURRENT_COURSE?.domainMode && currentProfile !== "final" && currentDomainId){
      renderDomainSelect(currentDomainId);
    }else{
      renderModuleSelect();
      setView(VIEW_MODULES);
    }
  });

  el("btnBackToModuleSelect").addEventListener("click", ()=>{
    if(CURRENT_COURSE?.domainMode && currentDomainId){
      renderDomainSelect(currentDomainId);
    }else{
      setView(VIEW_MODULES);
    }
  });

  el("btnBackToDomains").addEventListener("click", ()=>{
    renderModuleSelect();
    setView(VIEW_MODULES);
  });

  el("btnStartModulePractice").addEventListener("click", ()=>{
    if(reviewModuleId){
      startModuleExam(reviewModuleId);
    }
  });

  el("btnLogin").addEventListener("click", handleLogin);
  el("loginPass").addEventListener("keydown", (e)=>{
    if(e.key === "Enter") handleLogin();
  });

  document.querySelectorAll(".logoutBtn").forEach(btn => {
    btn.addEventListener("click", handleLogout);
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
    setHidden("resultBox", false);
    setHidden("helpPanel", true);
  }else{
    setHidden("resultBox", true);
    setHidden("helpPanel", false);
  }

  renderQuestion();
}

/* -------------------------
   Init
------------------------- */

async function init(){
  try{
    COURSE_MANIFEST = await window.loadCourseManifest();
  }catch(e){
    console.error("Failed to load course catalog", e);
    showToast("Failed to load course catalog.");
    return;
  }

  bindUI();
  renderCourseCatalog();

  if(isAuthed()){
    currentView = localStorage.getItem(VIEW_KEY) || VIEW_COURSES;
  }

  if(isAuthed() && currentView !== VIEW_COURSES){
    try{
      const savedCourseId = localStorage.getItem(CURRENT_COURSE_KEY) || "cls";
      await activateCourse(savedCourseId);

      if(currentView === VIEW_DOMAIN && CURRENT_COURSE.domainMode){
        const savedDomainId = localStorage.getItem(getCurrentDomainKey(savedCourseId));
        if(savedDomainId && DOMAINS.some(domain => domain.id === normalizeModuleId(savedDomainId))){
          renderDomainSelect(savedDomainId);
          return;
        }
        currentView = VIEW_MODULES;
      }

      if(currentView === VIEW_REVIEW && CURRENT_COURSE.reviewMode){
        const savedModuleId = localStorage.getItem(getReviewModuleKey(savedCourseId));
        if(savedModuleId && MODULES.some(mod => mod.id === normalizeModuleId(savedModuleId))){
          const module = MODULES.find(mod => mod.id === normalizeModuleId(savedModuleId));
          currentDomainId = getCourseDomainIdForModule(module);
          renderModuleReview(savedModuleId);
          return;
        }
        currentView = VIEW_MODULES;
      }

      if(currentView === VIEW_EXAM){
        const lastExam = JSON.parse(
          localStorage.getItem(getLastExamKey(savedCourseId)) || "{}"
        );
        if(lastExam.type === "module" && lastExam.id){
          startModuleExam(lastExam.id);
          return;
        }
        if(lastExam.type === "domain" && lastExam.id){
          startDomainExam(lastExam.id);
          return;
        }
        if(lastExam.type === "final"){
          startFinalExam();
          return;
        }
        currentView = VIEW_MODULES;
      }
    }catch(e){
      console.warn("Failed to restore course state", e);
      currentView = VIEW_COURSES;
    }
  }
  renderView();
}

init();
