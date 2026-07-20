/* UI-only enhancement layer. Does not read or transmit user data. */
(() => {
  const pages = {
    record: { kicker: "每日观察", title: "记录此刻的能量", description: "留下能量、意义感与身体状态的真实切片；更多观察始终选填。" },
    map: { kicker: "个人模式", title: "看见你的能量地图", description: "比较时段、睡眠、意义感和身体信号，并标明数据是否足够。" },
    exp: { kicker: "微型实验", title: "一次只改变一个变量", description: "记录每天是否真正执行，再比较基线、执行日与未执行日。" },
    audit: { kicker: "每周回顾", title: "从背景、精力与结构中找线索", description: "区分事实、相关性和推测，把模糊疲惫转化为一个可验证问题。" },
    toolbox: { kicker: "自我使用说明书", title: "留下真正对你有效的方法", description: "按当前需要筛选，只保留经过你亲自验证的恢复方式。" },
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
