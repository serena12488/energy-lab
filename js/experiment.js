/* ================= 七天实验 ================= */
function showExp() {
  setNav("exp");
  $main.innerHTML = "";
  const experiments = load(K.experiments, []);
  const active = experiments.find(item => item.status === "active");

  if (active) {
    active.adherence ||= [];
    const passed = Math.min(7, Math.max(1, Math.floor((new Date(`${todayStr()}T12:00:00`) - new Date(`${active.startDate}T12:00:00`)) / 86400000) + 1));
    const card = el("div", "card");
    card.innerHTML = `
      <div class="experiment-head"><div><p class="eyebrow">进行中的微型实验</p><h3>${esc(active.variable)}</h3></div><span class="confidence-badge">第 ${passed}/7 天</span></div>
      <div class="exp-progress"><div style="width:${passed / 7 * 100}%"></div></div>
      <div class="experiment-spec"><div><span>假设</span><b>${esc(active.hypothesis)}</b></div><div><span>行动</span><b>${esc(active.action)}${active.when ? `（${esc(active.when)}）` : ""}</b></div><div><span>指标</span><b>${esc(active.metric)}</b></div>${active.stopCond ? `<div><span>停止条件</span><b>${esc(active.stopCond)}</b></div>` : ""}</div>
      <div class="toolbar"><button class="btn btn-primary" id="e-finish">${todayStr() >= active.endDate ? "实验结束，生成对比" : "提前结束并对比"}</button><button class="btn btn-ghost" id="e-drop">放弃实验</button></div>`;
    $main.appendChild(card);

    if (todayStr() >= active.startDate && todayStr() <= active.endDate) {
      const todayLog = active.adherence.find(item => item.date === todayStr());
      const logCard = el("div", "card adherence-card");
      logCard.innerHTML = `
        <h3>今天执行了吗？</h3>
        <p class="audit-note">不记录执行情况，就无法判断实验是否真的发生。诚实比连续打卡更重要。</p>
        <div class="adherence-options" id="e-adherence">
          ${[["full", "完全执行"], ["partial", "部分执行"], ["none", "没有执行"]].map(([value, label]) => `<button type="button" class="adherence-btn ${todayLog?.status === value ? "on" : ""}" data-status="${value}">${label}</button>`).join("")}
        </div>
        <label class="field"><span class="q">干扰因素或主观感受（选填）</span><input type="text" id="e-log-note" value="${esc(todayLog?.note)}" placeholder="例：临时加班，只完成了一半"></label>
        <div class="toolbar"><button class="btn btn-primary btn-sm" id="e-log-save">保存今日执行</button></div>`;
      $main.appendChild(logCard);
      let status = todayLog?.status || "";
      logCard.querySelectorAll("[data-status]").forEach(button => button.addEventListener("click", () => {
        status = button.dataset.status;
        logCard.querySelectorAll("[data-status]").forEach(item => item.classList.toggle("on", item === button));
      }));
      logCard.querySelector("#e-log-save").addEventListener("click", () => {
        if (!status) return alert("请选择今天的执行情况");
        active.adherence = active.adherence.filter(item => item.date !== todayStr());
        active.adherence.push({ date: todayStr(), status, note: logCard.querySelector("#e-log-note").value.trim() });
        save(K.experiments, experiments);
        showExp();
        toast("今日执行情况已保存");
      });
    }

    const tracker = el("div", "card");
    tracker.innerHTML = `<h3>七天执行记录</h3><div class="day-tracker">${Array.from({ length: 7 }, (_, index) => {
      const date = addDays(active.startDate, index);
      const log = active.adherence.find(item => item.date === date);
      const mark = log?.status === "full" ? "✓" : log?.status === "partial" ? "◐" : log?.status === "none" ? "×" : "·";
      const label = log?.status === "full" ? "完全" : log?.status === "partial" ? "部分" : log?.status === "none" ? "未执行" : "待记录";
      return `<div class="day-cell ${log?.status || "pending"}"><span>Day ${index + 1}</span><b>${mark}</b><small>${date.slice(5)} · ${label}</small></div>`;
    }).join("")}</div>`;
    $main.appendChild(tracker);

    card.querySelector("#e-finish").addEventListener("click", () => {
      if (todayStr() < active.endDate && !confirm("还没到 7 天，确定提前结束吗？")) return;
      concludeExp(active);
    });
    card.querySelector("#e-drop").addEventListener("click", () => {
      if (!confirm("确定放弃这个实验吗？已有记录会保留。")) return;
      active.status = "dropped";
      save(K.experiments, experiments);
      showExp();
    });
  } else {
    const card = el("div", "card");
    card.innerHTML = `
      <h3>开始一个七天实验</h3>
      <p class="audit-note">一次只改变一个变量。优先选择低风险、可逆、不会要求你忽视身体信号的行动。</p>
      <div class="field"><span class="q">要验证的变量</span><div class="chips" id="e-suggests">${EXP_SUGGESTS.map(item => `<button type="button" class="chip suggest">${esc(item)}</button>`).join("")}</div><input type="text" id="e-var" placeholder="也可以自己写" style="margin-top:9px"></div>
      <label class="field"><span class="q">我的假设</span><input type="text" id="e-hypo" placeholder="例：提前进入睡前降速，第二天上午能量会更稳定"></label>
      <label class="field"><span class="q">具体行动</span><input type="text" id="e-action" placeholder="例：23:00 放下手机，做10分钟放松"></label>
      <label class="field"><span class="q">执行时间（选填）</span><input type="text" id="e-when" placeholder="例：每晚 23:00"></label>
      <label class="field"><span class="q">观察指标</span><input type="text" id="e-metric" value="每日平均能量、思维清晰度与主观感受"></label>
      <label class="field"><span class="q">停止条件（选填）</span><input type="text" id="e-stop" placeholder="例：连续两天状态明显变差就停止"></label>
      <div class="safety-callout"><b>实验边界</b><span>不建议尝试主动压缩睡眠、忽视持续疲劳或替代医疗处理。</span></div>
      <div class="toolbar"><button class="btn btn-primary" id="e-start">开始七天实验</button></div>`;
    $main.appendChild(card);
    card.querySelectorAll("#e-suggests .chip").forEach(button => button.addEventListener("click", () => { card.querySelector("#e-var").value = button.textContent; }));
    card.querySelector("#e-start").addEventListener("click", () => {
      const variable = card.querySelector("#e-var").value.trim();
      const hypothesis = card.querySelector("#e-hypo").value.trim();
      const action = card.querySelector("#e-action").value.trim();
      if (!variable || !hypothesis || !action) return alert("变量、假设和具体行动是必填项");
      experiments.push({
        id: uid(), variable, hypothesis, action,
        when: card.querySelector("#e-when").value.trim(),
        metric: card.querySelector("#e-metric").value.trim() || "每日平均能量",
        stopCond: card.querySelector("#e-stop").value.trim(),
        startDate: todayStr(), endDate: addDays(todayStr(), 6), status: "active", adherence: [],
      });
      save(K.experiments, experiments);
      showExp();
      toast("实验已开始；请每天记录执行情况");
    });
  }

  const history = experiments.filter(item => item.status !== "active").reverse();
  if (history.length) {
    const list = el("div", "card");
    list.appendChild(el("h3", "", "历史实验"));
    history.forEach(experiment => {
      const result = experiment.result;
      const completed = (experiment.adherence || []).filter(item => item.status === "full").length;
      list.appendChild(el("div", "answer-item", `<div><b>${esc(experiment.variable)}</b> <span class="tip">${experiment.startDate} 起 · ${experiment.status === "dropped" ? "已放弃" : "已完成"}</span></div>${result ? `<div class="exp-meta">基线 ${result.before ?? "—"} → 实验期 ${result.during ?? "—"} · 完全执行 ${completed} 天 · ${esc(result.verdict)} · ${esc(result.decision)}${result.note ? `<br>${esc(result.note)}` : ""}</div>` : ""}`));
    });
    $main.appendChild(list);
  }
}

function concludeExp(experiment) {
  const experiments = load(K.experiments, []);
  const item = experiments.find(current => current.id === experiment.id);
  const averageMap = dayAvgMap();
  const collect = (from, to) => {
    const values = [];
    for (let date = from; date <= to; date = addDays(date, 1)) if (averageMap[date] != null) values.push(averageMap[date]);
    return values;
  };
  const before = collect(addDays(item.startDate, -7), addDays(item.startDate, -1));
  const during = collect(item.startDate, item.endDate);
  const fullDates = (item.adherence || []).filter(log => log.status === "full").map(log => log.date);
  const noneDates = (item.adherence || []).filter(log => log.status === "none").map(log => log.date);
  const fullValues = fullDates.map(date => averageMap[date]).filter(value => value != null);
  const noneValues = noneDates.map(date => averageMap[date]).filter(value => value != null);
  const beforeAvg = r1(avg(before));
  const duringAvg = r1(avg(during));
  const fullAvg = r1(avg(fullValues));
  const noneAvg = r1(avg(noneValues));

  $main.innerHTML = "";
  setNav("exp");
  const card = el("div", "card");
  card.innerHTML = `
    <h3>实验对比：${esc(item.variable)}</h3>
    <div class="compare-grid">
      <div class="tile"><div class="t-label">实验前 7 天</div><div class="t-value">${beforeAvg ?? "无数据"}</div><div class="t-note">${before.length} 天有记录</div></div>
      <div class="tile"><div class="t-label">整个实验期</div><div class="t-value">${duringAvg ?? "无数据"}</div><div class="t-note">${during.length} 天有记录</div></div>
      <div class="tile"><div class="t-label">完全执行日</div><div class="t-value">${fullAvg ?? "无数据"}</div><div class="t-note">${fullValues.length} 天可比较</div></div>
      <div class="tile"><div class="t-label">未执行日</div><div class="t-value">${noneAvg ?? "无数据"}</div><div class="t-note">${noneValues.length} 天可比较</div></div>
    </div>
    <p class="audit-note">样本极小，执行日和未执行日也可能存在其他差异。数字只能作为线索，不能单独证明因果。</p>
    <label class="field"><span class="q">数据是否支持假设？</span><select id="c-verdict"><option>支持</option><option>部分支持</option><option>不支持</option><option>说不清</option></select></label>
    <label class="field"><span class="q">主观感受是否改善？</span><select id="c-subj"><option>明显改善</option><option>略有改善</option><option>没变化</option><option>更差了</option></select></label>
    <label class="field"><span class="q">下一步决定</span><select id="c-decision"><option>继续保持，变成习惯</option><option>调整方案再试一轮</option><option>停止，换下一个变量</option></select></label>
    <label class="field"><span class="q">一句话结论</span><input type="text" id="c-note" placeholder="例：有帮助，但只有真正执行的那几天差异明显"></label>
    <div class="toolbar"><button class="btn btn-primary" id="c-save">保存结论</button><button class="btn btn-ghost" id="c-ai">生成 AI 分析提示词</button></div><div id="c-ai-out" style="margin-top:12px"></div>`;
  $main.appendChild(card);

  card.querySelector("#c-ai").addEventListener("click", () => {
    const output = card.querySelector("#c-ai-out");
    output.innerHTML = "";
    const textarea = el("textarea", "prompt-box");
    textarea.value = buildExpPrompt(item, { beforeAvg, duringAvg, fullAvg, noneAvg });
    textarea.readOnly = true;
    output.appendChild(textarea);
    const copy = el("button", "btn btn-primary btn-sm", "一键复制");
    copy.style.marginTop = "8px";
    copy.addEventListener("click", () => navigator.clipboard.writeText(textarea.value).then(() => { copy.textContent = "已复制"; }));
    output.appendChild(copy);
  });

  card.querySelector("#c-save").addEventListener("click", () => {
    item.status = "done";
    item.result = {
      before: beforeAvg, during: duringAvg, full: fullAvg, none: noneAvg,
      verdict: card.querySelector("#c-verdict").value,
      subjective: card.querySelector("#c-subj").value,
      decision: card.querySelector("#c-decision").value,
      note: card.querySelector("#c-note").value.trim(),
    };
    save(K.experiments, experiments);
    if (item.result.verdict !== "不支持" && item.result.decision.startsWith("继续") && confirm("把这个经过验证的方法存入恢复工具箱吗？")) {
      const tools = load(K.toolbox, []);
      tools.push({ id: uid(), name: item.variable, category: "其他", scene: "其他", uses: 0, rating: "有效", note: item.result.note || item.hypothesis, lastUsed: "" });
      save(K.toolbox, tools);
    }
    showExp();
    toast("实验已归档");
  });
}

function buildExpPrompt(experiment, stats) {
  const checkins = load(K.checkins, []).filter(item => item.date >= addDays(experiment.startDate, -7) && item.date <= experiment.endDate).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const logs = experiment.adherence || [];
  const lines = checkins.map(checkin => {
    const extra = getExtra(checkin);
    const log = logs.find(item => item.date === checkin.date);
    return `${checkin.date} ${SLOTS.find(item => item.id === checkin.slot)?.name || checkin.slot}: 能量${checkin.energy}/10; 情绪[${(checkin.moods || []).join("、") || "未记录"}]${checkin.sleepH ? `; 睡眠${checkin.sleepH}h,质量${checkin.sleepQ || "?"}/5` : ""}${extra.meaning ? `; 意义感${extra.meaning}/5` : ""}${extra.clarity ? `; 清晰度${extra.clarity}/5` : ""}${extra.taskLoad ? `; 任务负荷${extra.taskLoad}/5` : ""}${checkin.drain ? `; 消耗:${checkin.drain}` : ""}${checkin.restore ? `; 恢复:${checkin.restore}` : ""}${log ? `; 当天实验执行:${log.status === "full" ? "完全" : log.status === "partial" ? "部分" : "未执行"}${log.note ? `(${log.note})` : ""}` : ""}`;
  }).join("\n");
  return `你是一位严谨的个人实验分析助手。请分析一个为期 7 天的低风险生活实验。\n\n【边界】这是个人自我观察，不是医学或心理诊断。样本极小，相关性不是因果。不要建议压缩睡眠、忽视持续疲劳或替代专业医疗。请明确区分【已确认事实】【相关性线索】【合理推测】【暂时无法判断】。\n\n【实验设定】\n变量：${experiment.variable}\n假设：${experiment.hypothesis}\n行动：${experiment.action}${experiment.when ? `（${experiment.when}）` : ""}\n指标：${experiment.metric}\n实验期：${experiment.startDate} 至 ${experiment.endDate}\n停止条件：${experiment.stopCond || "未设置"}\n\n【汇总】\n基线均值：${stats.beforeAvg ?? "无数据"}\n实验期均值：${stats.duringAvg ?? "无数据"}\n完全执行日均值：${stats.fullAvg ?? "无数据"}\n未执行日均值：${stats.noneAvg ?? "无数据"}\n\n【逐条记录】\n${lines || "无记录"}\n\n【请输出】\n1. 执行完整度与数据质量\n2. 实验前、实验期、完全执行日和未执行日的事实对比\n3. 数据是否支持假设，并引用具体记录\n4. 至少三个竞争性解释或干扰因素\n5. 哪些内容暂时无法判断\n6. 建议：继续、调整或停止，并说明依据\n7. 如果继续，下一轮如何设计得更清楚、更安全`;
}

