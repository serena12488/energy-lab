/* ================= 记录 ================= */
function showRecord() {
  setNav("record");
  $main.innerHTML = "";

  const days = recordedDays().length;
  const doneExps = load(K.experiments, []).filter(item => item.status === "done").length;
  const tools = load(K.toolbox, []).length;
  $main.appendChild(el("div", "stats-strip",
    `<span>已记录 <b>${days}</b> 天</span><span>完成 <b>${doneExps}</b> 个实验</span><span>验证 <b>${tools}</b> 个方法</span>`));

  const evBtn = el("button", "event-cta", "刚刚发生了一次明显消耗或恢复？记一笔能量事件");
  $main.appendChild(evBtn);
  const evCard = el("div", "card event-card");
  evCard.hidden = true;
  evCard.innerHTML = `
    <h3>记录一次能量变化</h3>
    <div class="field"><span class="q">这是一次</span>
      <div class="chips" id="ev-kind"><button type="button" class="chip on">明显消耗</button><button type="button" class="chip">明显恢复</button></div></div>
    <label class="field"><span class="q">发生了什么</span><input type="text" id="ev-what" placeholder="例：临时被拉进一个会 / 出门晒了十分钟太阳"></label>
    <label class="field"><span class="q">能量变化了几分</span><select id="ev-delta"></select></label>
    <label class="field"><span class="q">当时的情绪（选填）</span><input type="text" id="ev-mood" placeholder="烦躁、放松、安心……"></label>
    <label class="field"><span class="q">当时的场景（选填）</span><input type="text" id="ev-scene" placeholder="办公室、家里、通勤路上……"></label>
    <div class="toolbar"><button class="btn btn-primary btn-sm" id="ev-save">保存事件</button></div>`;
  $main.appendChild(evCard);

  evBtn.addEventListener("click", () => { evCard.hidden = !evCard.hidden; });
  const kindButtons = [...evCard.querySelectorAll("#ev-kind .chip")];
  const delta = evCard.querySelector("#ev-delta");
  function setEventKind(isDrain) {
    kindButtons[0].classList.toggle("on", isDrain);
    kindButtons[1].classList.toggle("on", !isDrain);
    const numbers = isDrain ? [-1, -2, -3, -4, -5] : [1, 2, 3, 4, 5];
    delta.innerHTML = numbers.map(value => `<option value="${value}" ${Math.abs(value) === 2 ? "selected" : ""}>${value > 0 ? "+" : ""}${value}</option>`).join("");
  }
  setEventKind(true);
  kindButtons[0].addEventListener("click", () => setEventKind(true));
  kindButtons[1].addEventListener("click", () => setEventKind(false));
  evCard.querySelector("#ev-save").addEventListener("click", () => {
    const what = evCard.querySelector("#ev-what").value.trim();
    if (!what) return alert("先写一句发生了什么");
    const events = load(K.events, []);
    events.push({
      id: uid(), date: todayStr(), time: nowTime(),
      kind: kindButtons[0].classList.contains("on") ? "消耗" : "恢复",
      what, delta: Number(delta.value),
      mood: evCard.querySelector("#ev-mood").value.trim(),
      scene: evCard.querySelector("#ev-scene").value.trim(),
    });
    save(K.events, events);
    showRecord();
    toast("事件已记录");
  });

  const hour = new Date().getHours();
  let slot = hour < 11 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const card = el("div", "card checkin-card");
  const existing = () => load(K.checkins, []).find(item => item.date === todayStr() && item.slot === slot);

  function renderForm() {
    const old = existing() || {};
    const extra = getExtra(old);
    const meaning = Number(extra.meaning || 3);
    const clarity = Number(extra.clarity || 3);
    const taskLoad = Number(extra.taskLoad || 3);
    const tensionSet = new Set(Array.isArray(extra.tension) ? extra.tension : []);

    card.innerHTML = `
      <div class="slot-btns">
        ${SLOTS.map(item => `<button type="button" class="slot-btn ${item.id === slot ? "on" : ""}" data-slot="${item.id}">${item.name}<small>${item.sub}</small></button>`).join("")}
      </div>

      <label class="field energy-field"><span class="q">当前能量 <span class="tip">不是表现评分，只记录此刻可用的身心资源</span></span>
        <div class="energy-row"><input type="range" id="f-energy" min="1" max="10" value="${old.energy ?? 5}"><span class="energy-val" id="f-energy-val">${old.energy ?? 5}</span></div>
        <div class="energy-band"><span>1–2 耗尽</span><span>3–4 勉强</span><span>5–6 应对</span><span>7–8 有余力</span><span>9–10 充沛</span></div>
        <p class="energy-caption" id="f-energy-caption">${energyBand(old.energy ?? 5)}</p>
      </label>

      <div class="field"><span class="q">当前情绪 <span class="tip">最多选 2 项</span></span><div class="chips" id="f-moods"></div></div>

      ${slot === "morning" ? `<label class="field"><span class="q">昨晚睡眠</span><div class="sleep-row"><input type="number" id="f-sleep" min="0" max="16" step="0.5" placeholder="小时" value="${old.sleepH ?? ""}"><span class="tip">小时</span><div class="stars" id="f-sleepq" aria-label="睡眠质量"></div></div></label>` : ""}

      <label class="field"><span class="q">到现在为止，最消耗你的事</span><input type="text" id="f-drain" placeholder="没有就空着" value="${esc(old.drain)}"></label>
      <label class="field"><span class="q">最恢复你的事</span><input type="text" id="f-restore" placeholder="没有就空着" value="${esc(old.restore)}"></label>

      <div class="field"><span class="q">你正在做的事情，对你有多重要？ <span class="tip">帮助区分“累但值得”和“被迫消耗”</span></span>
        ${scoreButtons("f-meaning", meaning, ["无意义", "较低", "一般", "重要", "非常重要"])}
      </div>

      <button type="button" class="accordion-toggle" id="f-more">展开更多观察（选填）</button>
      <div class="accordion" id="f-acc">
        <div class="field"><span class="q">思维清晰度</span>${scoreButtons("f-clarity", clarity, ["混乱", "较模糊", "一般", "清晰", "非常清晰"])}</div>
        <div class="field"><span class="q">当前任务负荷</span>${scoreButtons("f-load", taskLoad, ["很轻", "较轻", "适中", "较重", "过载"])}</div>
        <div class="field"><span class="q">身体哪里最紧张？</span><div class="chips" id="x-tension">${TENSION_AREAS.map(area => `<button type="button" class="chip ${tensionSet.has(area) ? "on" : ""}" data-tension="${esc(area)}">${esc(area)}</button>`).join("")}</div></div>
        <label class="field"><span class="q">身体感受</span><input type="text" id="x-body" placeholder="例：眼睛酸、肩膀紧、胃里发沉" value="${esc(extra.body)}"></label>
        <label class="field"><span class="q">当前场景</span><input type="text" id="x-scene" placeholder="家里、学校、咖啡馆……" value="${esc(extra.scene)}"></label>
        <label class="field"><span class="q">和谁在一起</span><input type="text" id="x-who" value="${esc(extra.who)}"></label>
        <label class="field"><span class="q">正在做什么任务</span><input type="text" id="x-task" value="${esc(extra.task)}"></label>
        <label class="field"><span class="q">经期阶段</span><select id="x-cycle">${selectOptions(CYCLE, extra.cycle || "不记录")}</select></label>
        <label class="field"><span class="q">自由记录</span><textarea id="x-note">${esc(extra.note)}</textarea></label>
      </div>
      <div class="toolbar"><button class="btn btn-primary" id="f-save">${existing() ? "更新这条记录" : "保存本次记录"}</button><span class="privacy-inline">只写入此浏览器</span></div>`;

    card.querySelectorAll(".slot-btn").forEach(button => button.addEventListener("click", () => {
      slot = button.dataset.slot;
      renderForm();
    }));

    const moodSet = new Set((old.moods || []).slice(0, 2));
    const moodBox = card.querySelector("#f-moods");
    MOODS.forEach(mood => {
      const button = el("button", `chip${moodSet.has(mood) ? " on" : ""}`, mood);
      button.type = "button";
      button.addEventListener("click", () => {
        if (moodSet.has(mood)) {
          moodSet.delete(mood);
          button.classList.remove("on");
        } else if (moodSet.size < 2) {
          moodSet.add(mood);
          button.classList.add("on");
        }
      });
      moodBox.appendChild(button);
    });

    let sleepQ = Number(old.sleepQ || 0);
    const stars = card.querySelector("#f-sleepq");
    if (stars) {
      const renderStars = () => {
        stars.innerHTML = "";
        for (let index = 1; index <= 5; index++) {
          const star = el("span", index <= sleepQ ? "on" : "", "★");
          star.addEventListener("click", () => { sleepQ = index; renderStars(); });
          stars.appendChild(star);
        }
      };
      renderStars();
    }

    bindScorePicker(card, "f-meaning");
    bindScorePicker(card, "f-clarity");
    bindScorePicker(card, "f-load");

    const energy = card.querySelector("#f-energy");
    energy.addEventListener("input", () => {
      card.querySelector("#f-energy-val").textContent = energy.value;
      card.querySelector("#f-energy-caption").textContent = energyBand(energy.value);
    });
    card.querySelector("#f-more").addEventListener("click", () => card.querySelector("#f-acc").classList.toggle("open"));

    const liveTension = new Set(tensionSet);
    card.querySelectorAll("[data-tension]").forEach(button => {
      button.addEventListener("click", () => {
        const area = button.dataset.tension;
        if (area === "无明显紧张") {
          liveTension.clear();
          liveTension.add(area);
          card.querySelectorAll("[data-tension]").forEach(item => item.classList.toggle("on", item === button));
          return;
        }
        liveTension.delete("无明显紧张");
        card.querySelector('[data-tension="无明显紧张"]')?.classList.remove("on");
        if (liveTension.has(area)) {
          liveTension.delete(area);
          button.classList.remove("on");
        } else {
          liveTension.add(area);
          button.classList.add("on");
        }
      });
    });

    card.querySelector("#f-save").addEventListener("click", () => {
      const checkins = load(K.checkins, []).filter(item => !(item.date === todayStr() && item.slot === slot));
      checkins.push({
        id: old.id || uid(), date: todayStr(), time: nowTime(), slot,
        energy: Number(energy.value), moods: [...moodSet],
        sleepH: card.querySelector("#f-sleep")?.value ?? "", sleepQ: stars ? sleepQ : 0,
        drain: card.querySelector("#f-drain").value.trim(),
        restore: card.querySelector("#f-restore").value.trim(),
        extra: {
          ...extra,
          meaning: Number(card.querySelector("#f-meaning").dataset.value),
          clarity: Number(card.querySelector("#f-clarity").dataset.value),
          taskLoad: Number(card.querySelector("#f-load").dataset.value),
          tension: [...liveTension],
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
      toast(`已保存${SLOTS.find(item => item.id === slot)?.name || "本次"}记录`);
    });
  }

  renderForm();
  $main.appendChild(card);

  const todayCheckins = dailyCheckins(todayStr());
  const todayEvents = load(K.events, []).filter(item => item.date === todayStr());
  if (todayCheckins.length || todayEvents.length) {
    const list = el("div", "card");
    list.appendChild(el("h3", "", "今天的切片"));
    todayCheckins.sort((a, b) => a.time.localeCompare(b.time)).forEach(checkin => {
      const extra = getExtra(checkin);
      list.appendChild(el("div", "mini-rec",
        `<b>${SLOTS.find(item => item.id === checkin.slot)?.name || checkin.slot}</b> ${checkin.time} · 能量 ${checkin.energy}/10（${energyBand(checkin.energy)}） · ${(checkin.moods || []).join("/") || "未选情绪"}${extra.meaning ? ` · 意义感 ${extra.meaning}/5` : ""}${checkin.drain ? ` · 消耗：${esc(checkin.drain)}` : ""}${checkin.restore ? ` · 恢复：${esc(checkin.restore)}` : ""}`));
    });
    todayEvents.forEach(event => list.appendChild(el("div", "mini-rec",
      `<span class="ev">能量事件</span> ${event.time} · ${event.kind} ${event.delta > 0 ? "+" : ""}${event.delta} · ${esc(event.what)}`)));
    $main.appendChild(list);
  }

  const backup = el("div", "card backup-card");
  backup.innerHTML = `<div><h3>本地数据备份</h3><p class="audit-note">换设备、换浏览器或清理缓存前，请先导出。备份文件仍只由你自己保管。</p></div><div class="toolbar"><button class="btn btn-ghost btn-sm" id="bk-out">导出 JSON</button><button class="btn btn-ghost btn-sm" id="bk-in">导入备份</button></div>`;
  $main.appendChild(backup);
  backup.querySelector("#bk-out").addEventListener("click", () => {
    const data = {};
    Object.values(K).forEach(key => { data[key] = load(key, null); });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `能量实验室备份-${todayStr()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
  backup.querySelector("#bk-in").addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.addEventListener("change", () => {
      input.files?.[0]?.text().then(text => {
        try {
          const data = JSON.parse(text);
          if (!Array.isArray(data[K.checkins])) throw new Error("invalid");
          Object.values(K).forEach(key => { if (data[key] != null) save(key, data[key]); });
          showRecord();
          toast("备份已导入");
        } catch {
          alert("文件格式不正确，请选择能量实验室导出的备份文件");
        }
      });
    });
    input.click();
  });
}

