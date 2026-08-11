(()=>{
 const apply=()=>{
  const enabled=window.TRPG39?.playersEnabled?.()||false;
  document.querySelectorAll('.nav a').forEach(a=>{
   const t=(a.textContent||"").trim();
   if(t==="PLAYERS")a.hidden=!enabled;
  });
 };
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",apply);else apply();
 window.addEventListener("39x2:players-setting",apply);
})();