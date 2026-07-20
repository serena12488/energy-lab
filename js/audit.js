/* ================= 周审计 ================= */
function showAudit() {
  setNav("audit");
  $main.innerHTML = "";
  const days = recordedDays();
  const intro = el("div", "card");
  intro.innerHTML = `<p class="audit-note" style="margin:0">周审计不只是找“什么让我累”，而是同时检查：<b>背景</b>（我为什么做）、<b>精力</b>（身体与注意力发生了什么）、<b>结构</b>（时间、环境、承诺和关系如何影响我）。</p>`;
  $main.appendChild(intro);
  if (!days.length) {
    $main.appendChild(el("div", "empty", "还没有记录。先积累几天真实切片。"));
    return;
  }

  const card = el("div", "card");
  card.innerHTML = `
    <label class="field"><span class="q">审计范围</span><div class="date-range"><input type="date" id="a-from" value="${addDays(todayStr(), -6)}"><span>至</span><input type="date" id="a-to" value="${todayStr()}"></div></label>
    <label class="field"><span class="q">本周最重要的事情是什么？为什么重要？ <span class="tip">背景</span></span><textarea id="a-background" placeholder="例：准备申请材料，因为我想为转型建立真实证据"></textarea></label>
    <label class="field"><span class="q">本周有哪些结构性因素影响你？ <span class="tip">时间、环境、承诺、人际关系</span></span><textarea id="a-structure" placeholder="例：临时会议增加；办公室噪音大；周三得到同事支持"></textarea></label>
    <div class="toolbar"><button class="btn btn-primary" id="a-gen">生成“背景—精力—结构”审计提示词</button></div><div id="a-out" style="margin-top:12px"></div>`;
  $main.appendChild(card);

  card.querySelector("#a-gen").addEventListener("click", () => {
    const from = card.querySelector("#a-from").value;
    const to = card.querySelector("#a-to").value;
    const output = card.querySelector("#a-out");
    output.innerHTML = "";
    const checkins = load(K.checkins, []).filter(item => item.date >= from && item.date <= to);
    if (!checkins.length) return output.appendChild(el("p", "audit-note", "这个范围内没有记录"));
    const numberOfDays = new Set(checkins.map(item => item.date)).size;
    if (numberOfDays < 7) output.appendChild(el("p", "audit-note", `范围内只有 ${numberOfDays} 天记录，仍可生成，但置信度较低。`));
    const textarea = el("textarea", "prompt-box");
    textarea.value = buildAuditPrompt(from, to, {
      background: card.querySelector("#a-background").value.trim(),
      structure: card.querySelector("#a-structure").value.trim(),
    });
    textarea.readOnly = true;
    output.appendChild(textarea);
    const copy = el("button", "btn btn-primary", "一键复制");
    copy.style.marginTop = "8px";
    copy.addEventListener("click", () => navigator.clipboard.writeText(textarea.value).then(() => { copy.textContent = "已复制，去粘贴给 AI"; }));
    output.appendChild(copy);
  });

  const reportCard = el("div", "card");
  reportCard.innerHTML = `<label class="field"><span class="q">保存 AI 的审计报告</span><textarea id="r-text" placeholder="把 AI 返回的报告粘贴到这里"></textarea></label><div class="toolbar"><button class="btn btn-ghost" id="r-save">存档报告</button></div>`;
  $main.appendChild(reportCard);
  reportCard.querySelector("#r-save").addEventListener("click", () => {
    const text = reportCard.querySelector("#r-text").value.trim();
    if (!text) return;
    const reports = load(K.reports, []);
    reports.unshift({ savedAt: todayStr(), text });
    save(K.reports, reports);
    showAudit();
    toast("报告已存档");
  });

  const reports = load(K.reports, []);
  if (reports.length) {
    const list = el("div", "card");
    list.appendChild(el("h3", "", "历史报告"));
    reports.forEach(report => {
      const item = el("div", "report-item answer-item");
      const preview = report.text.length > 180 ? `${report.text.slice(0, 180)}……` : report.text;
      item.innerHTML = `<div class="r-head">${report.savedAt} 的报告</div><div class="r-body">${esc(preview)}</div>`;
      if (report.text.length > 180) {
        const full = el("button", "btn btn-ghost btn-sm", "展开全文");
        full.style.marginTop = "8px";
        full.addEventListener("click", () => { item.querySelector(".r-body").textContent = report.text; full.remove(); });
        item.appendChild(full);
      }
      list.appendChild(item);
    });
    $main.appendChild(list);
  }
}

function buildAuditPrompt(from, to, context = {}) {
  const checkins = load(K.checkins, []).filter(item => item.date >= from && item.date <= to).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const events = load(K.events, []).filter(item => item.date >= from && item.date <= to);
  const active = load(K.experiments, []).find(item => item.status === "active");
  const byDate = {};
  checkins.forEach(item => (byDate[item.date] ||= []).push(item));
  const dataBlock = Object.entries(byDate).map(([date, items]) => {
    const lines = items.map(checkin => {
      const slot = SLOTS.find(item => item.id === checkin.slot)?.name || checkin.slot;
      const extra = getExtra(checkin);
      const extras = [
        extra.meaning && `意义感:${extra.meaning}/5`,
        extra.clarity && `清晰度:${extra.clarity}/5`,
        extra.taskLoad && `任务负荷:${extra.taskLoad}/5`,
        extra.tension?.length && `紧张部位:${extra.tension.join("、")}`,
        extra.body && `身体:${extra.body}`,
        extra.scene && `场景:${extra.scene}`,
        extra.who && `同伴:${extra.who}`,
        extra.task && `任务:${extra.task}`,
        extra.cycle && extra.cycle !== "不记录" && `经期:${extra.cycle}`,
        extra.note && `备注:${extra.note}`,
      ].filter(Boolean).join(";");
      return `  [${slot} ${checkin.time}] 能量${checkin.energy}/10(${energyBand(checkin.energy)}); 情绪:${(checkin.moods || []).join("、") || "未记录"}${checkin.sleepH ? `; 睡眠${checkin.sleepH}h,质量${checkin.sleepQ || "?"}/5` : ""}${checkin.drain ? `; 最消耗:${checkin.drain}` : ""}${checkin.restore ? `; 最恢复:${checkin.restore}` : ""}${extras ? `; ${extras}` : ""}`;
    }).join("\n");
    const dayEvents = events.filter(item => item.date === date).map(event => `  [事件 ${event.time}] ${event.kind}${event.delta > 0 ? "+" : ""}${event.delta}: ${event.what}${event.mood ? `; 情绪:${event.mood}` : ""}${event.scene ? `; 场景:${event.scene}` : ""}`).join("\n");
    return `=== ${date} ===\n${lines}${dayEvents ? `\n${dayEvents}` : ""}`;
  }).join("\n\n");

  return `你是一位严谨、务实的个人能量审计助手。请基于 ${from} 至 ${to} 的自我记录，按照“背景—精力—结构”框架完成周审计。\n\n【重要边界】\n- 这是生活自我观察，不是医学或心理诊断。\n- 样本很小，相关性不等于因果。\n- 不要建议主动压缩睡眠、用意志覆盖持续疲劳、或用生活技巧替代医疗与心理支持。\n- 如果出现持续严重疲惫、明显情绪困扰或功能受损，只提醒考虑专业帮助，不作诊断。\n- 每条判断标注：【已确认事实】【相关性线索】【合理推测】【暂时无法判断】。\n\n【背景：本周在做什么、为什么】\n${context.background || "用户未补充，请只从记录中谨慎推断，不能当作事实。"}\n\n【结构：时间、环境、承诺、人际关系】\n${context.structure || "用户未补充，请指出数据缺口，不要虚构。"}\n\n【逐日记录】\n${dataBlock || "无记录"}\n${active ? `\n【进行中的实验】变量:${active.variable}; 假设:${active.hypothesis}; 行动:${active.action}; 开始:${active.startDate}; 执行记录:${(active.adherence || []).map(log => `${log.date}:${log.status}`).join("、") || "暂无"}。请把实验本身视为潜在干扰因素。` : ""}\n\n【请按以下结构输出】\n1. 数据质量与记录完整度：哪些结论有基础，哪些没有\n2. 本周事实摘要：只陈述记录中确实出现的内容\n3. 背景审计：哪些事情有意义、哪些事情可能存在价值冲突；事实与推测分开\n4. 精力审计：时段、睡眠、意义感、清晰度、任务负荷、身体紧张、情绪、消耗与恢复\n5. 结构审计：时间安排、环境、承诺、人际关系中哪些因素可能支持或消耗精力\n6. 重复循环线索：按时间顺序找反复出现的链条，但禁止因果断言\n7. 竞争性解释：对最明显的模式至少给出三个其他解释\n8. 数据不足：还缺什么记录才能进一步判断\n9. 最大能量漏洞与最稳定恢复来源：各给证据强度和原始记录\n10. 下周最值得验证的一个问题\n11. 一个低风险、可逆、一次只改一个变量的七天实验：变量、假设、行动、执行时间、观察指标、每日执行记录、停止条件\n\n语气诚实、具体、不评判。不要输出空泛的鸡汤。`;
}

