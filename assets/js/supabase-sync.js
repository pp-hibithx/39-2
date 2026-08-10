(() => {
"use strict";

const cfg = window.SUPABASE_CONFIG || {};
if (cfg.projectUrl) cfg.projectUrl = String(cfg.projectUrl).trim();
if (cfg.publishableKey) cfg.publishableKey = String(cfg.publishableKey).trim();
const SYNC_KEY = "39x2_cloud_sync_id_v1";
const AUTO_KEY = "39x2_cloud_auto_sync_v1";
const LAST_SYNC_KEY = "39x2_cloud_last_sync_at_v1";
let suppressAutoPush = false;
let pushTimer = null;

function configured() {
  const url = String(cfg.projectUrl || "").trim();
  const key = String(cfg.publishableKey || "").trim();
  const placeholder = !key || /PASTE_YOUR_|YOUR_SUPABASE|ここに/i.test(key);
  return /^https:\/\/.+\.supabase\.co$/i.test(url) && !placeholder && key.length >= 20;
}
function headers() { return {"apikey": cfg.publishableKey, "Content-Type":"application/json"}; }
function randomId(len=24) {
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes=new Uint8Array(len); crypto.getRandomValues(bytes);
  let out=""; for(const b of bytes) out += chars[b % chars.length]; return out;
}
function getSyncId(){ return localStorage.getItem(SYNC_KEY) || ""; }
function setSyncId(id){ localStorage.setItem(SYNC_KEY, (id||"").trim()); }
function ensureSyncId(){ let id=getSyncId(); if(!id){ id=randomId(); setSyncId(id); } return id; }
function getAutoSync(){ return localStorage.getItem(AUTO_KEY) === "1"; }
function setAutoSync(on){ localStorage.setItem(AUTO_KEY, on ? "1" : "0"); }
function getLastSyncAt(){ return localStorage.getItem(LAST_SYNC_KEY) || ""; }
function setLastSyncAt(v){ if(v) localStorage.setItem(LAST_SYNC_KEY, v); }
function snapshot(){
  return {app:"39*2",schemaVersion:1,savedAt:new Date().toISOString(),
    scenarios:TRPG39.loadScenarios(),events:TRPG39.loadEvents(),album:TRPG39.loadAlbum()};
}
async function rpc(name, body){
  if(!configured()) throw new Error("SupabaseのPublishable keyが未設定です。");
  const res=await fetch(cfg.projectUrl+"/rest/v1/rpc/"+name,{method:"POST",headers:headers(),body:JSON.stringify(body)});
  if(!res.ok){ const text=await res.text(); throw new Error((text||"通信に失敗しました。").slice(0,240)); }
  if(res.status===204) return null;
  const text=await res.text(); return text ? JSON.parse(text) : null;
}
async function saveCloud(){
  const id=ensureSyncId();
  const data=snapshot();
  await rpc("save_39x2_backup",{p_id:id,p_data:data});
  setLastSyncAt(data.savedAt);
  return id;
}
async function loadCloud(id=getSyncId()){
  id=(id||"").trim(); if(!id) throw new Error("同期コードを入力してください。");
  const data=await rpc("get_39x2_backup",{p_id:id});
  if(!data || !Array.isArray(data.scenarios) || !Array.isArray(data.events) || !Array.isArray(data.album)) throw new Error("この同期コードのデータが見つかりません。");
  suppressAutoPush=true;
  try {
    TRPG39.saveScenarios(data.scenarios); TRPG39.saveEvents(data.events); TRPG39.saveAlbum(data.album);
  } finally { suppressAutoPush=false; }
  setSyncId(id); setLastSyncAt(data.savedAt || new Date().toISOString()); return data;
}
function scheduleAutoPush(){
  if(suppressAutoPush || !getAutoSync() || !getSyncId() || !configured()) return;
  clearTimeout(pushTimer);
  pushTimer=setTimeout(()=>{ saveCloud().catch(err=>console.warn("39*2 auto sync push failed:",err)); },300);
}
function patchSaves(){
  if(!window.TRPG39 || TRPG39.__cloudPatched) return;
  ["saveScenarios","saveEvents","saveAlbum"].forEach(name=>{
    const original=TRPG39[name];
    TRPG39[name]=function(v){ const out=original.call(TRPG39,v); scheduleAutoPush(); return out; };
  });
  TRPG39.__cloudPatched=true;
}
async function autoPullIfNewer(){
  if(!getAutoSync() || !getSyncId() || !configured()) return false;
  const data=await rpc("get_39x2_backup",{p_id:getSyncId()});
  if(!data || !Array.isArray(data.scenarios) || !Array.isArray(data.events) || !Array.isArray(data.album)) return false;
  const cloudAt=String(data.savedAt||"");
  const localAt=getLastSyncAt();
  if(cloudAt && localAt && cloudAt <= localAt) return false;
  suppressAutoPush=true;
  try {
    TRPG39.saveScenarios(data.scenarios); TRPG39.saveEvents(data.events); TRPG39.saveAlbum(data.album);
  } finally { suppressAutoPush=false; }
  setLastSyncAt(cloudAt || new Date().toISOString());
  return true;
}
async function initAutoSync(){
  patchSaves();
  if(!getAutoSync()) return;
  try {
    const changed=await autoPullIfNewer();
    if(changed && !sessionStorage.getItem("39x2_cloud_reloaded")) {
      sessionStorage.setItem("39x2_cloud_reloaded","1");
      location.reload();
    } else {
      sessionStorage.removeItem("39x2_cloud_reloaded");
    }
  } catch(err) { console.warn("39*2 auto sync pull failed:",err); }
}

window.TRPG39Sync={configured,getSyncId,setSyncId,ensureSyncId,getAutoSync,setAutoSync,getLastSyncAt,saveCloud,loadCloud,scheduleAutoPush,autoPullIfNewer,initAutoSync};
})();
