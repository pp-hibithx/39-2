(()=>{
  const ACCESS_KEY = "cocoabiscuit";
  const ACCESS_STORAGE = "sakumeru_beta_access_v1";

  // Existing installations are treated as already-authorized.
  // This keeps current developer/tester browsers working after the update.
  const hasExistingData = () => {
    try{
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i)||"";
        if(
          k.startsWith("trpg39_") ||
          k.startsWith("sakumeru_") ||
          k.startsWith("trpgthx_")
        ){
          if(k!==ACCESS_STORAGE)return true;
        }
      }
    }catch(e){}
    return false;
  };

  try{
    if(localStorage.getItem(ACCESS_STORAGE)==="ok" || hasExistingData()){
      localStorage.setItem(ACCESS_STORAGE,"ok");
      return;
    }
  }catch(e){}

  document.documentElement.style.visibility="hidden";

  const unlock=()=>{
    const value=prompt(
      "SAKU+MERUは現在テスト公開中です。\n\n"+
      "利用にはテスター用アクセスキーが必要です。"
    );
    if(value===ACCESS_KEY){
      try{localStorage.setItem(ACCESS_STORAGE,"ok")}catch(e){}
      document.documentElement.style.visibility="";
      location.reload();
      return;
    }
    document.documentElement.style.visibility="";
    document.addEventListener("DOMContentLoaded",()=>{
      document.body.innerHTML=`
        <main style="max-width:720px;margin:12vh auto;padding:24px;font-family:system-ui,sans-serif;line-height:1.8">
          <h1>SAKU+MERU 🌺</h1>
          <h2>現在テスト公開中です</h2>
          <p>SAKU+MERUは現在、開発者とテスターのみ利用できます。</p>
          <p>卓報告などの共有ページは、そのままご覧いただけます。</p>
          <button id="retryBetaAccess" type="button" style="padding:8px 14px">アクセスキーを入力</button>
        </main>`;
      document.getElementById("retryBetaAccess")?.addEventListener("click",()=>location.reload());
    });
  };

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",unlock,{once:true});
  else unlock();
})();