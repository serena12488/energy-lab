/* ================= 恢复工具箱 ================= */
let toolboxFilter = "全部";
function showToolbox() {
  setNav("toolbox");
  $main.innerHTML = "";
  const tools = load(K.toolbox, []).map(tool => ({ category: "其他", lastUsed: "", ...tool }));
  const intro = el("div", "card");
  intro.innerHTML = `<p class="audit-note" style="margin:0">这里不是通用建议收藏夹，而是你亲自验证过的“自我使用说明书”。先按当下需要筛选，再选择最小可行动的方法。</p>`;
  $main.appendChild(intro);

  const recommend = el("div", "card");
  recommend.innerHTML = `<h3>我现在需要什么？</h3><div class="category-filter" id="tool-filter">${["全部", ...TOOL_CATEGORIES].map(category => `<button type="button" class="chip ${toolboxFilter === category ? "on" : ""}" data-category="${esc(category)}">${esc(category)}</button>`).join("")}</div>`;
  $main.appendChild(recommend);
  recommend.querySelectorAll("[data-category]").forEach(button => button.addEventListener("click", () => { toolboxFilter = button.dataset.category; showToolbox(); }));

  const addCard = el("div", "card");
  addCard.innerHTML = `
    <h3>添加一个已验证的方法</h3>
    <label class="field"><span class="q">方法</span><input type="text" id="t-name" placeholder="例：下班后先散步15分钟再回家"></label>
    <div class="form-grid"><label class="field"><span class="q">作用类别</span><select id="t-category">${selectOptions(TOOL_CATEGORIES)}</select></label><label class="field"><span class="q">适用场景</span><select id="t-scene">${selectOptions(TOOL_SCENES)}</select></label></div>
    <label class="field"><span class="q">有效证据或使用说明（选填）</span><input type="text" id="t-note" placeholder="例：社交后使用4次，其中3次状态明显缓和"></label>
    <div class="toolbar"><button class="btn btn-primary btn-sm" id="t-add">存入工具箱</button></div>`;
  $main.appendChild(addCard);
  addCard.querySelector("#t-add").addEventListener("click", () => {
    const name = addCard.querySelector("#t-name").value.trim();
    if (!name) return alert("请先填写方法");
    tools.push({ id: uid(), name, category: addCard.querySelector("#t-category").value, scene: addCard.querySelector("#t-scene").value, uses: 0, rating: "", note: addCard.querySelector("#t-note").value.trim(), lastUsed: "" });
    save(K.toolbox, tools);
    showToolbox();
    toast("方法已存入工具箱");
  });

  const visible = toolboxFilter === "全部" ? tools : tools.filter(tool => tool.category === toolboxFilter);
  if (!tools.length) {
    $main.appendChild(el("div", "empty", "工具箱还是空的。完成一个七天实验后，把真正有效的方法留下来。"));
    return;
  }
  if (!visible.length) {
    $main.appendChild(el("div", "empty", `“${esc(toolboxFilter)}”类别还没有方法。`));
    return;
  }

  visible.sort((a, b) => (b.uses || 0) - (a.uses || 0)).forEach(tool => {
    const card = el("div", "card tool-card");
    card.innerHTML = `
      <div class="t-head"><div><span class="t-name">${esc(tool.name)}</span><div class="tool-tags"><span class="tag">${esc(tool.category)}</span><span class="tag tag-muted">${esc(tool.scene)}</span></div></div><span class="use-count">${tool.uses || 0} 次</span></div>
      <div class="t-stats">${tool.rating ? `我的评价：${esc(tool.rating)}` : "尚未评价"}${tool.lastUsed ? ` · 最近使用 ${tool.lastUsed}` : ""}${tool.note ? `<br>${esc(tool.note)}` : ""}</div>
      <div class="toolbar"><button class="btn btn-primary btn-sm" data-act="use">今天用了 +1</button><select data-act="rate" class="inline-select"><option value="">评价…</option><option ${tool.rating === "有效" ? "selected" : ""}>有效</option><option ${tool.rating === "一般" ? "selected" : ""}>一般</option><option ${tool.rating === "无效" ? "selected" : ""}>无效</option></select><button class="btn btn-ghost btn-sm" data-act="del">删除</button></div>`;
    card.querySelector('[data-act="use"]').addEventListener("click", () => {
      tool.uses = Number(tool.uses || 0) + 1;
      tool.lastUsed = todayStr();
      save(K.toolbox, tools);
      showToolbox();
      toast("已记录本次使用");
    });
    card.querySelector('[data-act="rate"]').addEventListener("change", event => {
      tool.rating = event.target.value;
      save(K.toolbox, tools);
      showToolbox();
    });
    card.querySelector('[data-act="del"]').addEventListener("click", () => {
      if (!confirm(`删除“${tool.name}”？`)) return;
      save(K.toolbox, tools.filter(item => item.id !== tool.id));
      showToolbox();
    });
    $main.appendChild(card);
  });
}

