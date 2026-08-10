(() => {
  const $ = id => document.getElementById(id);
  const state = { rows: [], speakers: [] };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function normalize(text) {
    return String(text || "").replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").replace(/[ \t]+$/gm, "").trim();
  }

  function getSkill(line) {
    const bracket = line.match(/[【\[]\s*([^】\]]+?)\s*[】\]]/);
    if (bracket) return bracket[1].trim();
    const plain = line.match(/\bCC(?:B)?\s*<=?\s*\d+(?:-\d+)?\s+([^（(＞>]+)/i);
    return plain ? plain[1].trim() : "";
  }

  function getTarget(line) {
    const m = line.match(/(?:CCB?|1D100)\s*<=?\s*(\d{1,3})(?:-\d+)?/i);
    return m ? Number(m[1]) : null;
  }

  function getRolls(line) {
    const rolls = [];
    const chunks = [...line.matchAll(/[＞>]\s*(\d{1,3}(?:\s*,\s*\d{1,3})*)\s*(?=[＞>])/g)];
    for (const c of chunks) for (const n of c[1].split(/\s*,\s*/)) rolls.push(Number(n));
    if (!rolls.length) {
      const m = line.match(/\b1D100[^\n]*?[＞>]\s*(\d{1,3})/i);
      if (m) rolls.push(Number(m[1]));
    }
    return rolls.filter(n => Number.isFinite(n) && n >= 1 && n <= 100);
  }

  function flags(line, target, rolls) {
    let critical = /決定的成功|クリティカル/i.test(line);
    let fumble = /致命的失敗|ファンブル/i.test(line);
    let special = /スペシャル/i.test(line);
    for (const r of rolls) {
      if (r <= 5) critical = true;
      if (r >= 96) fumble = true;
      if (target && r <= Math.floor(target / 5)) special = true;
    }
    return { critical, fumble, special };
  }

  function rowFrom(speaker, line) {
    if (!/\b(?:CCB?|1D100)\s*<?=/i.test(line)) return null;
    const skill = getSkill(line);
    if (!skill) return null;
    const target = getTarget(line);
    const rolls = getRolls(line);
    const f = flags(line, target, rolls);
    return { speaker: speaker || "発言者不明", skill, target, rolls, ...f, raw: line };
  }

  // ココフォリアHTMLは <p><span>[main]</span><span>発言者</span>:<span>判定</span></p>
  // という構造なので、テキスト化する前にHTMLから発言者を直接拾う。
  function parseCocofoliaHtml(raw) {
    const doc = new DOMParser().parseFromString(raw, "text/html");
    const rows = [];

    for (const p of doc.querySelectorAll("p")) {
      const spans = [...p.querySelectorAll(":scope > span")];
      if (spans.length < 2) continue;

      const speaker = normalize(spans[1].textContent);
      const line = normalize(p.textContent);

      const row = rowFrom(speaker, line);
      if (row) rows.push(row);
    }
    return rows;
  }

  function isSpeakerLine(line) {
    const m = line.match(/^(.+?)\s+-\s+(?:(?:今日|昨日|\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2})\s+)?\d{1,2}:\d{2}(?::\d{2})?\s*$/);
    return m ? m[1].trim() : null;
  }

  function parsePlainText(text) {
    const lines = normalize(text).split("\n").map(x => x.trim()).filter(Boolean);
    const rows = [];
    let speaker = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const sp = isSpeakerLine(line);
      if (sp) {
        speaker = sp;
        continue;
      }

      // ココフォリアのHTMLをコピーした際など、発言者が判定の直前行に分離される形式も拾う。
      if (!/\b(?:CCB?|1D100)\s*<?=/i.test(line)) {
        if (i + 1 < lines.length &&
            /\b(?:CCB?|1D100)\s*<?=/i.test(lines[i + 1]) &&
            !/^(?:KP|system|システム|\[.*\]|:|：)$/i.test(line) &&
            line.length < 100) {
          speaker = line.replace(/\s+-.*$/, "").trim();
        }
        continue;
      }

      const row = rowFrom(speaker, line);
      if (row) rows.push(row);
    }
    return rows;
  }

  function parseSource(raw, isHtml) {
    if (isHtml || /<html|<p[\s>]/i.test(raw)) {
      const rows = parseCocofoliaHtml(raw);
      if (rows.length) return rows;

      const doc = new DOMParser().parseFromString(raw, "text/html");
      return parsePlainText(doc.body?.textContent || raw);
    }
    return parsePlainText(raw);
  }

  function renderCharacters() {
    state.speakers = [...new Set(state.rows.map(r => r.speaker))];
    $("characterList").innerHTML = state.speakers.map(name => {
      const count = state.rows.filter(r => r.speaker === name).length;
      return `<label class="check-card"><input type="checkbox" class="speakerCheck" value="${esc(name)}"> <span>${esc(name)}</span><small>${count}件</small></label>`;
    }).join("");
    document.querySelectorAll(".speakerCheck").forEach(el => el.addEventListener("change", renderResult));
  }

  function selectedSpeakers() {
    return [...document.querySelectorAll(".speakerCheck:checked")].map(x => x.value);
  }

  function isSpecial(row) {
    return row.special || row.critical || row.fumble;
  }

  function specialRolls(row) {
    const parts = [];
    if (row.critical) {
      const r = row.rolls.filter(n => n <= 5);
      parts.push(`クリティカル${r.length ? `：${r.join(",")}` : ""}`);
    }
    if (row.fumble) {
      const r = row.rolls.filter(n => n >= 96);
      parts.push(`ファンブル${r.length ? `：${r.join(",")}` : ""}`);
    }
    return parts;
  }

  function formatRow(row) {
    const specials = specialRolls(row);
    return `${row.speaker}：${row.skill}${specials.length ? `（${specials.join("／")}）` : ""}`;
  }

  function renderResult() {
    let rows = state.rows.filter(r => selectedSpeakers().includes(r.speaker));
    const kw = $("keyword").value.trim().toLowerCase();
    if (kw) rows = rows.filter(r => r.skill.toLowerCase().includes(kw));
    if ($("specialOnly").checked) rows = rows.filter(isSpecial);

    if ($("uniqueSkills").checked) {
      const map = new Map();
      for (const r of rows) {
        const key = `${r.speaker}\u0000${r.skill}`;
        if (!map.has(key)) {
          map.set(key, {...r, rolls:[...r.rolls]});
        } else {
          const x = map.get(key);
          x.rolls.push(...r.rolls);
          x.critical ||= r.critical;
          x.fumble ||= r.fumble;
          x.special ||= r.special;
        }
      }
      rows = [...map.values()];
    }

    $("result").textContent = rows.length ? rows.map(formatRow).join("\n") : "条件に一致する技能はありません。";
    $("summary").textContent = `${rows.length}件`;
  }

  async function getSource() {
    const file = $("logFile").files && $("logFile").files[0];
    if (file) {
      return {
        raw: await file.text(),
        isHtml: /\.html?$/i.test(file.name) || /html/i.test(file.type)
      };
    }
    return { raw: $("logText").value, isHtml: false };
  }

  $("analyze").addEventListener("click", async () => {
    try {
      const src = await getSource();
      if (!src.raw.trim()) return alert("ログファイルを選ぶか、ログを貼り付けてください。");

      state.rows = parseSource(src.raw, src.isHtml);

      if (!state.rows.length) {
        $("loadStatus").textContent = "技能判定を見つけられませんでした。ログ形式を確認してください。";
        $("characterPanel").hidden = true;
        $("optionPanel").hidden = true;
        $("resultPanel").hidden = true;
        return;
      }

      renderCharacters();
      $("characterPanel").hidden = false;
      $("optionPanel").hidden = false;
      $("resultPanel").hidden = false;
      $("loadStatus").textContent = `技能判定 ${state.rows.length}件、発言者 ${state.speakers.length}人を検出しました。`;
      renderResult();
      $("characterPanel").scrollIntoView({behavior:"smooth", block:"start"});
    } catch (e) {
      console.error(e);
      alert("ログの読み込みに失敗しました。");
    }
  });

  $("clear").addEventListener("click", () => {
    $("logFile").value = "";
    $("logText").value = "";
    $("loadStatus").textContent = "";
    state.rows = [];
    state.speakers = [];
    $("characterPanel").hidden = true;
    $("optionPanel").hidden = true;
    $("resultPanel").hidden = true;
  });

  $("selectAll").addEventListener("click", () => {
    document.querySelectorAll(".speakerCheck").forEach(x => x.checked = true);
    renderResult();
  });

  $("selectNone").addEventListener("click", () => {
    document.querySelectorAll(".speakerCheck").forEach(x => x.checked = false);
    renderResult();
  });

  ["specialOnly","uniqueSkills"].forEach(id => $(id).addEventListener("change", renderResult));
  $("keyword").addEventListener("input", renderResult);

  $("copyResult").addEventListener("click", async () => {
    const text = $("result").textContent;
    if (!text || text.startsWith("条件に一致")) return;
    try {
      await navigator.clipboard.writeText(text);
      const old = $("copyResult").textContent;
      $("copyResult").textContent = "コピーしました";
      setTimeout(() => $("copyResult").textContent = old, 1400);
    } catch {
      const range = document.createRange();
      range.selectNodeContents($("result"));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      alert("結果を選択しました。コピーしてください。");
    }
  });
})();