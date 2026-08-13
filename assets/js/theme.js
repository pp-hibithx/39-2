(()=>{"use strict";
const KEY="trpg39_theme";
const valid=new Set(["system","dark","light"]);
const root=document.documentElement;
const mq=matchMedia("(prefers-color-scheme: light)");

function resolve(mode){
  if(mode==="dark"||mode==="light") return mode;
  return mq.matches ? "light" : "dark";
}
function currentMode(){
  const v=localStorage.getItem(KEY)||"system";
  return valid.has(v)?v:"system";
}
function syncButtons(mode){
  document.querySelectorAll("[data-theme-choice]").forEach(b=>{
    b.setAttribute("aria-pressed",String(b.dataset.themeChoice===mode));
  });
}
function apply(mode){
  const safe=valid.has(mode)?mode:"system";
  const resolved=resolve(safe);
  root.dataset.theme=resolved;
  root.dataset.themeMode=safe;
  root.classList.toggle("theme-light",resolved==="light");
  root.classList.toggle("theme-dark",resolved==="dark");
  syncButtons(safe);
}
function set(mode){
  const safe=valid.has(mode)?mode:"system";
  localStorage.setItem(KEY,safe);
  apply(safe);
}

window.TRPG39Theme={set,apply,currentMode};

// Works regardless of where/when the theme buttons are rendered.
document.addEventListener("click",e=>{
  const b=e.target.closest?.("[data-theme-choice]");
  if(b) set(b.dataset.themeChoice);
});

document.addEventListener("DOMContentLoaded",()=>apply(currentMode()));

mq.addEventListener?.("change",()=>{
  if(currentMode()==="system") apply("system");
});

window.addEventListener("storage",e=>{
  if(e.key===KEY) apply(currentMode());
});

apply(currentMode());
})();
