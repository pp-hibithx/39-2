
(()=>{"use strict";
const KEY="trpg39_theme";
const valid=new Set(["system","dark","light"]);
const root=document.documentElement;

function resolve(mode){
  if(mode==="dark"||mode==="light")return mode;
  return matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";
}
function currentMode(){
  const v=localStorage.getItem(KEY)||"system";
  return valid.has(v)?v:"system";
}
function apply(mode){
  const safe=valid.has(mode)?mode:"system";
  root.dataset.theme=resolve(safe);
  document.documentElement.classList.toggle("theme-light", root.dataset.theme==="light");
  document.documentElement.classList.toggle("theme-dark", root.dataset.theme==="dark");
  root.dataset.themeMode=safe;
  document.querySelectorAll("[data-theme-choice]").forEach(b=>{
    b.setAttribute("aria-pressed",String(b.dataset.themeChoice===safe));
  });
}
function set(mode){
  localStorage.setItem(KEY,mode);
  apply(mode);
}
window.TRPG39Theme={set,apply,currentMode};
apply(currentMode());

matchMedia("(prefers-color-scheme: light)").addEventListener?.("change",()=>{
  if(currentMode()==="system")apply("system");
});

document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll("[data-theme-choice]").forEach(b=>{
    b.addEventListener("click",()=>set(b.dataset.themeChoice));
  });
  apply(currentMode());
});
})();
