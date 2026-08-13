(()=>{
  const ACCESS_KEY = "cocoabiscuit";
  const ACCESS_STORAGE = "sakumeru_beta_access_v1";

  // Public share pages do not load this file.
  // App pages require explicit beta authorization once per browser.
  try{
    if(localStorage.getItem(ACCESS_STORAGE)==="ok") return;
  }catch(e){}

  document.documentElement.style.visibility="hidden";

  const showGate=()=>{
    document.documentElement.style.visibility="";
    document.body.innerHTML=`
      <main style="max-width:720px;margin:12vh auto;padding:24px;font-family:system-ui,sans-serif;line-height:1.8">
        <h1>SAKU+MERU 🌺</h1>
        <h2>現在テスト公開中です</h2>
        <p>SAKU+MERUは現在、開発者・テスター向けに公開しています。</p>
        <p>利用するにはテスター用アクセスキーを入力してください。</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:16px">
          <input id="betaAccessKey" type="password" autocomplete="off" placeholder="アクセスキー"
            style="min-width:240px;padding:8px 10px">
          <button id="betaAccessButton" type="button" style="padding:8px 14px">入る</button>
        </div>
        <p id="betaAccessError" style="color:#b33;min-height:1.5em"></p>
        <p style="margin-top:18px;font-size:13px;opacity:.75">共有ページの閲覧やサイト説明、各種ツールはそのままお使いいただけます。</p>
        <p style="margin-top:18px;font-size:13px;opacity:.75">本体はテスター募集中です。DMにてお声がけください。</p>
      </main>`;

    const input=document.getElementById("betaAccessKey");
    const button=document.getElementById("betaAccessButton");
    const error=document.getElementById("betaAccessError");

    const submit=()=>{
      if(input.value===ACCESS_KEY){
        try{localStorage.setItem(ACCESS_STORAGE,"ok")}catch(e){}
        location.reload();
        return;
      }
      error.textContent="アクセスキーが違います。";
      input.select();
    };

    button.addEventListener("click",submit);
    input.addEventListener("keydown",e=>{if(e.key==="Enter")submit()});
    input.focus();
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",showGate,{once:true});
  }else{
    showGate();
  }
})();