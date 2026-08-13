import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_BASE_URL = (Deno.env.get("SITE_BASE_URL") || "https://pp-hibithx.github.io/39-2").replace(/\/$/, "");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BUCKET = "share-previews";

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

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: "Supabase環境変数を取得できません" }, 500);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    const version = String(body?.version || Date.now()).replace(/[^0-9A-Za-z_-]/g, "");

    if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) {
      return json({ error: "共有IDが正しくありません" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: p, error: readError } = await supabase.rpc("get_shared_page", { p_id: id });
    if (readError || !p) {
      return json({ error: "共有データが見つかりません" }, 404);
    }

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

    // Ensure the bucket exists and is public.
    const { data: bucketData } = await supabase.storage.getBucket(BUCKET);
    if (!bucketData) {
      const { error: bucketError } = await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: 1024 * 1024,
        allowedMimeTypes: ["text/html"],
      });
      if (bucketError && !/already exists/i.test(bucketError.message || "")) {
        return json({ error: "OGP用Storage bucketの作成に失敗しました" }, 500);
      }
    } else if (!bucketData.public) {
      await supabase.storage.updateBucket(BUCKET, {
        public: true,
        fileSizeLimit: 1024 * 1024,
        allowedMimeTypes: ["text/html"],
      });
    }

    const path = `${id}/${version}.html`;
    const bytes = new TextEncoder().encode(html);
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: "text/html; charset=utf-8",
        cacheControl: "60",
        upsert: true,
      });

    if (uploadError) {
      return json({ error: "OGPページの保存に失敗しました: " + uploadError.message }, 500);
    }

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return json({
      ok: true,
      url: publicData.publicUrl,
      target,
      image: image || null,
      version,
    });
  } catch (e) {
    console.error(e);
    return json({ error: "OGPページの作成に失敗しました" }, 500);
  }
});
