/* UI-only enhancement layer. Does not read or transmit user data. */
(() => {
  const pages = {
    record: { kicker: "每日观察", title: "记录此刻的能量", description: "不用解释自己。用 30 秒留下一个真实切片。" },
    map: { kicker: "个人模式", title: "看见你的能量地图", description: "先观察重复出现的线索，再决定是否值得验证。" },
    exp: { kicker: "微型实验", title: "一次只改变一个变量", description: "把模糊的感觉，转化为可执行、可回看的七天实验。" },
    audit: { kicker: "每周回顾", title: "从记录中提取下一步", description: "区分事实、相关性和推测，不强行给自己下结论。" },
    toolbox: { kicker: "自我使用说明书", title: "留下真正对你有效的方法", description: "不收藏泛泛建议，只保留经过你亲自验证的恢复方式。" },
  };

  const buttons = [...document.querySelectorAll("nav button[id^='nav-']")];
  const kicker = document.getElementById("page-kicker");
  const title = document.getElementById("page-title");
  const description = document.getElementById("page-description");

  function updateHeading() {
    const active = buttons.find(button => button.classList.contains("active")) || buttons[0];
    if (!active) return;
    const key = active.id.replace("nav-", "");
    const page = pages[key] || pages.record;
    document.body.dataset.page = key;
    if (kicker) kicker.textContent = page.kicker;
    if (title) title.textContent = page.title;
    if (description) description.textContent = page.description;
    buttons.forEach(button => button.setAttribute("aria-current", button === active ? "page" : "false"));
  }

  const today = document.getElementById("today-label");
  if (today) {
    today.textContent = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(new Date());
  }

  buttons.forEach(button => button.addEventListener("click", () => requestAnimationFrame(updateHeading)));
  const observer = new MutationObserver(updateHeading);
  buttons.forEach(button => observer.observe(button, { attributes: true, attributeFilter: ["class"] }));
  updateHeading();
})();
