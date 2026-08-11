import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") throw new Error("POST only");
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, service, { auth: { persistSession: false } });

    const form = await req.formData();
    const file = form.get("file");
    const syncId = String(form.get("sync_id") || "").trim();
    if (!(file instanceof File)) throw new Error("画像ファイルがありません");
    if (!syncId) throw new Error("同期コードがありません");
    if (!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)) throw new Error("対応していない画像形式です");
    if (file.size > 8 * 1024 * 1024) throw new Error("画像は8MB以下にしてください");

    // 39*2で既に使っているRPCをservice roleで呼び、同期コードが実在することを確認。
    const { data: backup, error: verifyError } = await supabase.rpc("get_39x2_backup", { p_id: syncId });
    if (verifyError) throw new Error("同期コード確認に失敗しました: " + verifyError.message);
    if (!backup) throw new Error("有効な同期コードではありません");

    const rawExt = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
    const ext = ["jpg","jpeg","png","webp","gif"].includes(rawExt) ? rawExt : "jpg";
    const path = `${syncId}/${crypto.randomUUID()}.${ext}`;
    const { error: upError } = await supabase.storage.from("trpg-images").upload(path, file, { contentType: file.type, upsert: false });
    if (upError) throw new Error("保存に失敗しました: " + upError.message);
    const { data } = supabase.storage.from("trpg-images").getPublicUrl(path);
    return new Response(JSON.stringify({ ok:true, publicUrl:data.publicUrl, path }), { headers:{...corsHeaders,"Content-Type":"application/json"} });
  } catch (e) {
    return new Response(JSON.stringify({ error:e instanceof Error?e.message:String(e) }), { status:400, headers:{...corsHeaders,"Content-Type":"application/json"} });
  }
});
