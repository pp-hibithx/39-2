(() => {
  const $ = id => document.getElementById(id);
  const state = { rows: [], speakers: [] };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  function normalize(text) {
    return String(text || "")
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+$/gm, "")
      .trim();
  }

  function hasDiceCheck(line) {
    return /(?:^|\s)(?:CCB?|1D100)\s*<=/i.test(line);
  }

  function getSkill(line) {
    const m = line.match(/[【\[]\s*([^】\]]+?)\s*[】\]]/);
    return m ? m[1].trim() : "";
  }

  function getTarget(line) {
    // 実際に振られた 1D100<=XX を優先
    let m = line.match(/\(1D100\s*<=\s*(\d{1,3})\)/i);
    if (m) return Number(m[1]);

    m = line.match(/(?:CCB?|1D100)\s*<=\s*(\d{1,3})/i);
    return m ? Number(m[1]) : null;
  }

  function getRolls(line) {
    const rolls = [];
    const re = /[＞>]\s*(\d{1,3})(?=\s*[＞>])/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 100) rolls.push(n);
    }
    return rolls;
  }

  function getFlags(line, target, rolls) {
    let critical = /決定的成功|クリティカル/i.test(line);
    let fumble = /致命的失敗|ファンブル/i.test(line);
    let special = /スペシャル/i.test(line);

    for (const r of rolls) {
      if (r <= 5) critical = true;
      if (r >= 96) fumble = true;
      if (target != null && r <= Math.floor(target / 5)) special = true;
    }
    return {critical, fumble, special};
  }

  function makeRow(speaker, line) {
    if (!hasDiceCheck(line)) return null;

    const skill = getSkill(line);
    if (!skill) return null;

    const target = getTarget(line);
    const rolls = getRolls(line);
    const f = getFlags(line, target, rolls);

    return {
      speaker: speaker || "発言者不明",
      skill: skill,
      target: target,
      rolls: rolls,
      critical: f.critical,
      fumble: f.fumble,
      special: f.special,
      raw: line
    };
  }

  function parseCocofoliaHtml(raw) {
    const doc = new DOMParser().parseFromString(raw, "text/html");
    const rows = [];
    const ps = doc.getElementsByTagName("p");

    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const spans = p.getElementsByTagName("span");
      if (spans.length < 3) continue;

      // ココフォリアHTML:
      // span[0] = [main]
      // span[1] = 発言者
      // span[2] = 発言内容
      const speaker = normalize(spans[1].textContent);
      const message = normalize(spans[2].textContent);

      const row = makeRow(speaker, message);
      if (row) rows.push(row);
    }

    return rows;
  }

  function parsePlainText(text) {
    const lines = normalize(text).split("\n").map(function(x){ return x.trim(); }).filter(Boolean);
    const rows = [];
    let speaker = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 「名前 - 昨日 23:17」形式
      const sm = line.match(/^(.+?)\s+-\s+(?:(?:今日|昨日|\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2})\s+)?\d{1,2}:\d{2}(?::\d{2})?\s*$/);
      if (sm) {
        speaker = sm[1].trim();
        continue;
      }

      const row = makeRow(speaker, line);
      if (row) rows.push(row);
    }

    return rows;
  }

  function parseSource(raw, isHtml) {
    if (isHtml || /<p[\s>]/i.test(raw)) {
      const htmlRows = parseCocofoliaHtml(raw);
      if (htmlRows.length) return htmlRows;

      const doc = new DOMParser().parseFromString(raw, "text/html");
      return parsePlainText(doc.body ? doc.body.textContent : raw);
    }

    return parsePlainText(raw);
  }

  function renderCharacters() {
    const set = new Set();
    state.rows.forEach(function(r){ set.add(r.speaker); });
    state.speakers = Array.from(set);

    $("characterList").innerHTML = state.speakers.map(function(name) {
      const count = state.rows.filter(function(r){ return r.speaker === name; }).length;
      return '<label class="check-card">' +
        '<input type="checkbox" class="speakerCheck" value="' + esc(name) + '">' +
        ' <span>' + esc(name) + '</span><small>' + count + '件</small></label>';
    }).join("");

    document.querySelectorAll(".speakerCheck").forEach(function(el) {
      el.addEventListener("change", renderResult);
    });
  }

  function selectedSpeakers() {
    return Array.from(document.querySelectorAll(".speakerCheck:checked")).map(function(x){ return x.value; });
  }

  function isSpecial(row) {
    return row.special || row.critical || row.fumble;
  }

  function specialText(row) {
    const parts = [];

    if (row.critical) {
      const r = row.rolls.filter(function(n){ return n <= 5; });
      parts.push("クリティカル" + (r.length ? "：" + r.join(",") : ""));
    }

    if (row.fumble) {
      const r = row.rolls.filter(function(n){ return n >= 96; });
      parts.push("ファンブル" + (r.length ? "：" + r.join(",") : ""));
    }

    return parts;
  }

  function formatRow(row) {
    const specials = specialText(row);
    return row.speaker + "：" + row.skill + (specials.length ? "（" + specials.join("／") + "）" : "");
  }

  function renderResult() {
    let rows = state.rows.filter(function(r) {
      return selectedSpeakers().indexOf(r.speaker) !== -1;
    });

    const kw = $("keyword").value.trim().toLowerCase();
    if (kw) {
      rows = rows.filter(function(r){ return r.skill.toLowerCase().indexOf(kw) !== -1; });
    }

    if ($("specialOnly").checked) {
      rows = rows.filter(isSpecial);
    }

    if ($("uniqueSkills").checked) {
      const map = new Map();

      rows.forEach(function(r) {
        const key = r.speaker + "\u0000" + r.skill;

        if (!map.has(key)) {
          map.set(key, {
            speaker: r.speaker,
            skill: r.skill,
            target: r.target,
            rolls: r.rolls.slice(),
            critical: r.critical,
            fumble: r.fumble,
            special: r.special
          });
        } else {
          const x = map.get(key);
          x.rolls = x.rolls.concat(r.rolls);
          x.critical = x.critical || r.critical;
          x.fumble = x.fumble || r.fumble;
          x.special = x.special || r.special;
        }
      });

      rows = Array.from(map.values());
    }

    $("result").textContent = rows.length
      ? rows.map(formatRow).join("\n")
      : "条件に一致する技能はありません。";

    $("summary").textContent = rows.length + "件";
  }

  function readFile(file) {
    return new Promise(function(resolve, reject) {
      const reader = new FileReader();
      reader.onload = function() { resolve(String(reader.result || "")); };
      reader.onerror = function() { reject(reader.error || new Error("ファイルを読み込めませんでした")); };
      reader.readAsText(file);
    });
  }

  async function getSource() {
    const file = $("logFile").files && $("logFile").files[0];

    if (file) {
      return {
        raw: await readFile(file),
        isHtml: /\.html?$/i.test(file.name) || /html/i.test(file.type)
      };
    }

    return {
      raw: $("logText").value,
      isHtml: false
    };
  }

  $("analyze").addEventListener("click", async function() {
    try {
      const src = await getSource();

      if (!src.raw.trim()) {
        alert("ログファイルを選ぶか、ログを貼り付けてください。");
        return;
      }

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

      $("loadStatus").textContent =
        "技能判定 " + state.rows.length + "件、発言者 " + state.speakers.length + "人を検出しました。";

      renderResult();
    } catch (e) {
      console.error("dice-log error", e);
      const msg = e && e.message ? e.message : String(e);
      $("loadStatus").textContent = "エラー：" + msg;
      alert("ログの読み込みに失敗しました。\n" + msg);
    }
  });

  $("clear").addEventListener("click", function() {
    $("logFile").value = "";
    $("logText").value = "";
    $("loadStatus").textContent = "";
    state.rows = [];
    state.speakers = [];
    $("characterPanel").hidden = true;
    $("optionPanel").hidden = true;
    $("resultPanel").hidden = true;
  });

  $("selectAll").addEventListener("click", function() {
    document.querySelectorAll(".speakerCheck").forEach(function(x){ x.checked = true; });
    renderResult();
  });

  $("selectNone").addEventListener("click", function() {
    document.querySelectorAll(".speakerCheck").forEach(function(x){ x.checked = false; });
    renderResult();
  });

  $("specialOnly").addEventListener("change", renderResult);
  $("uniqueSkills").addEventListener("change", renderResult);
  $("keyword").addEventListener("input", renderResult);

  $("copyResult").addEventListener("click", async function() {
    const text = $("result").textContent;
    if (!text || text.indexOf("条件に一致") === 0) return;

    try {
      await navigator.clipboard.writeText(text);
      const old = $("copyResult").textContent;
      $("copyResult").textContent = "コピーしました";
      setTimeout(function(){ $("copyResult").textContent = old; }, 1400);
    } catch (e) {
      const range = document.createRange();
      range.selectNodeContents($("result"));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      alert("結果を選択しました。コピーしてください。");
    }
  });
})();