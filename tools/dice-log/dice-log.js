(() => {
  const $ = id => document.getElementById(id);
  const state = { rows: [], speakers: [], sourceText: "" };

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function htmlToText(html) {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      return doc.body ? doc.body.innerText : html;
    } catch {
      return html;
    }
  }

  function normalize(text) {
    return String(text || "")
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+$/gm, "")
      .trim();
  }

  function isSpeakerLine(line) {
    // ココフォリアの貼り付けログ: 「名前 - 昨日 23:19」「名前 - 2026/08/10 23:19」など
    const m = line.match(/^(.+?)\s+-\s+(?:(?:今日|昨日|\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2})\s+)?\d{1,2}:\d{2}(?::\d{2})?\s*$/);
    if (m) return m[1].trim();
    return null;
  }

  function getSkill(line) {
    const bracket = line.match(/[【\[]\s*([^】\]]+?)\s*[】\]]/);
    if (bracket) return bracket[1].trim();
    // 括弧がない場合、CCB<=50 目星 のような形式を最低限拾う
    const plain = line.match(/\bCC(?:B)?\s*<=?\s*\d+\s+([^（(＞>]+)/i);
    return plain ? plain[1].trim() : "";
  }

  function getTarget(line) {
    const m = line.match(/(?:CCB?|1D100)\s*<=?\s*(\d{1,3})/i) || line.match(/1D100\s*<=\s*(\d{1,3})/i);
    return m ? Number(m[1]) : null;
  }

  function getRolls(line) {
    const rolls = [];
    // 「＞ 14,4 ＞」や「＞ 71 ＞」を優先
    const chunks = [...line.matchAll(/[＞>]\s*(\d{1,3}(?:\s*,\s*\d{1,3})*)\s*(?=[＞>])/g)];
    if (chunks.length) {
      for (const c of chunks) for (const n of c[1].split(/\s*,\s*/)) rolls.push(Number(n));
    }
    if (!rolls.length) {
      const m = line.match(/\b1D100[^\n]*?[＞>]\s*(\d{1,3})/i);
      if (m) rolls.push(Number(m[1]));
    }
    return rolls.filter(n => Number.isFinite(n) && n >= 1 && n <= 100);
  }

  function resultLabels(line, target, rolls) {
    const labels = [];
    const add = x => { if (!labels.includes(x)) labels.push(x); };
    if (/決定的成功|クリティカル/i.test(line)) add("決定的成功");
    if (/致命的失敗|ファンブル/i.test(line)) add("致命的失敗");
    if (/スペシャル/i.test(line)) add("スペシャル");
    if (/失敗/i.test(line) && !/致命的失敗|ファンブル/i.test(line)) add("失敗");
    if (/成功/i.test(line) && !/決定的成功|クリティカル/i.test(line) && !/スペシャル/i.test(line)) add("成功");

    // テキストに判定名がないケースを補助（CoC6系の一般的な基準）
    for (const r of rolls) {
      if (r <= 5) add("決定的成功");
      if (r >= 96) add("致命的失敗");
      if (target && r <= Math.floor(target / 5) && r > 5) add("スペシャル");
    }
    if (!labels.length && target && rolls.length) add(rolls.every(r => r <= target) ? "成功" : "失敗");
    return labels;
  }

  function parse(text) {
    const lines = normalize(text).split("\n").map(x => x.trim()).filter(Boolean);
    const rows = [];
    let speaker = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const sp = isSpeakerLine(line);
      if (sp) { speaker = sp; continue; }
      if (!/\b(?:CCB?|1D100)\s*<?=/i.test(line)) continue;
      const skill = getSkill(line);
      if (!skill) continue; // 技能名なしのダメージ判定等は除外
      const target = getTarget(line);
      const rolls = getRolls(line);
      const labels = resultLabels(line, target, rolls);
      rows.push({ speaker: speaker || "発言者不明", skill, target, rolls, labels, raw: line });
    }
    return rows;
  }

  function renderCharacters() {
    const speakers = [...new Set(state.rows.map(r => r.speaker))];
    state.speakers = speakers;
    $("characterList").innerHTML = speakers.map((name, i) => {
      const count = state.rows.filter(r => r.speaker === name).length;
      return `<label class="check-card"><input type="checkbox" class="speakerCheck" value="${esc(name)}" checked> <span>${esc(name)}</span><small>${count}件</small></label>`;
    }).join("");
    document.querySelectorAll(".speakerCheck").forEach(el => el.addEventListener("change", renderResult));
  }

  function selectedSpeakers() {
    return [...document.querySelectorAll(".speakerCheck:checked")].map(x => x.value);
  }

  function isGrowth(row) {
    return row.labels.includes("決定的成功") || row.labels.includes("致命的失敗");
  }

  function formatRow(row) {
    const target = row.target != null ? row.target : "?";
    const roll = row.rolls.length ? row.rolls.join(",") : "?";
    const labels = row.labels.length ? row.labels.join("・") : "判定";
    const special = isGrowth(row) ? `｜${roll}｜${labels}｜成長候補` : `｜${roll}｜${labels}`;
    return `${row.speaker} :｜${row.skill}｜${target}${special}`;
  }

  function renderResult() {
    let rows = state.rows.filter(r => selectedSpeakers().includes(r.speaker));
    const kw = $("keyword").value.trim().toLowerCase();
    if (kw) rows = rows.filter(r => r.skill.toLowerCase().includes(kw));
    if ($("growthOnly").checked) rows = rows.filter(isGrowth);
    else {
      if (!$("includeFailure").checked) rows = rows.filter(r => !r.labels.includes("失敗"));
      if (!$("includeSuccess").checked) rows = rows.filter(r => isGrowth(r));
    }

    if ($("uniqueSkills").checked) {
      const map = new Map();
      for (const r of rows) {
        const key = `${r.speaker}\u0000${r.skill}`;
        if (!map.has(key)) map.set(key, {...r, rolls:[...r.rolls], labels:[...r.labels]});
        else {
          const x = map.get(key);
          x.rolls.push(...r.rolls);
          for (const l of r.labels) if (!x.labels.includes(l)) x.labels.push(l);
        }
      }
      rows = [...map.values()];
    }

    const text = rows.map(formatRow).join("\n");
    $("result").textContent = text || "条件に一致する技能判定はありません。";
    const growth = rows.filter(isGrowth).length;
    const critical = rows.filter(r => r.labels.includes("決定的成功")).length;
    const fumble = rows.filter(r => r.labels.includes("致命的失敗")).length;
    $("summary").textContent = `${rows.length}件 ／ 成長候補 ${growth}件`;
    $("specialSummary").innerHTML = `<span>決定的成功 <b>${critical}</b></span><span>致命的失敗 <b>${fumble}</b></span>`;
  }

  async function getSourceText() {
    const file = $("logFile").files && $("logFile").files[0];
    if (file) {
      const raw = await file.text();
      return /\.html?$/i.test(file.name) || /html/i.test(file.type) ? htmlToText(raw) : raw;
    }
    return $("logText").value;
  }

  $("analyze").addEventListener("click", async () => {
    try {
      const text = await getSourceText();
      if (!text.trim()) return alert("ログファイルを選ぶか、ログを貼り付けてください。");
      state.sourceText = text;
      state.rows = parse(text);
      if (!state.rows.length) {
        $("loadStatus").textContent = "技能判定を見つけられませんでした。ログ形式を確認してください。";
        $("characterPanel").hidden = true; $("optionPanel").hidden = true; $("resultPanel").hidden = true;
        return;
      }
      renderCharacters();
      $("characterPanel").hidden = false; $("optionPanel").hidden = false; $("resultPanel").hidden = false;
      $("loadStatus").textContent = `技能判定 ${state.rows.length}件、発言者 ${state.speakers.length}人を検出しました。`;
      renderResult();
      $("characterPanel").scrollIntoView({behavior:"smooth", block:"start"});
    } catch (e) {
      console.error(e);
      alert("ログの読み込みに失敗しました。");
    }
  });

  $("clear").addEventListener("click", () => {
    $("logFile").value = ""; $("logText").value = ""; $("loadStatus").textContent = "";
    state.rows = []; state.speakers = []; state.sourceText = "";
    $("characterPanel").hidden = true; $("optionPanel").hidden = true; $("resultPanel").hidden = true;
  });
  $("selectAll").addEventListener("click", () => { document.querySelectorAll(".speakerCheck").forEach(x => x.checked = true); renderResult(); });
  $("selectNone").addEventListener("click", () => { document.querySelectorAll(".speakerCheck").forEach(x => x.checked = false); renderResult(); });
  ["includeSuccess","includeFailure","growthOnly","uniqueSkills","keyword"].forEach(id => $(id).addEventListener(id === "keyword" ? "input" : "change", renderResult));

  $("copyResult").addEventListener("click", async () => {
    const text = $("result").textContent;
    if (!text || text.startsWith("条件に一致")) return;
    try {
      await navigator.clipboard.writeText(text);
      const old = $("copyResult").textContent; $("copyResult").textContent = "コピーしました";
      setTimeout(() => $("copyResult").textContent = old, 1400);
    } catch {
      const range = document.createRange(); range.selectNodeContents($("result"));
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      alert("結果を選択しました。コピーしてください。");
    }
  });
})();
