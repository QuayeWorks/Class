const COURSE_MANIFEST_URL = "course_manifest.json";
const APP_VERSION = "2.1.0";

let manifestPromise = null;

async function fetchJson(url, label){
  const separator = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${separator}v=${APP_VERSION}`, { cache: "no-store" });
  if(!res.ok){
    throw new Error(`Failed to load ${label}: ${res.status}`);
  }
  return res.json();
}

async function loadCourseManifest(){
  if(!manifestPromise){
    manifestPromise = fetchJson(COURSE_MANIFEST_URL, "course manifest");
  }
  return manifestPromise;
}

async function loadExamData(courseId){
  const manifest = await loadCourseManifest();
  const course = (manifest.courses || []).find((item)=> item.id === courseId);
  if(!course || !course.sourceUrl){
    throw new Error(`Unknown course: ${courseId}`);
  }
  return fetchJson(course.sourceUrl, `${course.title || courseId} exam data`);
}

window.loadCourseManifest = loadCourseManifest;
window.loadExamData = loadExamData;
