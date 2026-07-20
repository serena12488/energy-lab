/* ================= 能量地图 ================= */
let mapRange = 7;
function showMap() {
  setNav("map");
  $main.innerHTML = "";
  const days = recordedDays();
  if (days.length < 3) {
    $main.appendChild(el("div", "empty", `已记录 <b>${days.length}</b> 天。满 3 天解锁初步观察，满 7 天后才适合寻找重复模式。`));
    return;
  }

  const toggle = el("div", "range-toggle");
  [7, 30].forEach(number => {
    const button = el("button", `chip${mapRange === number ? " on" : ""}`, `近 ${number} 天`);
    button.addEventListener("click", () => { mapRange = number; showMap(); });
    toggle.appendChild(button);
  });
  $main.appendChild(toggle);

  const averageMap = dayAvgMap();
  const range = [];
  for (let index = mapRange - 1; index >= 0; index--) range.push(addDays(todayStr(), -index));
  const inRange = date => range.includes(date);
  const checkins = load(K.checkins, []).filter(item => inRange(item.date));

  const chartCard = el("div", "card");
  chartCard.appendChild(el("h3", "", `能量曲线（近 ${mapRange} 天）`));
  chartCard.appendChild(buildCurve(range, averageMap));
  $main.appendChild(chartCard);

  const grid = el("div", "tile-grid");
  $main.appendChild(grid);

  const bySlot = {};
  checkins.forEach(item => (bySlot[item.slot] ||= []).push(Number(item.energy)));
  const slotStats = SLOTS.map(slot => ({ name: slot.name, values: bySlot[slot.id] || [] })).filter(item => item.values.length >= 3);
  const bestSlot = slotStats.length >= 2 ? slotStats.reduce((best, current) => avg(best.values) > avg(current.values) ? best : current) : null;
  grid.appendChild(el("div", "tile", `<div class="t-label">高能量时段</div><div class="t-value">${bestSlot ? bestSlot.name : "数据不足"}</div><div class="t-note">${bestSlot ? slotStats.map(item => `${item.name} ${r1(avg(item.values))}`).join(" · ") : "至少两个时段各记录 3 次"}</div>`));

  const sleepPairs = range.map(date => ({ date, sleep: sleepOf(date), energy: averageMap[date] })).filter(item => item.sleep != null && item.energy != null);
  const sleepMid = median(sleepPairs.map(item => item.sleep));
  const lowerSleep = sleepPairs.filter(item => item.sleep < sleepMid).map(item => item.energy);
  const higherSleep = sleepPairs.filter(item => item.sleep >= sleepMid).map(item => item.energy);
  let sleepValue = "数据不足";
  let sleepNote = "至少需要 6 天同时记录睡眠与能量";
  if (lowerSleep.length >= 3 && higherSleep.length >= 3) {
    const diff = r1(avg(higherSleep) - avg(lowerSleep));
    sleepValue = diff > 0 ? `较充足日高 ${diff} 分` : diff < 0 ? `较充足日低 ${Math.abs(diff)} 分` : "暂未见差异";
    sleepNote = `按你的睡眠中位数 ${r1(sleepMid)}h 分组；相关性线索`;
  }
  grid.appendChild(el("div", "tile", `<div class="t-label">睡眠与能量</div><div class="t-value">${sleepValue}</div><div class="t-note">${sleepNote}</div>`));

  const highMeaning = checkins.filter(item => Number(getExtra(item).meaning) >= 4).map(item => Number(item.energy));
  const lowMeaning = checkins.filter(item => Number(getExtra(item).meaning) <= 2 && Number(getExtra(item).meaning) > 0).map(item => Number(item.energy));
  let meaningValue = "数据不足";
  let meaningNote = "高、低意义感记录各满 3 次后比较";
  if (highMeaning.length >= 3 && lowMeaning.length >= 3) {
    const diff = r1(avg(highMeaning) - avg(lowMeaning));
    meaningValue = diff > 0 ? `高意义感时高 ${diff} 分` : diff < 0 ? `高意义感时低 ${Math.abs(diff)} 分` : "能量相近";
    meaningNote = `${highMeaning.length} 次高意义感 vs ${lowMeaning.length} 次低意义感`;
  }
  grid.appendChild(el("div", "tile", `<div class="t-label">意义感与能量</div><div class="t-value">${meaningValue}</div><div class="t-note">${meaningNote}</div>`));

  const tensionCounts = {};
  checkins.forEach(item => (getExtra(item).tension || []).forEach(area => {
    if (area !== "无明显紧张") tensionCounts[area] = (tensionCounts[area] || 0) + 1;
  }));
  const topTension = Object.entries(tensionCounts).sort((a, b) => b[1] - a[1])[0];
  grid.appendChild(el("div", "tile", `<div class="t-label">高频身体信号</div><div class="t-value">${topTension ? esc(topTension[0]) : "尚未形成"}</div><div class="t-note">${topTension ? `出现 ${topTension[1]} 次，仅代表自我报告` : "在更多观察中选择紧张部位"}</div>`));

  const weekdays = [], weekends = [];
  range.forEach(date => {
    if (averageMap[date] == null) return;
    const day = new Date(`${date}T12:00:00`).getDay();
    (day === 0 || day === 6 ? weekends : weekdays).push(averageMap[date]);
  });
  grid.appendChild(el("div", "tile", `<div class="t-label">工作日 vs 周末</div><div class="t-value">${weekdays.length >= 3 && weekends.length >= 2 ? `${r1(avg(weekdays))} vs ${r1(avg(weekends))}` : "数据不足"}</div><div class="t-note">${weekdays.length >= 3 && weekends.length >= 2 ? "平均能量（工作日 vs 周末）" : "需要更多跨周记录"}</div>`));

  const rangeDays = range.filter(date => averageMap[date] != null).length;
  const rangeEnergy = range.filter(date => averageMap[date] != null).map(date => averageMap[date]);
  grid.appendChild(el("div", "tile", `<div class="t-label">记录完整度</div><div class="t-value">${rangeDays}/${mapRange} 天</div><div class="t-note">平均能量 ${r1(avg(rangeEnergy)) ?? "—"}/10</div>`));

  const sequenceHits = [];
  range.slice(1).forEach(date => {
    const previous = addDays(date, -1);
    const prevEvening = checkins.find(item => item.date === previous && item.slot === "evening");
    const morning = checkins.find(item => item.date === date && item.slot === "morning");
    if (!prevEvening || !morning) return;
    if ((Number(prevEvening.energy) <= 4 || prevEvening.drain) && Number(morning.energy) <= 4) {
      sequenceHits.push({ previous, date, drain: prevEvening.drain });
    }
  });
  const loopHtml = sequenceHits.length >= 2
    ? `<div class="t-value">前晚消耗/低能量 → 次晨低能量</div><div class="t-note">近 ${mapRange} 天出现 ${sequenceHits.length} 次。低置信度时间序列线索，不代表因果。</div>`
    : `<div class="t-value">尚未发现重复序列</div><div class="t-note">需要更多连续的早晚记录</div>`;
  grid.appendChild(el("div", "tile wide insight-tile", `<div class="t-label">重复循环线索</div>${loopHtml}`));

  function freqList(kind) {
    const counts = {};
    checkins.forEach(item => {
      const text = (kind === "drain" ? item.drain : item.restore || "").trim();
      if (text) counts[text] = (counts[text] || 0) + 1;
    });
    load(K.events, []).filter(item => inRange(item.date) && item.kind === (kind === "drain" ? "消耗" : "恢复")).forEach(item => {
      const text = item.what.trim();
      if (text) counts[text] = (counts[text] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }
  const drains = freqList("drain");
  const restores = freqList("restore");
  grid.appendChild(el("div", "tile wide", `<div class="t-label">高频消耗情境</div>${drains.length ? `<ul class="rank-list">${drains.map(([text, count]) => `<li><span>${esc(text)}</span><span class="cnt">${count} 次</span></li>`).join("")}</ul>` : `<div class="t-note">暂无记录</div>`}`));
  grid.appendChild(el("div", "tile wide", `<div class="t-label">高频恢复活动</div>${restores.length ? `<ul class="rank-list">${restores.map(([text, count]) => `<li><span>${esc(text)}</span><span class="cnt">${count} 次</span></li>`).join("")}</ul>` : `<div class="t-note">暂无记录</div>`}`));
  $main.appendChild(el("p", "map-note", "地图只展示你自己的记录中出现的相关模式。任何结论都需要更多数据或七天实验进一步验证。"));
}

function buildCurve(range, averageMap) {
  const W = 720, H = 245, L = 34, R = 16, T = 16, B = 30;
  const innerWidth = W - L - R, innerHeight = H - T - B;
  const x = index => L + (range.length === 1 ? innerWidth / 2 : index * innerWidth / (range.length - 1));
  const y = value => T + innerHeight - (value - 1) / 9 * innerHeight;
  let grid = "", labels = "", paths = "", dots = "", hits = "";
  [2, 4, 6, 8, 10].forEach(value => {
    grid += `<line x1="${L}" y1="${y(value)}" x2="${W - R}" y2="${y(value)}" stroke="var(--line)" stroke-width="1"/>`;
    labels += `<text x="${L - 7}" y="${y(value) + 4}" text-anchor="end" font-size="10" fill="var(--ink-soft)">${value}</text>`;
  });
  const step = range.length > 10 ? Math.ceil(range.length / 7) : 1;
  range.forEach((date, index) => {
    if (index % step === 0 || index === range.length - 1) labels += `<text x="${x(index)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="var(--ink-soft)">${date.slice(5)}</text>`;
  });
  let segment = [];
  const flush = () => {
    if (segment.length > 1) paths += `<path d="M${segment.map(point => `${point[0]},${point[1]}`).join(" L")}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
    segment = [];
  };
  range.forEach((date, index) => {
    const value = averageMap[date];
    if (value == null) return flush();
    const px = x(index), py = y(value);
    segment.push([px, py]);
    dots += `<circle cx="${px}" cy="${py}" r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`;
    hits += `<circle cx="${px}" cy="${py}" r="14" fill="transparent" data-tip="${date.slice(5)} · 能量 ${r1(value)}" data-px="${px}" data-py="${py}"/>`;
  });
  flush();
  const wrap = el("div", "chart-wrap");
  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="每日平均能量曲线">${grid}${labels}${paths}${dots}${hits}</svg><div class="chart-tip"></div>`;
  const tip = wrap.querySelector(".chart-tip");
  wrap.querySelectorAll("circle[data-tip]").forEach(circle => {
    const show = () => {
      const scale = wrap.querySelector("svg").getBoundingClientRect().width / W;
      tip.textContent = circle.dataset.tip;
      tip.style.left = `${Number(circle.dataset.px) * scale}px`;
      tip.style.top = `${Number(circle.dataset.py) * scale}px`;
      tip.style.display = "block";
    };
    circle.addEventListener("mouseenter", show);
    circle.addEventListener("touchstart", show, { passive: true });
    circle.addEventListener("mouseleave", () => { tip.style.display = "none"; });
  });
  return wrap;
}

