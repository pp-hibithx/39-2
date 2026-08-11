(() => {
  "use strict";

  const KEYS = {
    scenarios: "39x2_scenarios_v3",
    events: "39x2_events_v1",
    album: "39x2_album_v2"
  };

  const uuid = () => {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return "evt_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,10);
  };

  const load = key => {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };

  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  const nowISO = () => new Date().toISOString();

  function normalizeEvent(input = {}) {
    const id = input.id || uuid();
    return {
      schemaVersion: 1,
      id,
      type: input.type || "trpg",
      source: input.source || "39x2",
      title: input.title || "",
      scenarioId: input.scenarioId || "",
      scenarioTitle: input.scenarioTitle || input.title || "",
      start: input.start || "",
      end: input.end || "",
      status: input.status || "planned",
      role: input.role || "",
      participants: Array.isArray(input.participants) ? input.participants : [],
      pcName: input.pcName || "",
      system: input.system || "",
      visibility: input.visibility || "private",
      linkedAlbumId: input.linkedAlbumId || "",
      createdAt: input.createdAt || nowISO(),
      updatedAt: nowISO()
    };
  }

  function normalizeAlbum(input = {}) {
    return {
      schemaVersion: 2,
      id: input.id || uuid(),
      eventId: input.eventId || "",
      scenarioId: input.scenarioId || "",
      title: input.title || "",
      date: input.date || "",
      system: input.system || "",
      role: input.role || "PL",
      pcName: input.pcName || "",
      participants: Array.isArray(input.participants) ? input.participants : [],
      imageUrls: Array.isArray(input.imageUrls) ? input.imageUrls : [],
      comment: input.comment || "",
      spoiler: input.spoiler || "",
      externalLinks: Array.isArray(input.externalLinks) ? input.externalLinks : [],
      visibility: input.visibility || "private",
      createdAt: input.createdAt || nowISO(),
      updatedAt: nowISO()
    };
  }

  
  function encodeShare(data) {
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    let bin = "";
    bytes.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  }

  function makeShareUrl(data) {
    const base = new URL("../share/", location.href);
    base.hash = encodeShare(data);
    return base.href;
  }


  function makeShortShareUrl(id) {
    return new URL("../share/?id=" + encodeURIComponent(id), location.href).href;
  }

window.TRPG39 = {
    KEYS,
    uuid,
    loadScenarios: () => load(KEYS.scenarios),
    saveScenarios: v => save(KEYS.scenarios,
    v),
    loadEvents: () => load(KEYS.events),
    saveEvents: v => save(KEYS.events,
    v),
    loadAlbum: () => load(KEYS.album),
    saveAlbum: v => save(KEYS.album,
    v),
    normalizeEvent,
    normalizeAlbum,
    encodeShare,
    makeShareUrl,
    makeShortShareUrl
  };
})();
;(function(){
  const api=window.TRPG39=window.TRPG39||{};
  const parse=(k)=>{try{return JSON.parse(localStorage.getItem(k)||"[]")}catch{return []}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  if(!api.loadPCs) api.loadPCs=()=>parse("trpg39_pcs");
  if(!api.savePCs) api.savePCs=v=>save("trpg39_pcs",v);
  if(!api.loadPlayers) api.loadPlayers=()=>parse("trpg39_players");
  if(!api.savePlayers) api.savePlayers=v=>save("trpg39_players",v);
})();

;(function(){
  const api=window.TRPG39=window.TRPG39||{};
  const norm=s=>String(s||"").normalize("NFKC").trim().toLowerCase();
  api.findPCByName=api.findPCByName||function(name){
    const pcs=api.loadPCs?api.loadPCs():[];
    return pcs.find(p=>norm(p.name)===norm(name))||null;
  };
  api.ensurePC=api.ensurePC||function(name,defaults={}){
    const clean=String(name||"").trim(); if(!clean)return null;
    let pcs=api.loadPCs?api.loadPCs():[];
    let found=pcs.find(p=>norm(p.name)===norm(clean));
    if(found)return found;
    const id=api.uuid?api.uuid():crypto.randomUUID();
    const pc={id,name:clean,reading:"",system:defaults.system||"",job:"",image:"",sheet:"",visibility:"private",bio:"",autoCreated:true};
    pcs.push(pc); api.savePCs&&api.savePCs(pcs); return pc;
  };
})();

;(function(){
  const api=window.TRPG39=window.TRPG39||{};
  const norm=s=>String(s||"").normalize("NFKC").replace(/\s+/g,"").toLowerCase();
  if(!api.findScenarioByTitle){
    api.findScenarioByTitle=function(title){
      const xs=api.loadScenarios?api.loadScenarios():[];
      return xs.find(x=>norm(x.title)===norm(title))||null;
    };
  }
  if(!api.ensureScenario){
    api.ensureScenario=function(title,defaults={}){
      const clean=String(title||"").trim(); if(!clean)return null;
      let xs=api.loadScenarios?api.loadScenarios():[];
      let found=xs.find(x=>norm(x.title)===norm(clean));
      if(found)return found;
      const id=api.uuid?api.uuid():(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random());
      const item={id,title:clean,system:defaults.system||"",author:"",status:"owned",sourceUrl:"",thumbnailUrl:"",playersMin:null,playersMax:null,hoursMin:null,hoursMax:null,flags:{},memo:"",autoCreated:true};
      xs.unshift(item); api.saveScenarios&&api.saveScenarios(xs); return item;
    };
  }
})();
