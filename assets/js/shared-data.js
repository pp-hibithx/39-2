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
    const legacyStatus = input.status === "confirmed" ? "planned" : input.status;
    return {
      schemaVersion: 2,
      id,
      type: input.type || "trpg",
      source: input.source || "39x2",
      title: input.title || "",
      scenarioId: input.scenarioId || "",
      scenarioTitle: input.scenarioTitle || input.title || "",
      start: input.start || "",
      end: input.end || "",
      status: legacyStatus || "planned",
      role: input.role || "",
      participants: Array.isArray(input.participants) ? input.participants : [],
      participantIds: Array.isArray(input.participantIds) ? input.participantIds : [],
      pcName: input.pcName || "",
      pcId: input.pcId || "",
      system: input.system || "",
      facilitatorLabel: input.facilitatorLabel || "",
      facilitatorless: !!input.facilitatorless,
      visibility: input.visibility || "private",
      linkedAlbumId: input.linkedAlbumId || "",
      runId: input.runId || "",
      runLabel: input.runLabel || "",
      sessionDay: Number(input.sessionDay || 0),
      sessionKind: ["prelude","main","reserve","aftertalk"].includes(input.sessionKind) ? input.sessionKind : "main",
      calendarMemo: input.calendarMemo || "",
      calendarColor: input.calendarColor || "",
      timeBand: input.timeBand || "",
      timeSpecified: input.timeSpecified !== undefined ? !!input.timeSpecified : /T\d{2}:\d{2}/.test(String(input.start || "")),
      createdAt: input.createdAt || nowISO(),
      updatedAt: nowISO()
    };
  }

  function normalizeAlbum(input = {}) {
    const legacyStatus = input.status === "confirmed" ? "planned" : input.status;
    const start = input.start || (input.date ? input.date + "T21:00" : "");
    return {
      schemaVersion: 3,
      id: input.id || uuid(),
      eventId: input.eventId || "",
      scenarioId: input.scenarioId || "",
      title: input.title || "",
      date: input.date || String(start || "").slice(0,10),
      start,
      end: input.end || "",
      status: legacyStatus || (input.eventId ? "planned" : "done"),
      system: input.system || "",
      facilitatorLabel: input.facilitatorLabel || "",
      facilitatorless: !!input.facilitatorless,
      role: input.role || "PL",
      selfHo: input.selfHo || "",
      pcName: input.pcName || "",
      pcId: input.pcId || "",
      participants: Array.isArray(input.participants) ? input.participants : [],
      participantIds: Array.isArray(input.participantIds) ? input.participantIds : [],
      participantRows: Array.isArray(input.participantRows) ? input.participantRows.map(r => ({
        role: String(r?.role || "PL"),
        ho: String(r?.ho || ""),
        plName: String(r?.plName || ""),
        playerId: String(r?.playerId || ""),
        pcName: String(r?.pcName || ""),
        relation: String(r?.relation || "")
      })) : [],
      imageUrls: Array.isArray(input.imageUrls) ? input.imageUrls : [],
      comment: input.comment || "",
      articleBody: input.articleBody || "",
      spoilerBody: input.spoilerBody || "",
      spoiler: input.spoiler || "",
      spoilerVisibility: input.spoilerVisibility || "private",
      externalLinks: Array.isArray(input.externalLinks) ? input.externalLinks : [],
      diceAnalyses: Array.isArray(input.diceAnalyses) ? input.diceAnalyses : [],
      visibility: input.visibility || "private",
      runId: input.runId || "",
      runLabel: input.runLabel || "",
      sessionDay: Number(input.sessionDay || 0),
      timeBand: input.timeBand || "",
      timeSpecified: input.timeSpecified !== undefined ? !!input.timeSpecified : /T\d{2}:\d{2}/.test(String(input.start || "")),
      shareId: input.shareId || "",
      shareVersion: Number(input.shareVersion || 0),
      calendarLinked: !!input.eventId,
      createdAt: input.createdAt || nowISO(),
      updatedAt: nowISO()
    };
  }

  function albumFromEvent(event, existing = {}) {
    const e = normalizeEvent(event);
    return normalizeAlbum({
      ...existing,
      eventId: e.id,
      scenarioId: e.scenarioId,
      title: e.title,
      date: String(e.start || "").slice(0,10),
      start: e.start,
      end: e.end,
      status: e.status,
      system: e.system,
      facilitatorLabel: e.facilitatorLabel || existing.facilitatorLabel || "",
      facilitatorless: e.facilitatorless !== undefined ? e.facilitatorless : !!existing.facilitatorless,
      role: e.role || existing.role || "PL",
      selfHo: existing.selfHo || "",
      pcName: e.pcName,
      pcId: e.pcId,
      participants: e.participants,
      participantIds: e.participantIds,
      runId: e.runId || existing.runId || "",
      runLabel: e.runLabel || existing.runLabel || "",
      sessionDay: e.sessionDay || existing.sessionDay || 0,
      timeBand: e.timeBand || existing.timeBand || "",
      timeSpecified: e.timeSpecified,
      visibility: existing.visibility || e.visibility || "private"
    });
  }

  function syncEventToAlbum(event) {
    const e = normalizeEvent(event);
    if (e.type === "blocked") return null;
    const album = load(KEYS.album);
    const existing = album.find(a => a.eventId === e.id || (e.linkedAlbumId && a.id === e.linkedAlbumId));
    const item = albumFromEvent(e, existing || {});
    const i = existing ? album.findIndex(a => a.id === existing.id) : -1;
    if (i >= 0) album[i] = item; else album.unshift(item);
    save(KEYS.album, album);
    return item;
  }

  function syncAllEventsToAlbum() {
    let events = load(KEYS.events).map(normalizeEvent);
    let album = load(KEYS.album);
    let changed = false;

    // CALENDAR-only blocked entries must never remain in LIBRARY.
    // v0.2.27.2 could have created linked album rows before blocked events
    // were separated, so clean those legacy linked rows during migration.
    const blockedEventIds = new Set(events.filter(e => e.type === "blocked" || e.status === "blocked").map(e => e.id));
    const blockedAlbumIds = new Set(events.filter(e => e.type === "blocked" || e.status === "blocked").map(e => e.linkedAlbumId).filter(Boolean));
    const beforeCleanup = album.length;
    album = album.filter(a => !(a.eventId && blockedEventIds.has(a.eventId)) && !blockedAlbumIds.has(a.id));
    if (album.length !== beforeCleanup) changed = true;

    events = events.map(e => {
      if (e.type === "blocked" || e.status === "blocked") {
        if (e.linkedAlbumId) { e.linkedAlbumId = ""; changed = true; }
        return e;
      }
      const existing = album.find(a => a.eventId === e.id || (e.linkedAlbumId && a.id === e.linkedAlbumId));
      const item = albumFromEvent(e, existing || {});
      if (existing) {
        const i = album.findIndex(a => a.id === existing.id);
        album[i] = item;
      } else {
        album.unshift(item);
      }
      if (e.linkedAlbumId !== item.id) { e.linkedAlbumId = item.id; changed = true; }
      return e;
    });
    if (events.length || album.length) {
      save(KEYS.events, events);
      save(KEYS.album, album);
    }
    return {events, album, changed};
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

  function defaultFacilitatorLabel(system = "") {
    const t = String(system || "").normalize("NFKC").toLowerCase();
    if (/emoklore|エモクロア/.test(t)) return "DL";
    if (/coc|クトゥルフ|call of cthulhu/.test(t)) return "KP";
    if (/マダミス|マーダーミステリー|murder mystery/.test(t)) return "GM";
    return "GM";
  }

  function resolveFacilitatorLabel(system = "", source = {}) {
    const mode = String(source.facilitatorTermMode || "auto");
    if (mode === "custom") return String(source.facilitatorTermCustom || "GM").trim() || "GM";
    if (["KP","DL","GM"].includes(mode)) return mode;
    return defaultFacilitatorLabel(system);
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
    albumFromEvent,
    syncEventToAlbum,
    syncAllEventsToAlbum,
    encodeShare,
    makeShareUrl,
    makeShortShareUrl,
    defaultFacilitatorLabel,
    resolveFacilitatorLabel
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

;(function(){
 const api=window.TRPG39=window.TRPG39||{};
 const KEY="39x2_players_enabled_v1";
 api.playersEnabled=function(){return localStorage.getItem(KEY)==="1"};
 api.setPlayersEnabled=function(v){localStorage.setItem(KEY,v?"1":"0");window.dispatchEvent(new CustomEvent("39x2:players-setting",{detail:{enabled:!!v}}))};
})();

;(function(){
 const api=window.TRPG39=window.TRPG39||{};
 const norm=s=>String(s||"").normalize("NFKC").trim().toLowerCase();
 if(!api.ensurePlayer){
   api.ensurePlayer=function(name){
     const clean=String(name||"").trim();if(!clean)return null;
     let xs=api.loadPlayers?api.loadPlayers():JSON.parse(localStorage.getItem("39x2_players_v1")||"[]");
     let found=xs.find(x=>norm(x.name)===norm(clean));if(found)return found;
     const item={id:api.uuid?api.uuid():crypto.randomUUID(),name:clean,memo:"",autoCreated:true};
     xs.unshift(item);
     if(api.savePlayers)api.savePlayers(xs);else localStorage.setItem("39x2_players_v1",JSON.stringify(xs));
     return item;
   };
 }
})();
