import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_BASE_URL = (Deno.env.get("SITE_BASE_URL") || "https://pp-hibithx.github.io/39-2").replace(/\/$/, "");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BUCKET = "share-previews";

function log(step: string, detail?: unknown) {
  if (detail === undefined) console.log(`[share-preview] ${step}`);
  else console.log(`[share-preview] ${step}`, detail);
}

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
      "Cache-Control": "no-store",
    },
  });
}

function esc(v: unknown) {
  return String(v ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c] || c)
  );
}

function versionedImage(raw: string, version: string) {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    u.searchParams.set("saku_og", version);
    return u.href;
  } catch {
    return raw;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
    return json({ error: "Supabase環境変数を取得できません" }, 500);
  }

  try {
    log("開始");
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    const version = String(body?.version || Date.now()).replace(/[^0-9A-Za-z_-]/g, "");

    if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) {
      log("共有IDエラー", id);
      return json({ error: "共有IDが正しくありません" }, 400);
    }
    log("共有ID確認", id);

    // 共有ページ本体と同じ方法で取得する。
    // get_shared_page は Publishable/anon key からのRPCで正常動作しているため、
    // Service Role client 経由ではなく同じHTTP RPCを使う。
    log("共有データ取得開始");
    const sharedRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_shared_page`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_id: id }),
    });
    if (!sharedRes.ok) {
      const detail = await sharedRes.text();
      console.error("[share-preview] 共有データ取得失敗", sharedRes.status, detail);
      return json({ error: "共有データを読み込めませんでした", status: sharedRes.status, detail }, 502);
    }
    log("共有データ取得成功");
    const p = await sharedRes.json();
    if (!p) {
      log("共有データなし");
      return json({ error: "共有データが見つかりません" }, 404);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const isLibrary = p.kind === "library-session";
    const title = isLibrary && p.title ? `${p.title}｜SAKU+MERU` : "SAKU+MERU";
    const desc = isLibrary
      ? ([p.date || "", p.system || "", p.role || ""].filter(Boolean).join(" / ")
        || "SAKU+MERUで共有されたセッション記録です。")
      : "「一緒に」探す・遊ぶ・記録・共有。卓のあれこれをサクッとまとめるサイト。";

    const image = isLibrary ? versionedImage(String(p.image || ""), version) : "";
    const target = `${SITE_BASE_URL}/share/?id=${encodeURIComponent(id)}&v=${encodeURIComponent(version)}`;
    const imageMeta = image
      ? `\n<meta property="og:image" content="${esc(image)}">\n<meta property="og:image:secure_url" content="${esc(image)}">\n<meta name="twitter:image" content="${esc(image)}">`
      : "";
    const card = image ? "summary_large_image" : "summary";

    const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="SAKU+MERU">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(target)}">${imageMeta}
<meta name="twitter:card" content="${card}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head>
<body>
<p><a href="${esc(target)}">SAKU+MERUの共有ページを開く</a></p>
<script>location.replace(${JSON.stringify(target)})<\/script>
</body>
</html>`;

    log("HTML生成成功");
    // Ensure the bucket exists and is public.
    log("Storage bucket確認開始");
    const { data: bucketData, error: bucketLookupError } = await supabase.storage.getBucket(BUCKET);
    if (bucketLookupError) log("Storage bucket確認エラー", bucketLookupError.message);
    if (!bucketData) {
      log("Storage bucket作成開始");
      const { error: bucketError } = await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: 1024 * 1024,
        allowedMimeTypes: ["text/html"],
      });
      if (bucketError && !/already exists/i.test(bucketError.message || "")) {
        console.error("[share-preview] Storage bucket作成失敗", bucketError);
        return json({ error: "OGP用Storage bucketの作成に失敗しました", detail: bucketError.message }, 500);
      }
      log("Storage bucket作成成功");
    } else if (!bucketData.public) {
      log("Storage bucket公開設定更新開始");
      const { error: updateBucketError } = await supabase.storage.updateBucket(BUCKET, {
        public: true,
        fileSizeLimit: 1024 * 1024,
        allowedMimeTypes: ["text/html"],
      });
      if (updateBucketError) {
        console.error("[share-preview] Storage bucket公開設定更新失敗", updateBucketError);
        return json({ error: "OGP用Storage bucketの公開設定に失敗しました", detail: updateBucketError.message }, 500);
      }
      log("Storage bucket公開設定更新成功");
    } else {
      log("Storage bucket確認成功");
    }

    const path = `${id}/${version}.html`;
    log("HTMLアップロード開始", path);
    const bytes = new TextEncoder().encode(html);
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: "text/html; charset=utf-8",
        cacheControl: "60",
        upsert: true,
      });

    if (uploadError) {
      console.error("[share-preview] HTMLアップロード失敗", uploadError);
      return json({ error: "OGPページの保存に失敗しました", detail: uploadError.message }, 500);
    }
    log("HTMLアップロード成功");

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    log("完了");
    return json({
      ok: true,
      url: publicData.publicUrl,
      target,
      image: image || null,
      version,
    });
  } catch (e) {
    console.error("[share-preview] 予期しないエラー", e);
    return json({ error: "OGPページの作成に失敗しました", detail: String(e?.message || e) }, 500);
  }
});
