(()=>{"use strict";
const KEY="trpg39_theme";
const valid=new Set(["system","dark","light"]);
const root=document.documentElement;
const mq=window.matchMedia("(prefers-color-scheme: light)");
function resolve(mode){return mode==="light"||mode==="dark"?mode:(mq.matches?"light":"dark")}
function currentMode(){try{const v=localStorage.getItem(KEY)||"system";return valid.has(v)?v:"system"}catch{return "system"}}
function syncButtons(mode){document.querySelectorAll("[data-theme-choice]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.themeChoice===mode)))}
function apply(mode){
 const safe=valid.has(mode)?mode:"system", resolved=resolve(safe);
 root.setAttribute("data-theme",resolved);
 root.setAttribute("data-theme-mode",safe);
 root.classList.remove("theme-light","theme-dark");
 root.classList.add(resolved==="light"?"theme-light":"theme-dark");
 root.style.colorScheme=resolved;
 syncButtons(safe);
 return resolved;
}
function set(mode){const safe=valid.has(mode)?mode:"system";try{localStorage.setItem(KEY,safe)}catch{};apply(safe)}
window.TRPG39Theme={set,apply,currentMode};
document.addEventListener("click",e=>{const b=e.target.closest?.("[data-theme-choice]");if(b){e.preventDefault();set(b.dataset.themeChoice)}});
document.addEventListener("DOMContentLoaded",()=>apply(currentMode()));
mq.addEventListener?.("change",()=>{if(currentMode()==="system")apply("system")});
window.addEventListener("storage",e=>{if(e.key===KEY)apply(currentMode())});
apply(currentMode());
})();
