(() => {
"use strict";

const cfg = window.SUPABASE_CONFIG || {};

function configured() {
  return /^https:\/\/.+\.supabase\.co$/i.test(cfg.projectUrl || "") &&
    /^sb_publishable_/i.test(cfg.publishableKey || "");
}

function headers() {
  return {
    "apikey": cfg.publishableKey,
    "Content-Type": "application/json"
  };
}

function randomId(len=14) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

async function createSharedPage(data) {
  if (!configured()) throw new Error("SupabaseのPublishable keyが未設定です。");

  for (let attempt=0; attempt<3; attempt++) {
    const id = randomId();
    const res = await fetch(cfg.projectUrl + "/rest/v1/rpc/create_shared_page", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ p_id: id, p_data: data })
    });

    if (res.ok) return id;

    // collision is extremely unlikely, but retry on a conflict-like response.
    if (res.status === 409) continue;

    const body = await res.text();
    throw new Error("共有データの保存に失敗しました。" + (body ? " " + body.slice(0,180) : ""));
  }
  throw new Error("共有IDの作成に失敗しました。");
}

async function getSharedPage(id) {
  if (!configured()) throw new Error("SupabaseのPublishable keyが未設定です。");

  const res = await fetch(cfg.projectUrl + "/rest/v1/rpc/get_shared_page", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ p_id: id })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error("共有データの読み込みに失敗しました。" + (body ? " " + body.slice(0,180) : ""));
  }

  return await res.json();
}


function sharePreviewUrl(id, version=0) {
  if (!configured()) return "";
  const u = new URL(String(cfg.projectUrl).replace(/\/$/, "") + "/functions/v1/share-preview");
  u.searchParams.set("id", id);
  if (version) u.searchParams.set("v", String(version));
  return u.href;
}

async function updateSharedPage(id,data) {
  if (!configured()) throw new Error("SupabaseのPublishable keyが未設定です。");
  const res = await fetch(cfg.projectUrl + "/rest/v1/rpc/update_shared_page", {
    method: "POST", headers: headers(), body: JSON.stringify({ p_id:id, p_data:data })
  });
  if (!res.ok) {
    const body=await res.text();
    throw new Error("固定共有URLの更新に失敗しました。" + (body ? " " + body.slice(0,180) : ""));
  }
}

window.TRPG39Cloud = { configured, createSharedPage, getSharedPage, updateSharedPage, sharePreviewUrl };
})();