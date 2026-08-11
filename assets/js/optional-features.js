(()=>{
  const PLAYERS_KEY="39x2_players_enabled_v1";

  const playersEnabled=()=>localStorage.getItem(PLAYERS_KEY)==="1";

  const setVisible=(el, visible)=>{
    if(!el)return;
    if(visible){
      el.hidden=false;
      el.style.removeProperty("display");
    }else{
      el.hidden=true;
      el.style.setProperty("display","none","important");
    }
  };

  const apply=()=>{
    const enabled=playersEnabled();

    document.querySelectorAll("[data-home-players-card]").forEach(el=>{
      setVisible(el, enabled);
    });

    document.querySelectorAll(".nav a").forEach(a=>{
      if((a.textContent||"").trim()==="PLAYERS"){
        setVisible(a, enabled);
      }
    });
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded", apply);
  }else{
    apply();
  }

  window.addEventListener("39x2:players-setting", apply);
  window.addEventListener("storage", e=>{
    if(e.key===PLAYERS_KEY) apply();
  });

  window.TRPG39OptionalFeatures={apply};
})();