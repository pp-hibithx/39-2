import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!url || !service) {
      throw new Error("Supabase環境変数を取得できません");
    }

    const supabase = createClient(url, service, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const form = await req.formData();
    const file = form.get("file");
    const syncId = String(form.get("sync_id") || "").trim();

    if (!(file instanceof File)) {
      return json({ error: "画像ファイルがありません" }, 400);
    }
    if (!syncId) {
      return json({ error: "同期コードがありません" }, 400);
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(file.type)) {
      return json({ error: "対応していない画像形式です" }, 400);
    }

    if (file.size > 8 * 1024 * 1024) {
      return json({ error: "画像は8MB以下にしてください" }, 400);
    }

    // Existing 39*2 cloud-sync code must be valid before upload.
    const { data: backup, error: verifyError } = await supabase.rpc(
      "get_39x2_backup",
      { p_id: syncId },
    );

    if (verifyError) {
      return json({ error: "同期コードの確認に失敗しました" }, 400);
    }

    if (!backup) {
      return json({ error: "有効な同期コードではありません" }, 400);
    }

    const rawExt = (file.name.split(".").pop() || "jpg")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    const ext = ["jpg", "jpeg", "png", "webp", "gif"].includes(rawExt)
      ? rawExt
      : "jpg";

    const path = `${syncId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("trpg-images")
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return json({ error: "画像の保存に失敗しました" }, 400);
    }

    const { data } = supabase.storage
      .from("trpg-images")
      .getPublicUrl(path);

    return json({
      ok: true,
      publicUrl: data.publicUrl,
      path,
    });
  } catch {
    return json({ error: "画像アップロードに失敗しました" }, 400);
  }
});
