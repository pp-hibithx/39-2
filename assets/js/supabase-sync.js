(() => {
"use strict";

const cfg = window.SUPABASE_CONFIG || {};
if (cfg.projectUrl) cfg.projectUrl = String(cfg.projectUrl).trim();
if (cfg.publishableKey) cfg.publishableKey = String(cfg.publishableKey).trim();

const SYNC_KEY = "39x2_cloud_sync_id_v1";
const AUTO_KEY = "39x2_cloud_auto_sync_v1";
const LAST_SYNC_KEY = "39x2_cloud_last_sync_at_v1";
const STATUS_EVENT = "39x2-sync-status";
let suppressAutoPush = false;
let pushTimer = null;
let currentStatus = {state:"idle", message:""};

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
function setAutoSync(on){ localStorage.setItem(AUTO_KEY, on ? "1" : "0"); updateBadgeVisibility(); }
function getLastSyncAt(){ return localStorage.getItem(LAST_SYNC_KEY) || ""; }
function setLastSyncAt(v){ if(v) localStorage.setItem(LAST_SYNC_KEY, v); }
function snapshot(){
  return {app:"39*2",schemaVersion:1,savedAt:new Date().toISOString(),
    scenarios:TRPG39.loadScenarios(),events:TRPG39.loadEvents(),album:TRPG39.loadAlbum(),
    pcs:TRPG39.loadPCs?TRPG39.loadPCs():[],players:TRPG39.loadPlayers?TRPG39.loadPlayers():[]};
}
function emitStatus(state, message){
  currentStatus={state,message:message||""};
  window.dispatchEvent(new CustomEvent(STATUS_EVENT,{detail:currentStatus}));
  renderBadge();
}
function getStatus(){ return {...currentStatus}; }

async function rpc(name, body){
  if(!configured()) throw new Error("SupabaseのPublishable keyが未設定です。");
  const res=await fetch(cfg.projectUrl+"/rest/v1/rpc/"+name,{method:"POST",headers:headers(),body:JSON.stringify(body)});
  if(!res.ok){ const text=await res.text(); throw new Error((text||"通信に失敗しました。").slice(0,240)); }
  if(res.status===204) return null;
  const text=await res.text(); return text ? JSON.parse(text) : null;
}
async function getCloud(id=getSyncId()){
  id=(id||"").trim();
  if(!id) return null;
  return rpc("get_39x2_backup",{p_id:id});
}
function isValidSnapshot(data){
  return !!data && Array.isArray(data.scenarios) && Array.isArray(data.events) && Array.isArray(data.album);
}
function conflictError(){
  const e=new Error("他の端末に、まだこの端末へ読み込んでいない新しい変更があります。");
  e.code="SYNC_CONFLICT";
  return e;
}
async function saveCloud(options={}){
  const id=ensureSyncId();
  emitStatus("syncing","同期中…");
  try {
    if(!options.force){
      const remote=await getCloud(id);
      const remoteAt=remote && String(remote.savedAt||"");
      const localAt=getLastSyncAt();
      if(remoteAt && localAt && remoteAt > localAt) throw conflictError();
    }
    const data=snapshot();
    await rpc("save_39x2_backup",{p_id:id,p_data:data});
    setLastSyncAt(data.savedAt);
    emitStatus("synced","同期済み");
    return id;
  } catch(err){
    if(err && err.code==="SYNC_CONFLICT") emitStatus("conflict","他端末に新しい変更あり");
    else emitStatus("error","同期エラー");
    throw err;
  }
}
async function loadCloud(id=getSyncId()){
  id=(id||"").trim(); if(!id) throw new Error("同期コードを入力してください。");
  emitStatus("syncing","読み込み中…");
  try {
    const data=await getCloud(id);
    if(!isValidSnapshot(data)) throw new Error("この同期コードのデータが見つかりません。");
    suppressAutoPush=true;
    try {
      TRPG39.saveScenarios(data.scenarios); TRPG39.saveEvents(data.events); TRPG39.saveAlbum(data.album);
      if(TRPG39.savePCs) TRPG39.savePCs(Array.isArray(data.pcs)?data.pcs:[]);
      if(TRPG39.savePlayers) TRPG39.savePlayers(Array.isArray(data.players)?data.players:[]);
    } finally { suppressAutoPush=false; }
    setSyncId(id); setLastSyncAt(data.savedAt || new Date().toISOString());
    emitStatus("synced","同期済み");
    return data;
  } catch(err){
    emitStatus("error","読み込みエラー");
    throw err;
  }
}
function scheduleAutoPush(){
  if(suppressAutoPush || !getAutoSync() || !getSyncId() || !configured()) return;
  clearTimeout(pushTimer);
  emitStatus("pending","保存待ち…");
  pushTimer=setTimeout(()=>{
    saveCloud().catch(err=>console.warn("39*2 auto sync push failed:",err));
  },450);
}
function patchSaves(){
  if(!window.TRPG39 || TRPG39.__cloudPatched) return;
  ["saveScenarios","saveEvents","saveAlbum","savePCs","savePlayers"].forEach(name=>{
    const original=TRPG39[name];
    if(typeof original!=="function") return;
    TRPG39[name]=function(v){ const out=original.call(TRPG39,v); scheduleAutoPush(); return out; };
  });
  TRPG39.__cloudPatched=true;
}
async function autoPullIfNewer(){
  if(!getAutoSync() || !getSyncId() || !configured()) return false;
  emitStatus("checking","確認中…");
  const data=await getCloud(getSyncId());
  if(!isValidSnapshot(data)){ emitStatus("synced","同期済み"); return false; }
  const cloudAt=String(data.savedAt||"");
  const localAt=getLastSyncAt();
  if(cloudAt && localAt && cloudAt <= localAt){ emitStatus("synced","同期済み"); return false; }
  suppressAutoPush=true;
  try {
    TRPG39.saveScenarios(data.scenarios); TRPG39.saveEvents(data.events); TRPG39.saveAlbum(data.album);
      if(TRPG39.savePCs) TRPG39.savePCs(Array.isArray(data.pcs)?data.pcs:[]);
      if(TRPG39.savePlayers) TRPG39.savePlayers(Array.isArray(data.players)?data.players:[]);
  } finally { suppressAutoPush=false; }
  setLastSyncAt(cloudAt || new Date().toISOString());
  emitStatus("synced","同期済み");
  return true;
}

function ensureBadge(){
  if(document.getElementById("cloudSyncBadge")) return;
  const badge=document.createElement("button");
  badge.id="cloudSyncBadge";
  badge.type="button";
  badge.className="cloud-sync-badge";
  badge.title="クラウド同期状態。クリックでBACKUPを開きます。";
  badge.addEventListener("click",()=>{
    const backupUrl=new URL("./backup/", location.href);
    if(location.pathname.includes("/scenario/") || location.pathname.includes("/calendar/") || location.pathname.includes("/library/") || location.pathname.includes("/tools/") || location.pathname.includes("/about/") || location.pathname.includes("/share/") || location.pathname.includes("/bridge/") || location.pathname.includes("/backup/")){
      backupUrl.href=new URL("../backup/", location.href).href;
    }
    location.href=backupUrl.href;
  });
  document.body.appendChild(badge);
  updateBadgeVisibility();
  renderBadge();
}
function updateBadgeVisibility(){
  const badge=document.getElementById("cloudSyncBadge");
  if(badge) badge.hidden=!getAutoSync();
}
function renderBadge(){
  const badge=document.getElementById("cloudSyncBadge"); if(!badge) return;
  const map={
    idle:["☁","同期待機"],checking:["☁","確認中…"],pending:["☁","保存待ち…"],
    syncing:["☁","同期中…"],synced:["✓","同期済み"],conflict:["⚠","他端末に新しい変更あり"],error:["⚠","同期エラー"]
  };
  const pair=map[currentStatus.state]||map.idle;
  badge.dataset.state=currentStatus.state;
  badge.textContent=pair[0]+" "+(currentStatus.message||pair[1]);
}
function initBadge(){
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",ensureBadge,{once:true});
  else ensureBadge();
}
async function initAutoSync(){
  patchSaves(); initBadge();
  if(!getAutoSync()){ emitStatus("idle","同期OFF"); return; }
  if(!configured()){ emitStatus("error","同期設定エラー"); return; }
  try {
    const changed=await autoPullIfNewer();
    if(changed && !sessionStorage.getItem("39x2_cloud_reloaded")) {
      sessionStorage.setItem("39x2_cloud_reloaded","1");
      location.reload();
    } else {
      sessionStorage.removeItem("39x2_cloud_reloaded");
      emitStatus("synced","同期済み");
    }
  } catch(err) {
    emitStatus("error","同期エラー");
    console.warn("39*2 auto sync pull failed:",err);
  }
}

window.TRPG39Sync={configured,getSyncId,setSyncId,ensureSyncId,getAutoSync,setAutoSync,getLastSyncAt,getStatus,saveCloud,loadCloud,scheduleAutoPush,autoPullIfNewer,initAutoSync};
})();

// v0.2.26 optional feature preference bridge
window.addEventListener("39x2:players-setting",()=>{ try{ window.TRPG39Sync?.scheduleSync?.(); }catch{} });
