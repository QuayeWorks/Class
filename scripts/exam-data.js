const EXAM_SOURCE_URL = "cls_question_bank_v1.json";
const APP_VERSION = "1.0.3";

async function loadExamData(){
  const res = await fetch(`${EXAM_SOURCE_URL}?v=${APP_VERSION}`, { cache: "no-store" });
  if(!res.ok){
    throw new Error(`Failed to load exam data: ${res.status}`);
  }
  return res.json();
}

window.loadExamData = loadExamData;
