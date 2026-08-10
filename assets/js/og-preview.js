(()=>{"use strict";
function config(){return window.SUPABASE_CONFIG||{};}
function configured(){const c=config();return !!(c.projectUrl&&c.publishableKey&&!String(c.publishableKey).includes("PASTE_YOUR"));}
async function fetchPreview(url){
  if(!configured())throw new Error("SupabaseのPublishable keyが未設定です。");
  const c=config();
  const endpoint=String(c.projectUrl).replace(/\/$/,"")+"/functions/v1/og-preview";
  let res;
  try{
    res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","apikey":c.publishableKey},body:JSON.stringify({url})});
  }catch(e){throw new Error("サムネイル取得サーバーに接続できませんでした。");}
  let body={};try{body=await res.json()}catch{}
  if(!res.ok)throw new Error(body.error||("サムネイル取得に失敗しました（"+res.status+"）"));
  return body;
}
window.TRPG39OG={fetch:fetchPreview,configured};
})();
