/*
 * 能量实验室 · 内容结构增强版
 * Local-first: 所有数据仅保存在当前浏览器 localStorage。
 * 目标闭环：记录真实切片 → 发现模式线索 → 七天微型实验 → 周审计 → 个人工具箱。
 */

const K = {
  checkins: "el.checkins",
  events: "el.events",
  experiments: "el.experiments",
  toolbox: "el.toolbox",
  reports: "el.reports",
  migrated: "el.migrated",
};

const MOODS = ["平静", "开心", "充实", "焦虑", "烦躁", "低落", "疲惫", "麻木", "兴奋"];
const SLOTS = [
  { id: "morning", name: "早晨", sub: "起床能量" },
  { id: "afternoon", name: "下午", sub: "工作中能量" },
  { id: "evening", name: "晚上", sub: "整体回顾" },
];
const CYCLE = ["不记录", "月经期", "卵泡期", "排卵期", "黄体期", "说不清"];
const TENSION_AREAS = ["无明显紧张", "眼睛", "下颌", "颈肩", "胸口", "胃部", "腰背", "其他"];
const TOOL_CATEGORIES = ["生理降速", "身体恢复", "认知清空", "任务结构", "情绪恢复", "睡前降速", "其他"];
const TOOL_SCENES = ["5分钟以内", "10分钟快速恢复", "工作中", "下班后", "社交后", "低能量时", "睡前", "高压力日", "其他"];
const EXP_SUGGESTS = [
  "提前30分钟进入睡前降速",
  "下班后先散步15分钟",
  "上午关闭消息通知60分钟",
  "睡前30分钟不看短视频",
  "把高认知任务放到高能量时段",
  "增加一次不被打扰的独处恢复",
];

const $main = document.getElementById("main");
const tabs = {
  record: document.getElementById("nav-record"),
  map: document.getElementById("nav-map"),
  exp: document.getElementById("nav-exp"),
  audit: document.getElementById("nav-audit"),
  toolbox: document.getElementById("nav-toolbox"),
};

/* ---------- 基础工具 ---------- */
const load = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const esc = value => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

function dstr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const todayStr = () => dstr(new Date());
const nowTime = () => {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};
function addDays(dateStr, number) {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + number);
  return dstr(date);
}
function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}
function setNav(name) {
  Object.entries(tabs).forEach(([key, button]) => button?.classList.toggle("active", key === name));
}
function toast(message) {
  const node = el("div", "saved-toast", message);
  $main.prepend(node);
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => node.remove(), 2400);
}
const avg = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const r1 = value => value == null ? null : Math.round(value * 10) / 10;
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function selectOptions(items, selected = "") {
  return items.map(item => `<option ${item === selected ? "selected" : ""}>${esc(item)}</option>`).join("");
}
function scoreLabel(value, labels) {
  return labels[Math.max(1, Math.min(5, Number(value) || 3)) - 1];
}
function energyBand(value) {
  const n = Number(value);
  if (n <= 2) return "几乎耗尽";
  if (n <= 4) return "勉强维持";
  if (n <= 6) return "可以应对";
  if (n <= 8) return "稳定有余力";
  return "非常充沛";
}
function getExtra(checkin) {
  return checkin?.extra && typeof checkin.extra === "object" ? checkin.extra : {};
}

/* ---------- 旧版兼容 ---------- */
(function migrate() {
  if (localStorage.getItem(K.migrated)) return;
  const old = load("ea.entries", null);
  if (old) {
    const checkins = load(K.checkins, []);
    Object.entries(old).forEach(([date, entry]) => {
      checkins.push({
        id: uid(), date, time: "21:00", slot: "evening",
        energy: entry.energy, moods: (entry.moods || []).slice(0, 2),
        sleepH: entry.sleepH || "", sleepQ: entry.sleepQ || 0,
        drain: entry.drain || "", restore: entry.restore || "",
        extra: {
          body: entry.body || "",
          note: [entry.did, entry.avoid && `逃避了:${entry.avoid}`, entry.best && `最满意:${entry.best}`].filter(Boolean).join(";"),
        },
      });
    });
    save(K.checkins, checkins);
    const oldReports = load("ea.reports", []);
    if (oldReports.length) save(K.reports, [...load(K.reports, []), ...oldReports]);
  }
  localStorage.setItem(K.migrated, "1");
})();

/* ---------- 数据统计 ---------- */
function dayAvgMap() {
  const grouped = {};
  load(K.checkins, []).forEach(checkin => {
    (grouped[checkin.date] ||= []).push(Number(checkin.energy));
  });
  return Object.fromEntries(Object.entries(grouped).map(([date, values]) => [date, avg(values)]));
}
const recordedDays = () => Object.keys(dayAvgMap()).sort();
function sleepOf(date) {
  const checkin = load(K.checkins, []).find(item => item.date === date && item.sleepH !== "" && item.sleepH != null);
  return checkin ? Number(checkin.sleepH) : null;
}
function dailyCheckins(date) {
  return load(K.checkins, []).filter(item => item.date === date);
}
function scoreButtons(id, value, labels) {
  return `<div class="score-picker" id="${id}" data-value="${value || 3}">
    ${[1, 2, 3, 4, 5].map(number => `<button type="button" class="score-btn ${Number(value || 3) === number ? "on" : ""}" data-score="${number}"><b>${number}</b><small>${esc(labels[number - 1])}</small></button>`).join("")}
  </div>`;
}
function bindScorePicker(root, id) {
  const picker = root.querySelector(`#${id}`);
  if (!picker) return;
  picker.querySelectorAll(".score-btn").forEach(button => {
    button.addEventListener("click", () => {
      picker.dataset.value = button.dataset.score;
      picker.querySelectorAll(".score-btn").forEach(item => item.classList.toggle("on", item === button));
    });
  });
}

