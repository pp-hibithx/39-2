(() => {
"use strict";

const cfg = window.SUPABASE_CONFIG || {};
if (cfg.projectUrl) cfg.projectUrl = String(cfg.projectUrl).trim();
if (cfg.publishableKey) cfg.publishableKey = String(cfg.publishableKey).trim();
const SYNC_KEY = "39x2_cloud_sync_id_v1";

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
async function saveCloud(){ const id=ensureSyncId(); await rpc("save_39x2_backup",{p_id:id,p_data:snapshot()}); return id; }
async function loadCloud(id=getSyncId()){
  id=(id||"").trim(); if(!id) throw new Error("同期コードを入力してください。");
  const data=await rpc("get_39x2_backup",{p_id:id});
  if(!data || !Array.isArray(data.scenarios) || !Array.isArray(data.events) || !Array.isArray(data.album)) throw new Error("この同期コードのデータが見つかりません。");
  TRPG39.saveScenarios(data.scenarios); TRPG39.saveEvents(data.events); TRPG39.saveAlbum(data.album); setSyncId(id); return data;
}
window.TRPG39Sync={configured,getSyncId,setSyncId,ensureSyncId,saveCloud,loadCloud};
})();
