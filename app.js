/* 能量实验室 —— 页面逻辑(第0版·纯静态)
 * 闭环:快速记录 → 能量地图 → 七天实验 → 对比 → 恢复工具箱
 * 所有数据存 localStorage;AI 分析走"生成提示词+用户自带 AI"模式
 * 本工具是自我观察和生活管理工具,不是心理诊断或医疗建议
 */

const K = {
  checkins: "el.checkins",     // [{id,date,time,slot,energy,moods[],sleepH,sleepQ,drain,restore,extra{}}]
  events: "el.events",         // [{id,date,time,kind,what,delta,mood,scene}]
  experiments: "el.experiments", // [{id,variable,hypothesis,action,when,metric,stopCond,startDate,endDate,status,result}]
  toolbox: "el.toolbox",       // [{id,name,scene,uses,rating,note}]
  reports: "el.reports",       // [{savedAt,text}]
  migrated: "el.migrated",
};

const MOODS = ["平静", "开心", "充实", "焦虑", "烦躁", "低落", "疲惫", "麻木", "兴奋"];
const SLOTS = [
  { id: "morning", name: "早晨", sub: "起床能量" },
  { id: "afternoon", name: "下午", sub: "工作中能量" },
  { id: "evening", name: "晚上", sub: "整体回顾" },
];
const CYCLE = ["不记录", "月经期", "卵泡期", "排卵期", "黄体期", "说不清"];
const TOOL_SCENES = ["10分钟快速恢复", "下班后恢复", "社交后恢复", "低能量工作方案", "睡前降速方案", "高压力日应急", "其他"];
const EXP_SUGGESTS = ["提前30分钟睡觉", "下班后先散步15分钟", "上午关闭消息通知", "减少睡前短视频", "高认知任务放到上午", "增加独处恢复时间"];

const $main = document.getElementById("main");
const tabs = {
  record: document.getElementById("nav-record"),
  map: document.getElementById("nav-map"),
  exp: document.getElementById("nav-exp"),
  audit: document.getElementById("nav-audit"),
  toolbox: document.getElementById("nav-toolbox"),
};

/* ---------- 基础工具 ---------- */
const load = (key, fb) => { try { return JSON.parse(localStorage.getItem(key)) || fb; } catch { return fb; } };
const save = (key, v) => localStorage.setItem(key, JSON.stringify(v));
const uid = () => Date.now() + "-" + Math.random().toString(36).slice(2, 7);
function dstr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const todayStr = () => dstr(new Date());
const nowTime = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
function addDays(dateStr, n) { const d = new Date(dateStr + "T12:00:00"); d.setDate(d.getDate() + n); return dstr(d); }
function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html !== undefined) n.innerHTML = html; return n; }
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function setNav(name) { Object.entries(tabs).forEach(([k, b]) => b.classList.toggle("active", k === name)); }
function toast(msg) {
  const t = el("div", "saved-toast", msg);
  $main.prepend(t);
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => t.remove(), 2500);
}

/* ---------- 旧版数据迁移(ea.entries → 晚上 checkin) ---------- */
(function migrate() {
  if (localStorage.getItem(K.migrated)) return;
  const old = load("ea.entries", null);
  if (old) {
    const checkins = load(K.checkins, []);
    Object.entries(old).forEach(([date, e]) => {
      checkins.push({
        id: uid(), date, time: "21:00", slot: "evening",
        energy: e.energy, moods: (e.moods || []).slice(0, 2),
        sleepH: e.sleepH || "", sleepQ: e.sleepQ || 0,
        drain: e.drain || "", restore: e.restore || "",
        extra: { body: e.body || "", note: [e.did, e.avoid && `逃避了:${e.avoid}`, e.best && `最满意:${e.best}`].filter(Boolean).join(";") },
      });
    });
    save(K.checkins, checkins);
    const oldReports = load("ea.reports", []);
    if (oldReports.length) save(K.reports, [...load(K.reports, []), ...oldReports]);
  }
  localStorage.setItem(K.migrated, "1");
})();

/* ---------- 数据统计工具 ---------- */
function dayAvgMap() {
  const m = {};
  load(K.checkins, []).forEach(c => {
    if (!m[c.date]) m[c.date] = [];
    m[c.date].push(Number(c.energy));
  });
  const out = {};
  Object.entries(m).forEach(([d, arr]) => { out[d] = arr.reduce((a, b) => a + b, 0) / arr.length; });
  return out;
}
const recordedDays = () => Object.keys(dayAvgMap()).sort();
function sleepOf(date) {
  const c = load(K.checkins, []).find(c => c.date === date && c.sleepH !== "" && c.sleepH != null);
  return c ? Number(c.sleepH) : null;
}
const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
const r1 = x => Math.round(x * 10) / 10;

/* ================= 记录 ================= */
function showRecord() {
  setNav("record");
  $main.innerHTML = "";

  // 成长条
  const days = recordedDays().length;
  const doneExps = load(K.experiments, []).filter(e => e.status === "done").length;
  const tools = load(K.toolbox, []).length;
  $main.appendChild(el("div", "stats-strip",
    `<span>已记录 <b>${days}</b> 天</span><span>完成 <b>${doneExps}</b> 个实验</span><span>沉淀 <b>${tools}</b> 个恢复方法</span>`));

  // 事件快捷入口
  const evBtn = el("button", "event-cta", "⚡ 刚刚发生了一次明显消耗 / 恢复 → 顺手记下来");
  $main.appendChild(evBtn);
  const evCard = el("div", "card");
  evCard.style.display = "none";
  evCard.innerHTML = `
    <h3>记一笔能量事件</h3>
    <div class="field"><span class="q">这是一次…</span>
      <div class="chips" id="ev-kind">
        <button type="button" class="chip on">明显消耗</button>
        <button type="button" class="chip">明显恢复</button>
      </div></div>
    <label class="field"><span class="q">发生了什么</span>
      <input type="text" id="ev-what" placeholder="例:临时被拉进一个会 / 出门晒了十分钟太阳"></label>
    <label class="field"><span class="q">能量变化了几分</span>
      <select id="ev-delta">
        <option value="-1">-1</option><option value="-2" selected>-2</option><option value="-3">-3</option>
        <option value="-4">-4</option><option value="-5">-5</option>
      </select></label>
    <label class="field"><span class="q">当时的情绪(选填)</span>
      <input type="text" id="ev-mood" placeholder="烦躁 / 放松 …"></label>
    <label class="field"><span class="q">当时的场景(选填)</span>
      <input type="text" id="ev-scene" placeholder="办公室 / 家里 / 通勤路上 …"></label>
    <div class="toolbar"><button class="btn btn-primary btn-sm" id="ev-save">保存事件</button></div>`;
  $main.appendChild(evCard);
  evBtn.addEventListener("click", () => {
    evCard.style.display = evCard.style.display === "none" ? "block" : "none";
  });
  const kindChips = evCard.querySelectorAll("#ev-kind .chip");
  const deltaSel = evCard.querySelector("#ev-delta");
  function setKind(isDrain) {
    kindChips[0].classList.toggle("on", isDrain);
    kindChips[1].classList.toggle("on", !isDrain);
    deltaSel.innerHTML = (isDrain ? [-1, -2, -3, -4, -5] : [1, 2, 3, 4, 5])
      .map(v => `<option value="${v}" ${Math.abs(v) === 2 ? "selected" : ""}>${v > 0 ? "+" : ""}${v}</option>`).join("");
  }
  kindChips[0].addEventListener("click", () => setKind(true));
  kindChips[1].addEventListener("click", () => setKind(false));
  evCard.querySelector("#ev-save").addEventListener("click", () => {
    const what = evCard.querySelector("#ev-what").value.trim();
    if (!what) return alert("先写一句发生了什么");
    const events = load(K.events, []);
    events.push({
      id: uid(), date: todayStr(), time: nowTime(),
      kind: kindChips[0].classList.contains("on") ? "消耗" : "恢复",
      what, delta: Number(deltaSel.value),
      mood: evCard.querySelector("#ev-mood").value.trim(),
      scene: evCard.querySelector("#ev-scene").value.trim(),
    });
    save(K.events, events);
    evCard.style.display = "none";
    showRecord();
    toast("✓ 事件已记录");
  });

  // ---- 快速记录表单 ----
  const hour = new Date().getHours();
  let slot = hour < 11 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const card = el("div", "card");
  const existing = () => load(K.checkins, []).find(c => c.date === todayStr() && c.slot === slot);

  function renderForm() {
    const old = existing() || {};
    card.innerHTML = `
      <div class="slot-btns">
        ${SLOTS.map(s => `<button type="button" class="slot-btn ${s.id === slot ? "on" : ""}" data-slot="${s.id}">${s.name}<small>${s.sub}</small></button>`).join("")}
      </div>
      <label class="field"><span class="q">⚡ 当前能量 <span class="tip">(1 = 耗尽,10 = 满格)</span></span>
        <div class="energy-row">
          <input type="range" id="f-energy" min="1" max="10" value="${old.energy ?? 5}">
          <span class="energy-val" id="f-energy-val">${old.energy ?? 5}</span>
        </div></label>
      <div class="field"><span class="q">🌤 情绪 <span class="tip">(最多选 2 项)</span></span>
        <div class="chips" id="f-moods"></div></div>
      ${slot === "morning" ? `
      <label class="field"><span class="q">😴 昨晚睡眠</span>
        <div style="display:flex;gap:12px;align-items:center">
          <input type="number" id="f-sleep" min="0" max="16" step="0.5" placeholder="小时" value="${old.sleepH ?? ""}" style="width:6em">
          <span class="tip">小时,质量:</span><div class="stars" id="f-sleepq"></div>
        </div></label>` : ""}
      <label class="field"><span class="q">🔻 到现在为止,最消耗你的事</span>
        <input type="text" id="f-drain" placeholder="没有就空着" value="${esc(old.drain)}"></label>
      <label class="field"><span class="q">🔋 最恢复你的事</span>
        <input type="text" id="f-restore" placeholder="没有就空着" value="${esc(old.restore)}"></label>
      <button type="button" class="accordion-toggle" id="f-more">+ 展开更多(选填)</button>
      <div class="accordion" id="f-acc">
        <label class="field"><span class="q">身体感受</span><input type="text" id="x-body" value="${esc(old.extra?.body)}"></label>
        <label class="field"><span class="q">当前场景</span><input type="text" id="x-scene" placeholder="家里 / 学校 / 咖啡馆 …" value="${esc(old.extra?.scene)}"></label>
        <label class="field"><span class="q">和谁在一起</span><input type="text" id="x-who" value="${esc(old.extra?.who)}"></label>
        <label class="field"><span class="q">正在做什么任务</span><input type="text" id="x-task" value="${esc(old.extra?.task)}"></label>
        <label class="field"><span class="q">经期阶段</span>
          <select id="x-cycle">${CYCLE.map(c => `<option ${old.extra?.cycle === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
        <label class="field"><span class="q">自由记录</span><textarea id="x-note">${esc(old.extra?.note)}</textarea></label>
      </div>
      <div class="toolbar">
        <button class="btn btn-primary" id="f-save">${existing() ? "更新这条记录" : "保存(30 秒搞定)"}</button>
      </div>`;

    // 时段切换
    card.querySelectorAll(".slot-btn").forEach(b =>
      b.addEventListener("click", () => { slot = b.dataset.slot; renderForm(); }));

    // 情绪:最多 2 个
    const moodSet = new Set((old.moods || []).slice(0, 2));
    const moodsBox = card.querySelector("#f-moods");
    MOODS.forEach(m => {
      const c = el("button", "chip" + (moodSet.has(m) ? " on" : ""), m);
      c.type = "button";
      c.addEventListener("click", () => {
        if (moodSet.has(m)) { moodSet.delete(m); c.classList.remove("on"); }
        else if (moodSet.size < 2) { moodSet.add(m); c.classList.add("on"); }
      });
      moodsBox.appendChild(c);
    });

    // 睡眠星级
    let sleepQ = old.sleepQ || 0;
    const starsBox = card.querySelector("#f-sleepq");
    if (starsBox) {
      const renderStars = () => {
        starsBox.innerHTML = "";
        for (let i = 1; i <= 5; i++) {
          const s = el("span", i <= sleepQ ? "on" : "", "★");
          s.addEventListener("click", () => { sleepQ = i; renderStars(); });
          starsBox.appendChild(s);
        }
      };
      renderStars();
    }

    const energy = card.querySelector("#f-energy");
    energy.addEventListener("input", () => card.querySelector("#f-energy-val").textContent = energy.value);
    card.querySelector("#f-more").addEventListener("click", () => card.querySelector("#f-acc").classList.toggle("open"));

    card.querySelector("#f-save").addEventListener("click", () => {
      const checkins = load(K.checkins, []).filter(c => !(c.date === todayStr() && c.slot === slot));
      checkins.push({
        id: uid(), date: todayStr(), time: nowTime(), slot,
        energy: Number(energy.value), moods: [...moodSet],
        sleepH: card.querySelector("#f-sleep")?.value ?? "", sleepQ: starsBox ? sleepQ : 0,
        drain: card.querySelector("#f-drain").value.trim(),
        restore: card.querySelector("#f-restore").value.trim(),
        extra: {
          body: card.querySelector("#x-body").value.trim(),
          scene: card.querySelector("#x-scene").value.trim(),
          who: card.querySelector("#x-who").value.trim(),
          task: card.querySelector("#x-task").value.trim(),
          cycle: card.querySelector("#x-cycle").value,
          note: card.querySelector("#x-note").value.trim(),
        },
      });
      save(K.checkins, checkins);
      showRecord();
      toast(`✓ 已保存${SLOTS.find(s => s.id === slot).name}的记录`);
    });
  }
  renderForm();
  $main.appendChild(card);

  // 今日已记录
  const todayCs = load(K.checkins, []).filter(c => c.date === todayStr());
  const todayEvs = load(K.events, []).filter(e => e.date === todayStr());
  if (todayCs.length || todayEvs.length) {
    const list = el("div", "card");
    list.appendChild(el("h3", "", "今天已记录"));
    todayCs.sort((a, b) => a.time.localeCompare(b.time)).forEach(c => {
      list.appendChild(el("div", "mini-rec",
        `<b>${SLOTS.find(s => s.id === c.slot)?.name || c.slot}</b> ${c.time} · 能量 ${c.energy}/10 · ${(c.moods || []).join("/") || "—"}${c.drain ? ` · 🔻${esc(c.drain)}` : ""}${c.restore ? ` · 🔋${esc(c.restore)}` : ""}`));
    });
    todayEvs.forEach(e => {
      list.appendChild(el("div", "mini-rec",
        `<span class="ev">⚡事件</span> ${e.time} · ${e.kind} ${e.delta > 0 ? "+" : ""}${e.delta} · ${esc(e.what)}`));
    });
    $main.appendChild(list);
  }

  // 备份
  const bk = el("div", "card");
  bk.innerHTML = `<div class="toolbar">
    <span class="tip" style="color:var(--ink-soft);font-size:0.8rem">数据备份:</span>
    <button class="btn btn-ghost btn-sm" id="bk-out">导出</button>
    <button class="btn btn-ghost btn-sm" id="bk-in">导入</button></div>`;
  $main.appendChild(bk);
  bk.querySelector("#bk-out").addEventListener("click", () => {
    const data = {};
    Object.values(K).forEach(key => data[key] = load(key, null));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `能量实验室备份-${todayStr()}.json`;
    a.click();
  });
  bk.querySelector("#bk-in").addEventListener("click", () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".json";
    inp.addEventListener("change", () => {
      inp.files[0]?.text().then(t => {
        try {
          const data = JSON.parse(t);
          if (!data[K.checkins]) throw new Error();
          Object.values(K).forEach(key => { if (data[key] != null) save(key, data[key]); });
          showRecord(); toast("✓ 备份已导入");
        } catch { alert("文件格式不对,请选择本工具导出的备份文件"); }
      });
    });
    inp.click();
  });
}

/* ================= 能量地图 ================= */
let mapRange = 7;
function showMap() {
  setNav("map");
  $main.innerHTML = "";
  const days = recordedDays();

  if (days.length < 3) {
    $main.appendChild(el("div", "empty",
      `已记录 <b>${days.length}</b> 天。记录满 <b>3</b> 天解锁初步观察,满 <b>7</b> 天地图会越来越像你。`));
    return;
  }

  // 范围切换
  const toggle = el("div", "range-toggle");
  [7, 30].forEach(n => {
    const b = el("button", "chip" + (mapRange === n ? " on" : ""), `近 ${n} 天`);
    b.addEventListener("click", () => { mapRange = n; showMap(); });
    toggle.appendChild(b);
  });
  $main.appendChild(toggle);

  const avgMap = dayAvgMap();
  const today = todayStr();
  const range = [];
  for (let i = mapRange - 1; i >= 0; i--) range.push(addDays(today, -i));

  // ---- 能量曲线 ----
  const chartCard = el("div", "card");
  chartCard.appendChild(el("h3", "", `能量曲线(近 ${mapRange} 天)`));
  chartCard.appendChild(buildCurve(range, avgMap));
  $main.appendChild(chartCard);

  // ---- 统计瓦片 ----
  const grid = el("div", "tile-grid");
  $main.appendChild(grid);
  const inRange = d => range.includes(d);

  // 高能量时段
  const bySlot = {};
  load(K.checkins, []).filter(c => inRange(c.date)).forEach(c => {
    (bySlot[c.slot] = bySlot[c.slot] || []).push(Number(c.energy));
  });
  const slotStats = SLOTS.map(s => ({ name: s.name, n: (bySlot[s.id] || []).length, avg: avg(bySlot[s.id] || []) }))
    .filter(s => s.n >= 3);
  let slotHtml;
  if (slotStats.length >= 2) {
    const best = slotStats.reduce((a, b) => a.avg > b.avg ? a : b);
    slotHtml = `<div class="t-value">${best.name}</div><div class="t-note">${slotStats.map(s => `${s.name}均值 ${r1(s.avg)}`).join(" · ")}</div>`;
  } else {
    slotHtml = `<div class="t-value">数据不足</div><div class="t-note">在不同时段各记录 3 次以上就能看到</div>`;
  }
  grid.appendChild(el("div", "tile", `<div class="t-label">🕐 高能量时段</div>${slotHtml}`));

  // 睡眠与当日精力
  const short = [], enough = [];
  range.forEach(d => {
    const s = sleepOf(d);
    if (s == null || avgMap[d] == null) return;
    (s < 6.5 ? short : enough).push(avgMap[d]);
  });
  let sleepHtml;
  if (short.length >= 3 && enough.length >= 3) {
    const diff = r1(avg(enough) - avg(short));
    sleepHtml = diff > 0
      ? `<div class="t-value">睡不足 6.5h,当天均分低 ${diff} 分</div><div class="t-note">${short.length} 天不足 vs ${enough.length} 天充足(相关性,非因果)</div>`
      : `<div class="t-value">暂未看到明显差异</div><div class="t-note">继续记录观察</div>`;
  } else {
    sleepHtml = `<div class="t-value">数据不足</div><div class="t-note">两种睡眠情况各满 3 天才比较</div>`;
  }
  grid.appendChild(el("div", "tile", `<div class="t-label">😴 睡眠与当日精力</div>${sleepHtml}`));

  // 工作日 vs 周末
  const wk = [], we = [];
  range.forEach(d => {
    if (avgMap[d] == null) return;
    const day = new Date(d + "T12:00:00").getDay();
    (day === 0 || day === 6 ? we : wk).push(avgMap[d]);
  });
  grid.appendChild(el("div", "tile",
    `<div class="t-label">📅 工作日 vs 周末</div>
     <div class="t-value">${wk.length >= 3 && we.length >= 2 ? `${r1(avg(wk))} vs ${r1(avg(we))}` : "数据不足"}</div>
     <div class="t-note">${wk.length >= 3 && we.length >= 2 ? "平均能量(工作日 vs 周末)" : "多记几天就能比较"}</div>`));

  // 记录天数
  const rangeDays = range.filter(d => avgMap[d] != null).length;
  grid.appendChild(el("div", "tile",
    `<div class="t-label">📈 这段时间</div><div class="t-value">记录 ${rangeDays}/${mapRange} 天</div>
     <div class="t-note">平均能量 ${r1(avg(range.filter(d => avgMap[d] != null).map(d => avgMap[d])))}/10</div>`));

  // 高频消耗 / 恢复
  function freqList(kind) {
    const counts = {};
    load(K.checkins, []).filter(c => inRange(c.date)).forEach(c => {
      const t = (kind === "drain" ? c.drain : c.restore || "").trim();
      if (t) counts[t] = (counts[t] || 0) + 1;
    });
    load(K.events, []).filter(e => inRange(e.date) && e.kind === (kind === "drain" ? "消耗" : "恢复")).forEach(e => {
      const t = e.what.trim();
      if (t) counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }
  const drains = freqList("drain"), restores = freqList("restore");
  grid.appendChild(el("div", "tile wide",
    `<div class="t-label">🔻 高频消耗情境</div>
     ${drains.length ? `<ul class="rank-list">${drains.map(([t, n]) => `<li><span>${esc(t)}</span><span class="cnt">${n} 次</span></li>`).join("")}</ul>` : `<div class="t-note">暂无记录</div>`}`));
  grid.appendChild(el("div", "tile wide",
    `<div class="t-label">🔋 高频恢复活动</div>
     ${restores.length ? `<ul class="rank-list">${restores.map(([t, n]) => `<li><span>${esc(t)}</span><span class="cnt">${n} 次</span></li>`).join("")}</ul>` : `<div class="t-note">暂无记录</div>`}`));

  $main.appendChild(el("p", "map-note", "以上都是相关性观察,不代表因果。想验证某条规律?去「七天实验」试试。"));
}

/* 单序列能量曲线:细线 + 小圆点 + 悬停提示,断档日断线 */
function buildCurve(range, avgMap) {
  const W = 560, H = 210, L = 30, R = 12, T = 12, B = 26;
  const iw = W - L - R, ih = H - T - B;
  const x = i => L + (range.length === 1 ? iw / 2 : i * iw / (range.length - 1));
  const y = v => T + ih - (v - 1) / 9 * ih;

  let grid = "", labels = "";
  [2, 4, 6, 8, 10].forEach(v => {
    grid += `<line x1="${L}" y1="${y(v)}" x2="${W - R}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1"/>`;
    labels += `<text x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end" font-size="10" fill="var(--ink-soft)">${v}</text>`;
  });
  const step = range.length > 10 ? Math.ceil(range.length / 6) : 1;
  range.forEach((d, i) => {
    if (i % step === 0 || i === range.length - 1)
      labels += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="var(--ink-soft)">${d.slice(5)}</text>`;
  });

  // 连续段落成折线,断档断开
  let paths = "", dots = "", hits = "";
  let seg = [];
  const flush = () => {
    if (seg.length > 1)
      paths += `<path d="M${seg.map(p => `${p[0]},${p[1]}`).join(" L")}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>`;
    seg = [];
  };
  let lastIdx = -1;
  range.forEach((d, i) => {
    const v = avgMap[d];
    if (v == null) { flush(); return; }
    const px = x(i), py = y(v);
    seg.push([px, py]);
    dots += `<circle cx="${px}" cy="${py}" r="3.5" fill="var(--accent)" stroke="var(--card)" stroke-width="2"/>`;
    hits += `<circle cx="${px}" cy="${py}" r="12" fill="transparent" data-tip="${d.slice(5)} · 能量 ${r1(v)}" data-px="${px}" data-py="${py}"/>`;
    lastIdx = i;
  });
  flush();
  if (lastIdx >= 0) {
    const v = avgMap[range[lastIdx]];
    labels += `<text x="${x(lastIdx)}" y="${y(v) - 9}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--accent-deep)">${r1(v)}</text>`;
  }

  const wrap = el("div", "chart-wrap");
  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="每日平均能量曲线">${grid}${labels}${paths}${dots}${hits}</svg><div class="chart-tip"></div>`;
  const tip = wrap.querySelector(".chart-tip");
  wrap.querySelectorAll("circle[data-tip]").forEach(c => {
    c.addEventListener("mouseenter", () => {
      const svg = wrap.querySelector("svg");
      const scale = svg.getBoundingClientRect().width / W;
      tip.textContent = c.dataset.tip;
      tip.style.left = c.dataset.px * scale + "px";
      tip.style.top = c.dataset.py * scale + "px";
      tip.style.display = "block";
    });
    c.addEventListener("mouseleave", () => tip.style.display = "none");
  });
  return wrap;
}

/* ================= 七天实验 ================= */
function showExp() {
  setNav("exp");
  $main.innerHTML = "";
  const exps = load(K.experiments, []);
  const active = exps.find(e => e.status === "active");

  if (active) {
    const passed = Math.min(7, Math.max(0, Math.floor((new Date(todayStr()) - new Date(active.startDate)) / 86400000) + 1));
    const card = el("div", "card");
    card.innerHTML = `
      <h3>🧪 进行中:${esc(active.variable)}</h3>
      <div class="exp-progress"><div style="width:${passed / 7 * 100}%"></div></div>
      <div class="exp-meta">第 <b>${passed}</b> / 7 天(${active.startDate} ~ ${active.endDate})</div>
      <div class="exp-meta">假设:<b>${esc(active.hypothesis)}</b></div>
      <div class="exp-meta">行动:${esc(active.action)}${active.when ? `(${esc(active.when)})` : ""}</div>
      <div class="exp-meta">观察指标:${esc(active.metric)}</div>
      ${active.stopCond ? `<div class="exp-meta">停止条件:${esc(active.stopCond)}</div>` : ""}
      <div class="toolbar" style="margin-top:10px">
        <button class="btn btn-primary" id="e-finish">${todayStr() >= active.endDate ? "实验结束,生成对比" : "提前结束并对比"}</button>
        <button class="btn btn-ghost" id="e-drop">放弃实验</button>
      </div>`;
    $main.appendChild(card);
    card.querySelector("#e-finish").addEventListener("click", () => {
      if (todayStr() < active.endDate && !confirm("还没到 7 天,确定提前结束吗?")) return;
      concludeExp(active);
    });
    card.querySelector("#e-drop").addEventListener("click", () => {
      if (!confirm("确定放弃这个实验吗?记录会保留,标记为已放弃。")) return;
      active.status = "dropped";
      save(K.experiments, exps);
      showExp();
    });
  } else {
    // 创建实验
    const card = el("div", "card");
    card.innerHTML = `
      <h3>🧪 开始一个七天实验</h3>
      <p class="audit-note" style="margin-top:0">从周审计报告里选一个最值得验证的变量,一次只改一件事。</p>
      <div class="field"><span class="q">要验证的变量</span>
        <div class="chips" id="e-suggests">${EXP_SUGGESTS.map(s => `<button type="button" class="chip suggest">${s}</button>`).join("")}</div>
        <input type="text" id="e-var" placeholder="也可以自己写" style="margin-top:8px"></div>
      <label class="field"><span class="q">我的假设</span>
        <input type="text" id="e-hypo" placeholder="例:提前30分钟睡,第二天上午能量会更高"></label>
      <label class="field"><span class="q">具体行动</span>
        <input type="text" id="e-action" placeholder="例:23:00 放下手机,23:30 前熄灯"></label>
      <label class="field"><span class="q">执行时间(选填)</span>
        <input type="text" id="e-when" placeholder="例:每晚 23:00"></label>
      <label class="field"><span class="q">观察指标</span>
        <input type="text" id="e-metric" value="每日平均能量评分" ></label>
      <label class="field"><span class="q">停止条件(选填)</span>
        <input type="text" id="e-stop" placeholder="例:连续两天明显失眠就停止"></label>
      <div class="toolbar"><button class="btn btn-primary" id="e-start">开始实验(今天起 7 天)</button></div>`;
    $main.appendChild(card);
    card.querySelectorAll(".chip.suggest").forEach(c =>
      c.addEventListener("click", () => card.querySelector("#e-var").value = c.textContent));
    card.querySelector("#e-start").addEventListener("click", () => {
      const variable = card.querySelector("#e-var").value.trim();
      const hypothesis = card.querySelector("#e-hypo").value.trim();
      const action = card.querySelector("#e-action").value.trim();
      if (!variable || !hypothesis || !action) return alert("变量、假设、具体行动是必填的——这是实验,不是愿望清单 :)");
      exps.push({
        id: uid(), variable, hypothesis, action,
        when: card.querySelector("#e-when").value.trim(),
        metric: card.querySelector("#e-metric").value.trim() || "每日平均能量评分",
        stopCond: card.querySelector("#e-stop").value.trim(),
        startDate: todayStr(), endDate: addDays(todayStr(), 6),
        status: "active",
      });
      save(K.experiments, exps);
      showExp();
      toast("🧪 实验开始!这 7 天照常记录即可");
    });
  }

  // 历史实验
  const done = exps.filter(e => e.status !== "active").reverse();
  if (done.length) {
    const list = el("div", "card");
    list.appendChild(el("h3", "", "历史实验"));
    done.forEach(e => {
      const item = el("div", "answer-item");
      const res = e.result;
      item.innerHTML = `
        <div><b>${esc(e.variable)}</b> <span class="tip">(${e.startDate} 起,${e.status === "dropped" ? "已放弃" : "已完成"})</span></div>
        ${res ? `<div class="exp-meta">前 7 天均值 ${res.before ?? "无数据"} → 实验期均值 ${res.during ?? "无数据"} · 结论:${esc(res.verdict)} · 决定:${esc(res.decision)}${res.note ? `<br>${esc(res.note)}` : ""}</div>` : ""}`;
      list.appendChild(item);
    });
    $main.appendChild(list);
  }
}

function concludeExp(exp) {
  const exps = load(K.experiments, []);
  const e = exps.find(x => x.id === exp.id);
  const avgMap = dayAvgMap();
  const collect = (from, to) => {
    const arr = [];
    for (let d = from; d <= to; d = addDays(d, 1)) if (avgMap[d] != null) arr.push(avgMap[d]);
    return arr;
  };
  const before = collect(addDays(e.startDate, -7), addDays(e.startDate, -1));
  const during = collect(e.startDate, e.endDate);
  const bAvg = before.length ? r1(avg(before)) : null;
  const dAvg = during.length ? r1(avg(during)) : null;

  $main.innerHTML = "";
  setNav("exp");
  const card = el("div", "card");
  card.innerHTML = `
    <h3>实验对比:${esc(e.variable)}</h3>
    <div class="compare-row">
      <div class="tile"><div class="t-label">实验前 7 天均值</div><div class="t-value">${bAvg ?? "无数据"}</div><div class="t-note">${before.length} 天有记录</div></div>
      <div class="tile"><div class="t-label">实验期均值</div><div class="t-value">${dAvg ?? "无数据"}</div><div class="t-note">${during.length} 天有记录</div></div>
    </div>
    <p class="audit-note">数字只是参考——样本很小,而且这一周可能同时发生了别的变化(相关性≠因果)。结合主观感受来判断:</p>
    <label class="field"><span class="q">数据是否支持假设?</span>
      <select id="c-verdict"><option>支持</option><option>部分支持</option><option>不支持</option><option>说不清</option></select></label>
    <label class="field"><span class="q">主观感受是否改善?</span>
      <select id="c-subj"><option>明显改善</option><option>略有改善</option><option>没变化</option><option>更差了</option></select></label>
    <label class="field"><span class="q">决定</span>
      <select id="c-decision"><option>继续保持,变成习惯</option><option>调整方案再试一轮</option><option>停止,换下一个变量</option></select></label>
    <label class="field"><span class="q">一句话结论(会存进历史)</span>
      <input type="text" id="c-note" placeholder="例:早睡对我上午的能量确实有影响,但周末例外"></label>
    <div class="toolbar">
      <button class="btn btn-primary" id="c-save">保存结论</button>
      <button class="btn btn-ghost" id="c-ai">生成 AI 对比分析提示词</button>
    </div>
    <div id="c-ai-out" style="margin-top:12px"></div>`;
  $main.appendChild(card);

  card.querySelector("#c-ai").addEventListener("click", () => {
    const out = card.querySelector("#c-ai-out");
    out.innerHTML = "";
    const ta = el("textarea", "prompt-box");
    ta.value = buildExpPrompt(e, bAvg, dAvg);
    ta.readOnly = true;
    out.appendChild(ta);
    const btn = el("button", "btn btn-primary btn-sm", "一键复制");
    btn.style.marginTop = "8px";
    btn.addEventListener("click", () => navigator.clipboard.writeText(ta.value).then(() => btn.textContent = "✓ 已复制"));
    out.appendChild(btn);
  });

  card.querySelector("#c-save").addEventListener("click", () => {
    e.status = "done";
    e.result = {
      before: bAvg, during: dAvg,
      verdict: card.querySelector("#c-verdict").value,
      subjective: card.querySelector("#c-subj").value,
      decision: card.querySelector("#c-decision").value,
      note: card.querySelector("#c-note").value.trim(),
    };
    save(K.experiments, exps);
    // 有效方法 → 提示存入工具箱
    if (e.result.verdict !== "不支持" && e.result.decision.startsWith("继续") &&
        confirm("这个方法看起来对你有效,存入「恢复工具箱」吗?")) {
      const tools = load(K.toolbox, []);
      tools.push({ id: uid(), name: e.variable, scene: "其他", uses: 0, rating: "有效", note: e.result.note || e.hypothesis });
      save(K.toolbox, tools);
    }
    showExp();
    toast("✓ 实验已归档");
  });
}

function buildExpPrompt(e, bAvg, dAvg) {
  const checkins = load(K.checkins, []).filter(c => c.date >= addDays(e.startDate, -7) && c.date <= e.endDate);
  const lines = checkins.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .map(c => `${c.date} ${SLOTS.find(s => s.id === c.slot)?.name || c.slot}:能量${c.energy}/10,情绪[${(c.moods || []).join("、")}]${c.sleepH ? `,睡眠${c.sleepH}h` : ""}${c.drain ? `,最消耗:${c.drain}` : ""}${c.restore ? `,最恢复:${c.restore}` : ""}`).join("\n");
  return `你是一位严谨的个人实验分析助手。我刚完成一个为期 7 天的生活实验,请帮我做前后对比分析。

【边界】这是生活自我观察,不是医学结论。样本极小,请明确区分【已确认事实】【相关性线索】【合理推测】【暂时无法判断】,禁止因果断言。

【实验设定】
变量:${e.variable}
假设:${e.hypothesis}
行动:${e.action}${e.when ? `(${e.when})` : ""}
观察指标:${e.metric}
实验期:${e.startDate} ~ ${e.endDate}(前 7 天为基线)
基线均值:${bAvg ?? "无数据"} / 实验期均值:${dAvg ?? "无数据"}

【记录数据】
${lines || "(无逐日记录)"}

【请输出】
1. 数据是否支持假设(引用具体记录)
2. 可能的竞争性解释(这周还有什么别的变化可能影响结果)
3. 建议:继续保持 / 调整后再试(怎么调) / 停止换方向
4. 如果继续,下一轮实验怎么设计更能排除干扰`;
}

/* ================= 周审计 ================= */
function showAudit() {
  setNav("audit");
  $main.innerHTML = "";
  const days = recordedDays();

  const intro = el("div", "card");
  intro.innerHTML = `<p class="audit-note" style="margin:0">
    每周做一次就够。满 <b>7 天</b>记录后,把生成的「审计提示词」复制给任意 AI
    (豆包、DeepSeek、Kimi、ChatGPT 都行),得到你的周审计报告;报告可粘贴回来存档,
    再从报告里挑一个变量去开「七天实验」。</p>`;
  $main.appendChild(intro);

  if (!days.length) {
    $main.appendChild(el("div", "empty", "还没有记录,先去「记录」攒数据"));
    return;
  }

  const card = el("div", "card");
  card.innerHTML = `
    <label class="field"><span class="q">审计范围</span>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input type="date" id="a-from" value="${addDays(todayStr(), -6)}" style="width:auto">
        <span>至</span>
        <input type="date" id="a-to" value="${todayStr()}" style="width:auto">
      </div></label>
    <div class="toolbar"><button class="btn btn-primary" id="a-gen">生成审计提示词</button></div>
    <div id="a-out" style="margin-top:12px"></div>`;
  $main.appendChild(card);

  card.querySelector("#a-gen").addEventListener("click", () => {
    const from = card.querySelector("#a-from").value, to = card.querySelector("#a-to").value;
    const out = card.querySelector("#a-out");
    out.innerHTML = "";
    const cs = load(K.checkins, []).filter(c => c.date >= from && c.date <= to);
    if (!cs.length) { out.appendChild(el("p", "audit-note", "这个范围内没有记录")); return; }
    const nDays = new Set(cs.map(c => c.date)).size;
    if (nDays < 7) out.appendChild(el("p", "audit-note", `⚠️ 范围内只有 ${nDays} 天记录,不满 7 天也能生成,但结论会不太可靠。`));
    const ta = el("textarea", "prompt-box");
    ta.value = buildAuditPrompt(from, to);
    ta.readOnly = true;
    out.appendChild(ta);
    const btn = el("button", "btn btn-primary", "一键复制");
    btn.style.marginTop = "8px";
    btn.addEventListener("click", () => {
      ta.select();
      navigator.clipboard.writeText(ta.value).then(
        () => btn.textContent = "✓ 已复制,去粘贴给 AI 吧",
        () => { document.execCommand("copy"); btn.textContent = "✓ 已复制,去粘贴给 AI 吧"; });
    });
    out.appendChild(btn);
  });

  // 报告存档
  const repCard = el("div", "card");
  repCard.innerHTML = `
    <label class="field"><span class="q">📥 保存 AI 的审计报告</span>
      <textarea id="r-text" placeholder="把 AI 给你的报告粘贴到这里存档"></textarea></label>
    <div class="toolbar"><button class="btn btn-ghost" id="r-save">存档报告</button></div>`;
  $main.appendChild(repCard);
  repCard.querySelector("#r-save").addEventListener("click", () => {
    const t = repCard.querySelector("#r-text").value.trim();
    if (!t) return;
    const reports = load(K.reports, []);
    reports.unshift({ savedAt: todayStr(), text: t });
    save(K.reports, reports);
    showAudit();
  });

  const reports = load(K.reports, []);
  if (reports.length) {
    const listCard = el("div", "card");
    listCard.appendChild(el("h3", "", "历史报告"));
    reports.forEach(r => {
      const item = el("div", "report-item answer-item");
      const preview = r.text.length > 120 ? r.text.slice(0, 120) + "……" : r.text;
      item.innerHTML = `<div class="r-head">${r.savedAt} 的报告</div><div class="r-body">${esc(preview)}</div>`;
      if (r.text.length > 120) {
        const btnFull = el("button", "btn btn-ghost btn-sm", "展开全文");
        btnFull.style.marginTop = "6px";
        btnFull.addEventListener("click", () => { item.querySelector(".r-body").textContent = r.text; btnFull.remove(); });
        item.appendChild(btnFull);
      }
      listCard.appendChild(item);
    });
    $main.appendChild(listCard);
  }
}

function buildAuditPrompt(from, to) {
  const cs = load(K.checkins, []).filter(c => c.date >= from && c.date <= to)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const evs = load(K.events, []).filter(e => e.date >= from && e.date <= to);
  const active = load(K.experiments, []).find(e => e.status === "active");

  const byDate = {};
  cs.forEach(c => (byDate[c.date] = byDate[c.date] || []).push(c));
  const dataBlock = Object.entries(byDate).map(([d, arr]) => {
    const lines = arr.map(c => {
      const slot = SLOTS.find(s => s.id === c.slot)?.name || c.slot;
      const x = c.extra || {};
      const extras = [x.body && `身体:${x.body}`, x.scene && `场景:${x.scene}`, x.who && `同伴:${x.who}`,
        x.task && `任务:${x.task}`, x.cycle && x.cycle !== "不记录" && `经期:${x.cycle}`, x.note && `备注:${x.note}`]
        .filter(Boolean).join(";");
      return `  [${slot} ${c.time}] 能量 ${c.energy}/10;情绪:${(c.moods || []).join("、") || "未记录"}` +
        (c.sleepH ? `;昨晚睡眠 ${c.sleepH}h,质量 ${c.sleepQ || "?"}/5` : "") +
        (c.drain ? `;最消耗:${c.drain}` : "") + (c.restore ? `;最恢复:${c.restore}` : "") +
        (extras ? `;${extras}` : "");
    }).join("\n");
    const dayEvs = evs.filter(e => e.date === d)
      .map(e => `  [事件 ${e.time}] ${e.kind} ${e.delta > 0 ? "+" : ""}${e.delta}:${e.what}${e.mood ? `(情绪:${e.mood}` : ""}${e.scene ? `,场景:${e.scene})` : e.mood ? ")" : ""}`)
      .join("\n");
    return `=== ${d} ===\n${lines}${dayEvs ? "\n" + dayEvs : ""}`;
  }).join("\n\n");

  return `你是一位严谨、务实的个人能量教练。请基于我 ${from} 至 ${to} 的记录,为我做一次「周审计」。

【边界说明】这是自我观察和生活管理工具的分析,不是心理或医学诊断。样本很小,相关性不是因果。如果记录中出现持续、严重的疲惫或情绪困扰迹象,请在报告末尾温和地提醒我考虑寻求医疗或心理专业支持,而不是继续给生活优化建议。

【我的记录】
${dataBlock}
${active ? `\n【进行中的实验】变量:${active.variable};假设:${active.hypothesis};开始于 ${active.startDate}。分析时请把它作为潜在干扰因素考虑。` : ""}

【请严格按以下 8 个部分输出】
1. 本周事实摘要:只陈述数据里确实存在的事实
2. 观察到的相关模式:哪些情况反复同时出现
3. 可能的竞争性解释:同一个现象,还有哪些不同的解释
4. 数据不足的部分:哪些问题现在还回答不了,缺什么数据
5. 最大能量漏洞:证据最强的那个消耗源
6. 最稳定的恢复来源:证据最强的那个恢复方式
7. 下周最值得验证的问题:一个具体的、可实验的问题
8. 一个最小实验:变量、假设、具体行动、观察指标、停止条件

【分析要求】
- 每条结论必须标注类别:【已确认事实】/【相关性线索】/【合理推测】/【暂时无法判断】
- 必须引用我记录里的原话作为证据
- 禁止"你一定是因为……"式的因果断言
- 数据不足就直说,不要硬编
- 语气:像一个了解我的朋友,诚实但不评判`;
}

/* ================= 恢复工具箱 ================= */
function showToolbox() {
  setNav("toolbox");
  $main.innerHTML = "";
  const tools = load(K.toolbox, []);

  const intro = el("div", "card");
  intro.innerHTML = `<p class="audit-note" style="margin:0">
    只放<b>你自己验证过有效</b>的方法(通常来自完成的七天实验)。
    用得越久,这里就越像一份专属于你的「自我使用说明书」。</p>`;
  $main.appendChild(intro);

  // 添加
  const addCard = el("div", "card");
  addCard.innerHTML = `
    <h3>添加一个恢复方法</h3>
    <label class="field"><span class="q">方法</span><input type="text" id="t-name" placeholder="例:下班后先散步15分钟再回家"></label>
    <label class="field"><span class="q">适用场景</span>
      <select id="t-scene">${TOOL_SCENES.map(s => `<option>${s}</option>`).join("")}</select></label>
    <label class="field"><span class="q">备注(选填)</span><input type="text" id="t-note" placeholder="什么情况下最有用?"></label>
    <div class="toolbar"><button class="btn btn-primary btn-sm" id="t-add">存入工具箱</button></div>`;
  $main.appendChild(addCard);
  addCard.querySelector("#t-add").addEventListener("click", () => {
    const name = addCard.querySelector("#t-name").value.trim();
    if (!name) return;
    tools.push({ id: uid(), name, scene: addCard.querySelector("#t-scene").value, uses: 0, rating: "", note: addCard.querySelector("#t-note").value.trim() });
    save(K.toolbox, tools);
    showToolbox();
  });

  if (!tools.length) {
    $main.appendChild(el("div", "empty", "工具箱还是空的。完成一个七天实验,把验证有效的方法存进来。"));
    return;
  }

  tools.forEach(t => {
    const card = el("div", "card tool-card");
    card.innerHTML = `
      <div class="t-head"><span class="t-name">${esc(t.name)}</span><span class="tag">${esc(t.scene)}</span></div>
      <div class="t-stats">已使用 ${t.uses} 次${t.rating ? ` · 我的评价:${esc(t.rating)}` : ""}${t.note ? ` · ${esc(t.note)}` : ""}</div>
      <div class="toolbar">
        <button class="btn btn-primary btn-sm" data-act="use">今天用了 +1</button>
        <select data-act="rate" style="width:auto;padding:4px 8px;font-size:0.8rem">
          <option value="">评价…</option><option ${t.rating === "有效" ? "selected" : ""}>有效</option>
          <option ${t.rating === "一般" ? "selected" : ""}>一般</option><option ${t.rating === "无效" ? "selected" : ""}>无效</option></select>
        <button class="btn btn-ghost btn-sm" data-act="del">删除</button>
      </div>`;
    card.querySelector('[data-act="use"]').addEventListener("click", () => { t.uses++; save(K.toolbox, tools); showToolbox(); });
    card.querySelector('[data-act="rate"]').addEventListener("change", ev => { t.rating = ev.target.value; save(K.toolbox, tools); showToolbox(); });
    card.querySelector('[data-act="del"]').addEventListener("click", () => {
      if (confirm(`删除「${t.name}」?`)) { save(K.toolbox, tools.filter(x => x.id !== t.id)); showToolbox(); }
    });
    $main.appendChild(card);
  });
}

/* ================= 启动 ================= */
tabs.record.addEventListener("click", showRecord);
tabs.map.addEventListener("click", showMap);
tabs.exp.addEventListener("click", showExp);
tabs.audit.addEventListener("click", showAudit);
tabs.toolbox.addEventListener("click", showToolbox);
showRecord();
