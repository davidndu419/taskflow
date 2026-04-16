
import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ============================================================
// MODEL LAYER — OOP Task, Reminder, Category classes
// ============================================================
class Task {
  constructor({ id, title, description = "", priority = "medium", deadline = null, category = "General", status = "pending", createdAt = new Date().toISOString(), completedAt = null, recurring = false, recurringInterval = null, tags = [] }) {
    this.id = id || crypto.randomUUID();
    this.title = title;
    this.description = description;
    this.priority = priority; // critical | high | medium | low
    this.deadline = deadline;
    this.category = category;
    this.status = status; // pending | in-progress | completed | overdue
    this.createdAt = createdAt;
    this.completedAt = completedAt;
    this.recurring = recurring;
    this.recurringInterval = recurringInterval; // minutes
    this.tags = tags;
  }
  isOverdue() {
    if (!this.deadline || this.status === "completed") return false;
    return new Date(this.deadline) < new Date();
  }
  getUrgencyScore() {
    if (!this.deadline) return 0;
    const now = new Date();
    const dl = new Date(this.deadline);
    const hoursLeft = (dl - now) / 36e5;
    const priorityWeight = { critical: 100, high: 70, medium: 40, low: 10 }[this.priority] || 40;
    if (hoursLeft < 0) return priorityWeight + 200;
    if (hoursLeft < 1) return priorityWeight + 150;
    if (hoursLeft < 24) return priorityWeight + 80;
    if (hoursLeft < 72) return priorityWeight + 40;
    return priorityWeight;
  }
  toJSON() {
    return { ...this };
  }
}

class Reminder {
  constructor({ taskId, taskTitle, type, triggerAt, triggered = false }) {
    this.id = crypto.randomUUID();
    this.taskId = taskId;
    this.taskTitle = taskTitle;
    this.type = type; // "pre-10min" | "pre-1hr" | "deadline" | "overdue"
    this.triggerAt = triggerAt;
    this.triggered = triggered;
  }
}

// ============================================================
// PERSISTENCE — localStorage-backed DB
// ============================================================
const DB = {
  save(tasks) { try { localStorage.setItem("taskflow_tasks", JSON.stringify(tasks)); } catch {} },
  load() {
    try {
      const raw = localStorage.getItem("taskflow_tasks");
      if (!raw) return [];
      return JSON.parse(raw).map(t => new Task(t));
    } catch { return []; }
  },
  saveReminders(reminders) { try { localStorage.setItem("taskflow_reminders", JSON.stringify(reminders)); } catch {} },
  loadReminders() {
    try {
      const raw = localStorage.getItem("taskflow_reminders");
      if (!raw) return [];
      return JSON.parse(raw).map(r => new Reminder(r));
    } catch { return []; }
  },
  saveName(name) { try { localStorage.setItem("taskflow_username", name); } catch {} },
  loadName() { try { return localStorage.getItem("taskflow_username") || ""; } catch { return ""; } },
};

// ============================================================
// REMINDER ENGINE — background service
// ============================================================
function buildReminders(task) {
  if (!task.deadline || task.status === "completed") return [];
  const reminders = [];
  const dl = new Date(task.deadline);
  reminders.push(new Reminder({ taskId: task.id, taskTitle: task.title, type: "deadline", triggerAt: dl.toISOString() }));
  const pre1hr = new Date(dl - 60 * 60 * 1000);
  if (pre1hr > new Date()) reminders.push(new Reminder({ taskId: task.id, taskTitle: task.title, type: "pre-1hr", triggerAt: pre1hr.toISOString() }));
  const pre10min = new Date(dl - 10 * 60 * 1000);
  if (pre10min > new Date()) reminders.push(new Reminder({ taskId: task.id, taskTitle: task.title, type: "pre-10min", triggerAt: pre10min.toISOString() }));
  return reminders;
}

// ============================================================
// PRIORITY CONFIG
// ============================================================
const PRIORITY_CONFIG = {
  critical: { label: "Critical", color: "#ff3b3b", bg: "rgba(255,59,59,0.12)", icon: "⚡" },
  high:     { label: "High",     color: "#ff8c00", bg: "rgba(255,140,0,0.12)",  icon: "🔥" },
  medium:   { label: "Medium",   color: "#f0c040", bg: "rgba(240,192,64,0.12)", icon: "◈" },
  low:      { label: "Low",      color: "#4ade80", bg: "rgba(74,222,128,0.12)", icon: "◇" },
};

const CATEGORIES = ["General", "Work", "Personal", "Health", "Finance", "Learning", "Shopping", "Project"];
const STATUS_CONFIG = {
  pending:     { label: "Pending",     color: "#a0aec0" },
  "in-progress": { label: "In Progress", color: "#63b3ed" },
  completed:   { label: "Completed",   color: "#68d391" },
  overdue:     { label: "Overdue",     color: "#fc8181" },
};

// ============================================================
// STYLES — CSS-in-JS via style injection
// ============================================================
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@400;600;700;800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0a0a0f;
  --bg2: #111118;
  --bg3: #18181f;
  --bg4: #1e1e28;
  --border: rgba(255,255,255,0.07);
  --border2: rgba(255,255,255,0.12);
  --text: #e8e8f0;
  --text2: #8888a0;
  --text3: #5a5a70;
  --accent: #7c6aff;
  --accent2: #a855f7;
  --accent-glow: rgba(124,106,255,0.3);
  --red: #ff3b3b;
  --green: #4ade80;
  --yellow: #f0c040;
  --orange: #ff8c00;
  --radius: 12px;
  --radius-sm: 8px;
  --mono: 'Space Mono', monospace;
  --display: 'Syne', sans-serif;
}
html, body { background: var(--bg); color: var(--text); min-height: 100vh; }
body { font-family: var(--mono); font-size: 13px; overflow-x: hidden; }

/* Scrollbar */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--accent); }

/* Animations */
@keyframes slideIn { from { opacity:0; transform: translateY(-8px); } to { opacity:1; transform: translateY(0); } }
@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
@keyframes ripple { 0% { transform: scale(0); opacity:0.6; } 100% { transform: scale(2.5); opacity:0; } }
@keyframes notifSlide { from { opacity:0; transform: translateX(120%); } to { opacity:1; transform: translateX(0); } }
@keyframes notifOut { from { opacity:1; transform: translateX(0); } to { opacity:0; transform: translateX(120%); } }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
@keyframes glowPulse { 0%,100% { box-shadow: 0 0 0 0 var(--accent-glow); } 50% { box-shadow: 0 0 20px 6px var(--accent-glow); } }
@keyframes countUp { from { transform: scale(1.4); color: var(--accent); } to { transform: scale(1); } }
@keyframes spin { to { transform: rotate(360deg); } }

.app-wrapper {
  display: flex; min-height: 100vh; background: var(--bg);
  background-image: radial-gradient(ellipse at 20% 10%, rgba(124,106,255,0.06) 0%, transparent 60%),
                    radial-gradient(ellipse at 80% 90%, rgba(168,85,247,0.04) 0%, transparent 60%);
}

/* SIDEBAR */
.sidebar {
  width: 220px; min-height: 100vh; background: var(--bg2);
  border-right: 1px solid var(--border); padding: 24px 0;
  display: flex; flex-direction: column; gap: 0; position: sticky; top: 0; height: 100vh;
  flex-shrink: 0; z-index: 10;
}
.sidebar-logo {
  padding: 0 20px 24px; border-bottom: 1px solid var(--border);
  font-family: var(--display); font-size: 20px; font-weight: 800;
  letter-spacing: -0.5px; color: var(--text);
}
.sidebar-logo span { color: var(--accent); }
.sidebar-logo small { display:block; font-family: var(--mono); font-size: 10px; color: var(--text3); font-weight: 400; margin-top: 2px; letter-spacing: 2px; text-transform: uppercase; }
.sidebar-nav { padding: 16px 12px; flex: 1; display: flex; flex-direction: column; gap: 4px; }
.nav-btn {
  display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: var(--radius-sm);
  cursor: pointer; transition: all 0.15s; font-family: var(--mono); font-size: 12px; color: var(--text2);
  border: none; background: transparent; width: 100%; text-align: left; position: relative; overflow: hidden;
}
.nav-btn:hover { background: var(--bg3); color: var(--text); }
.nav-btn.active { background: rgba(124,106,255,0.15); color: var(--accent); }
.nav-btn.active::before { content:''; position:absolute; left:0; top:20%; bottom:20%; width:2px; background:var(--accent); border-radius:2px; }
.nav-btn .icon { font-size: 14px; width: 20px; text-align:center; }
.nav-badge { margin-left: auto; background: var(--accent); color: white; font-size: 9px; padding: 1px 6px; border-radius: 10px; font-weight: 700; }
.nav-badge.red { background: var(--red); }
.sidebar-cats { padding: 0 12px 16px; }
.cats-label { font-size: 9px; color: var(--text3); letter-spacing: 2px; text-transform:uppercase; padding: 0 12px 8px; }
.cat-btn {
  display:flex; align-items:center; gap:8px; padding: 7px 12px; border-radius: var(--radius-sm);
  cursor:pointer; font-size:11px; color: var(--text2); transition:all 0.15s; border:none; background:transparent; width:100%; text-align:left;
}
.cat-btn:hover { background:var(--bg3); color:var(--text); }
.cat-btn.active { color: var(--accent); }
.cat-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
.sidebar-footer { padding: 16px 20px; border-top: 1px solid var(--border); }
.stats-mini { display:flex; flex-direction:column; gap:6px; }
.stat-mini { display:flex; justify-content:space-between; font-size:10px; color:var(--text3); }
.stat-mini strong { color: var(--text2); }

/* MAIN */
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

/* TOPBAR */
.topbar {
  display: flex; align-items: center; gap: 12px; padding: 16px 28px;
  border-bottom: 1px solid var(--border); background: rgba(10,10,15,0.8);
  backdrop-filter: blur(16px); position: sticky; top: 0; z-index: 9;
}
.topbar-title { font-family: var(--display); font-size: 22px; font-weight: 800; letter-spacing: -0.5px; flex: 1; }
.topbar-title span { color: var(--text3); font-weight: 400; font-size: 14px; margin-left: 8px; font-family: var(--mono); }
.search-box {
  display: flex; align-items: center; gap: 8px; background: var(--bg3);
  border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 12px;
  transition: all 0.2s; width: 220px;
}
.search-box:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
.search-box input { background: none; border: none; outline: none; font-family: var(--mono); font-size: 12px; color: var(--text); width: 100%; }
.search-box input::placeholder { color: var(--text3); }
.search-icon { color: var(--text3); font-size: 13px; }
.btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
  border-radius: var(--radius-sm); border: none; cursor: pointer; font-family: var(--mono);
  font-size: 12px; font-weight: 700; transition: all 0.15s; letter-spacing: 0.5px;
}
.btn-primary { background: var(--accent); color: white; }
.btn-primary:hover { background: var(--accent2); transform: translateY(-1px); box-shadow: 0 4px 20px var(--accent-glow); }
.btn-ghost { background: transparent; color: var(--text2); border: 1px solid var(--border); }
.btn-ghost:hover { background: var(--bg3); color: var(--text); border-color: var(--border2); }
.btn-danger { background: rgba(255,59,59,0.15); color: var(--red); border: 1px solid rgba(255,59,59,0.2); }
.btn-danger:hover { background: rgba(255,59,59,0.25); }
.btn-sm { padding: 5px 10px; font-size: 11px; }
.btn-icon { padding: 7px; }

/* CONTENT */
.content { padding: 24px 28px; flex: 1; }

/* FILTER BAR */
.filter-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
.filter-chip {
  padding: 5px 12px; border-radius: 20px; font-size: 11px; cursor: pointer; font-family: var(--mono);
  border: 1px solid var(--border); background: transparent; color: var(--text2); transition: all 0.15s;
  white-space: nowrap;
}
.filter-chip:hover { border-color: var(--border2); color: var(--text); }
.filter-chip.active { background: rgba(124,106,255,0.15); border-color: var(--accent); color: var(--accent); }
.sort-select {
  margin-left: auto; background: var(--bg3); border: 1px solid var(--border); color: var(--text2);
  font-family: var(--mono); font-size: 11px; padding: 5px 10px; border-radius: var(--radius-sm);
  cursor: pointer; outline: none;
}
.sort-select:focus { border-color: var(--accent); }

/* TASK LIST */
.task-grid { display: flex; flex-direction: column; gap: 8px; }
.task-card {
  background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 14px 16px; display: flex; align-items: flex-start; gap: 12px;
  cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden;
  animation: slideIn 0.25s ease forwards;
}
.task-card::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; transition: width 0.2s; }
.task-card.priority-critical::before { background: var(--red); }
.task-card.priority-high::before { background: var(--orange); }
.task-card.priority-medium::before { background: var(--yellow); }
.task-card.priority-low::before { background: var(--green); }
.task-card:hover { border-color: var(--border2); background: var(--bg3); transform: translateX(2px); }
.task-card:hover::before { width: 4px; }
.task-card.completed { opacity: 0.55; }
.task-card.overdue { border-color: rgba(255,59,59,0.2); background: rgba(255,59,59,0.04); }

.task-check {
  width: 20px; height: 20px; border-radius: 6px; border: 2px solid var(--border2);
  flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-top: 1px;
  cursor: pointer; transition: all 0.15s; position: relative; overflow: hidden;
}
.task-check:hover { border-color: var(--accent); }
.task-check.checked { background: var(--accent); border-color: var(--accent); }
.task-check.checked::after { content: '✓'; color: white; font-size: 11px; font-weight: 700; }

.task-body { flex: 1; min-width: 0; }
.task-title { font-size: 13px; font-weight: 700; font-family: var(--display); color: var(--text); margin-bottom: 3px; word-break: break-word; }
.task-title.done { text-decoration: line-through; color: var(--text3); }
.task-desc { font-size: 11px; color: var(--text2); margin-bottom: 6px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.task-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.task-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }
.task-deadline { font-size: 10px; color: var(--text3); display: flex; align-items: center; gap: 4px; }
.task-deadline.soon { color: var(--orange); }
.task-deadline.overdue { color: var(--red); animation: pulse 2s infinite; }
.task-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s; }
.task-card:hover .task-actions { opacity: 1; }
.action-btn {
  width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg3);
  color: var(--text2); cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 12px; transition: all 0.15s;
}
.action-btn:hover { border-color: var(--accent); color: var(--accent); background: rgba(124,106,255,0.1); }
.action-btn.delete:hover { border-color: var(--red); color: var(--red); background: rgba(255,59,59,0.1); }
.task-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
.tag { font-size: 9px; padding: 1px 6px; border-radius: 4px; background: var(--bg4); color: var(--text3); }
.empty-state { text-align: center; padding: 60px 20px; color: var(--text3); }
.empty-state .empty-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.4; }
.empty-state p { font-size: 12px; }

/* MODAL */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
  z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px;
  animation: fadeIn 0.2s ease;
}
.modal {
  background: var(--bg2); border: 1px solid var(--border2); border-radius: 16px;
  width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto;
  animation: slideIn 0.25s ease; box-shadow: 0 24px 80px rgba(0,0,0,0.6);
}
.modal-header { padding: 20px 24px 16px; border-bottom: 1px solid var(--border); display:flex; align-items:center; justify-content:space-between; }
.modal-title { font-family: var(--display); font-size: 18px; font-weight: 800; }
.modal-close { background: none; border: none; color: var(--text3); cursor: pointer; font-size: 18px; padding: 4px 8px; border-radius: 6px; transition: all 0.15s; }
.modal-close:hover { background: var(--bg3); color: var(--text); }
.modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
.form-row { display: flex; gap: 12px; }
.form-group { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.form-label { font-size: 10px; color: var(--text2); letter-spacing: 1px; text-transform: uppercase; }
.form-input {
  background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 9px 12px; font-family: var(--mono); font-size: 12px; color: var(--text); outline: none;
  transition: all 0.15s; width: 100%;
}
.form-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
.form-input::placeholder { color: var(--text3); }
textarea.form-input { resize: vertical; min-height: 70px; line-height: 1.5; }
select.form-input { cursor: pointer; }
select.form-input option { background: var(--bg2); }
.priority-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.priority-option {
  padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border); cursor: pointer;
  text-align: center; font-size: 11px; transition: all 0.15s; font-family: var(--mono);
}
.priority-option:hover { border-color: var(--border2); transform: translateY(-1px); }
.priority-option.selected { font-weight: 700; }
.modal-footer { padding: 16px 24px; border-top: 1px solid var(--border); display:flex; gap:8px; justify-content:flex-end; }
.checkbox-row { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.checkbox-row input { accent-color: var(--accent); width: 14px; height: 14px; cursor: pointer; }
.checkbox-row span { font-size: 12px; color: var(--text2); }
.ai-section { background: rgba(124,106,255,0.06); border: 1px solid rgba(124,106,255,0.15); border-radius: var(--radius-sm); padding: 12px; }
.ai-label { font-size: 10px; color: var(--accent); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; display:flex; align-items:center; gap:6px; }
.ai-loading { display:flex; align-items:center; gap:8px; color:var(--text2); font-size:11px; }
.ai-spinner { width:12px; height:12px; border:2px solid var(--border); border-top-color:var(--accent); border-radius:50%; animation:spin 0.8s linear infinite; }
.ai-suggestion { font-size: 11px; color: var(--text2); line-height: 1.6; }
.ai-suggestion strong { color: var(--accent); }

/* ANALYTICS */
.analytics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card {
  background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px;
  display: flex; flex-direction: column; gap: 6px; position: relative; overflow: hidden;
}
.stat-card::after {
  content: ''; position: absolute; top: -30px; right: -30px; width: 80px; height: 80px;
  border-radius: 50%; opacity: 0.06;
}
.stat-card.c1::after { background: var(--accent); }
.stat-card.c2::after { background: var(--green); }
.stat-card.c3::after { background: var(--red); }
.stat-card.c4::after { background: var(--yellow); }
.stat-label { font-size: 10px; color: var(--text3); letter-spacing: 1px; text-transform: uppercase; }
.stat-value { font-family: var(--display); font-size: 32px; font-weight: 800; line-height: 1; }
.stat-sub { font-size: 10px; color: var(--text3); }
.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
.chart-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
.chart-title { font-size: 12px; color: var(--text2); margin-bottom: 16px; display:flex; align-items:center; justify-content:space-between; }
.bar-chart { display: flex; flex-direction: column; gap: 10px; }
.bar-row { display: flex; align-items: center; gap: 10px; }
.bar-label { font-size: 10px; color: var(--text2); width: 70px; text-align: right; }
.bar-track { flex: 1; height: 8px; background: var(--bg4); border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s cubic-bezier(0.4,0,0.2,1); }
.bar-count { font-size: 10px; color: var(--text3); width: 20px; }
.donut-wrap { display: flex; align-items: center; gap: 20px; }
.donut { position: relative; width: 100px; height: 100px; flex-shrink: 0; }
.donut svg { transform: rotate(-90deg); }
.donut-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.donut-pct { font-family: var(--display); font-size: 20px; font-weight: 800; }
.donut-lbl { font-size: 9px; color: var(--text3); }
.legend { display: flex; flex-direction: column; gap: 8px; }
.legend-item { display: flex; align-items: center; gap: 8px; font-size: 10px; color: var(--text2); }
.legend-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
.trend-chart { height: 80px; display: flex; align-items: flex-end; gap: 6px; }
.trend-bar { flex: 1; border-radius: 3px 3px 0 0; transition: height 0.4s ease; min-height: 4px; position: relative; cursor: pointer; }
.trend-bar:hover::after { content: attr(data-tip); position: absolute; bottom: calc(100% + 4px); left: 50%; transform: translateX(-50%); background: var(--bg4); border: 1px solid var(--border); padding: 3px 8px; border-radius: 4px; font-size: 10px; white-space: nowrap; color: var(--text); z-index: 10; pointer-events: none; }
.trend-labels { display: flex; gap: 6px; margin-top: 6px; }
.trend-label { flex: 1; text-align: center; font-size: 8px; color: var(--text3); }
.productivity-score { text-align: center; padding: 20px; }
.score-ring { width: 120px; height: 120px; margin: 0 auto 12px; position: relative; }
.score-ring svg { transform: rotate(-90deg); }
.score-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.score-num { font-family: var(--display); font-size: 28px; font-weight: 800; color: var(--accent); }
.score-label { font-size: 9px; color: var(--text3); }

/* NOTIFICATIONS */
.notif-stack { position: fixed; top: 16px; right: 16px; z-index: 200; display: flex; flex-direction: column; gap: 8px; width: 320px; }
.notif {
  background: var(--bg2); border: 1px solid var(--border2); border-radius: var(--radius);
  padding: 12px 16px; display: flex; align-items: flex-start; gap: 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5); animation: notifSlide 0.3s ease;
  cursor: pointer; transition: transform 0.2s; position: relative; overflow: hidden;
}
.notif:hover { transform: translateX(-4px); }
.notif.exiting { animation: notifOut 0.3s ease forwards; }
.notif-bar { position: absolute; bottom: 0; left: 0; height: 2px; background: var(--accent); transition: width linear; }
.notif-bar.red { background: var(--red); }
.notif-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
.notif-content { flex: 1; }
.notif-title { font-size: 12px; font-weight: 700; font-family: var(--display); margin-bottom: 2px; }
.notif-msg { font-size: 11px; color: var(--text2); line-height: 1.4; }
.notif-close { background: none; border: none; color: var(--text3); cursor: pointer; font-size: 14px; padding: 2px; margin-top: -2px; }
.notif-close:hover { color: var(--text); }

/* CALENDAR */
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.cal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.cal-title { font-family: var(--display); font-size: 16px; font-weight: 700; }
.cal-day-label { text-align: center; font-size: 10px; color: var(--text3); padding: 6px; text-transform: uppercase; letter-spacing: 1px; }
.cal-day {
  aspect-ratio: 1; background: var(--bg3); border: 1px solid var(--border);
  border-radius: var(--radius-sm); display: flex; flex-direction: column; align-items: center;
  justify-content: flex-start; padding: 6px 4px; cursor: pointer; transition: all 0.15s; font-size: 11px;
  position: relative; overflow: hidden;
}
.cal-day:hover { border-color: var(--accent); background: rgba(124,106,255,0.08); }
.cal-day.today { border-color: var(--accent); background: rgba(124,106,255,0.1); }
.cal-day.today .cal-num { color: var(--accent); font-weight: 700; }
.cal-day.empty { background: transparent; border-color: transparent; cursor: default; }
.cal-day.empty:hover { background: transparent; border-color: transparent; }
.cal-num { font-size: 12px; font-weight: 600; color: var(--text2); }
.cal-dots { display: flex; gap: 2px; margin-top: 3px; flex-wrap: wrap; justify-content: center; }
.cal-dot { width: 5px; height: 5px; border-radius: 50%; }
.cal-task-list { margin-top: 16px; }

/* DRAG HANDLE */
.drag-handle { cursor: grab; color: var(--text3); font-size: 12px; padding: 4px; opacity: 0; transition: opacity 0.15s; }
.task-card:hover .drag-handle { opacity: 1; }

/* LOADING SKELETON */
.skeleton { background: linear-gradient(90deg, var(--bg3) 25%, var(--bg4) 50%, var(--bg3) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--radius-sm); }

/* SECTION HEADER */
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.section-title { font-family: var(--display); font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.section-count { background: var(--bg4); border-radius: 6px; padding: 2px 8px; font-size: 11px; color: var(--text2); }

/* TABS */
.tabs { display: flex; gap: 0; background: var(--bg3); border-radius: var(--radius-sm); padding: 3px; border: 1px solid var(--border); }
.tab {
  padding: 6px 14px; border-radius: 6px; font-size: 11px; cursor: pointer; transition: all 0.15s;
  font-family: var(--mono); color: var(--text2); border: none; background: transparent;
}
.tab:hover { color: var(--text); }
.tab.active { background: var(--bg2); color: var(--text); box-shadow: 0 1px 4px rgba(0,0,0,0.3); }

/* PROGRESS */
.progress-bar { height: 4px; background: var(--bg4); border-radius: 4px; overflow: hidden; margin-top: 4px; }
.progress-fill { height: 100%; border-radius: 4px; background: var(--accent); transition: width 0.4s ease; }

/* OVERDUE BANNER */
.overdue-banner {
  background: rgba(255,59,59,0.08); border: 1px solid rgba(255,59,59,0.2); border-radius: var(--radius);
  padding: 10px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; font-size: 12px;
  animation: glowPulse 3s ease-in-out infinite;
}
.overdue-banner strong { color: var(--red); }

/* QUICK STATS ROW */
.quick-stats { display: flex; gap: 12px; margin-bottom: 20px; }
.qstat { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 16px; flex: 1; }
.qstat-val { font-family: var(--display); font-size: 20px; font-weight: 800; }
.qstat-lbl { font-size: 9px; color: var(--text3); letter-spacing: 1px; text-transform: uppercase; }

/* AI CHAT PANEL */
.ai-panel {
  background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius);
  overflow: hidden; display: flex; flex-direction: column; height: 500px;
}
.ai-panel-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display:flex; align-items:center; gap:10px; }
.ai-panel-title { font-family: var(--display); font-size: 16px; font-weight: 700; flex:1; }
.ai-indicator { width: 8px; height: 8px; border-radius: 50%; background: var(--green); animation: pulse 2s infinite; }
.ai-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.ai-msg { max-width: 85%; animation: slideIn 0.2s ease; }
.ai-msg.user { align-self: flex-end; }
.ai-msg.assistant { align-self: flex-start; }
.ai-bubble {
  padding: 10px 14px; border-radius: 12px; font-size: 12px; line-height: 1.6;
  border: 1px solid var(--border);
}
.ai-msg.user .ai-bubble { background: rgba(124,106,255,0.15); border-color: rgba(124,106,255,0.25); color: var(--text); }
.ai-msg.assistant .ai-bubble { background: var(--bg3); color: var(--text2); }
.ai-input-row { padding: 12px 16px; border-top: 1px solid var(--border); display: flex; gap: 8px; }
.ai-input { flex: 1; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 12px; font-family: var(--mono); font-size: 12px; color: var(--text); outline: none; }
.ai-input:focus { border-color: var(--accent); }
.ai-send { padding: 8px 14px; background: var(--accent); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; transition: all 0.15s; }
.ai-send:hover { background: var(--accent2); }
.ai-send:disabled { opacity: 0.5; cursor: not-allowed; }

/* ACCOUNT MENU */
.account-btn {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: var(--radius-sm);
  background: var(--bg3); border: 1px solid var(--border); cursor: pointer; transition: all 0.15s;
  font-family: var(--mono); font-size: 12px; color: var(--text2); position: relative;
}
.account-btn:hover { border-color: var(--accent); }

/* MOBILE RESPONSIVE */
@media (max-width: 768px) {
  .app-wrapper { flex-direction: column; }
  
  /* Hamburger Menu */
  .hamburger {
    display: flex; flex-direction: column; gap: 4px; background: none; border: none;
    cursor: pointer; padding: 8px; border-radius: 6px; transition: all 0.2s;
  }
  .hamburger span {
    width: 20px; height: 2px; background: var(--text); border-radius: 2px;
    transition: all 0.3s;
  }
  .hamburger:hover { background: var(--bg3); }
  
  /* Mobile Overlay */
  .mobile-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
    z-index: 99; animation: fadeIn 0.2s ease;
  }
  
  .sidebar {
    position: fixed; left: -280px; top: 0; bottom: 0; width: 280px; z-index: 100;
    transition: left 0.3s ease; border-right: 1px solid var(--border);
    box-shadow: 4px 0 20px rgba(0,0,0,0.3);
  }
  .sidebar.mobile-open { left: 0; }
  
  .sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 0 20px 24px; border-bottom: 1px solid var(--border); }
  .mobile-close {
    display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;
    background: var(--bg3); border: 1px solid var(--border); border-radius: 6px;
    color: var(--text2); cursor: pointer; font-size: 16px; transition: all 0.15s;
  }
  .mobile-close:hover { background: var(--bg4); color: var(--text); }
  
  .sidebar-logo { padding: 0; border-bottom: none; }
  .sidebar-logo { font-size: 18px; }
  
  .sidebar-nav { padding: 12px; flex-direction: column; overflow-x: visible; flex-wrap: wrap; }
  .nav-btn { flex-shrink: 0; padding: 10px 12px; font-size: 12px; width: 100%; }
  .nav-btn .icon { font-size: 14px; }
  
  .sidebar-cats { display: flex; flex-direction: column; }
  .sidebar-footer { display: flex; }
  
  .topbar { padding: 12px 16px; flex-wrap: wrap; }
  .topbar-title { font-size: 18px; flex: 1; margin-bottom: 0; }
  .topbar-title span { display: inline; margin-left: 8px; }
  
  .search-box { width: 100%; max-width: none; order: 10; margin-top: 12px; }
  .btn { padding: 7px 12px; font-size: 11px; }
  .btn-sm { padding: 5px 8px; font-size: 10px; }
  
  .content { padding: 16px; }
  
  .filter-bar { gap: 6px; }
  .filter-chip { padding: 4px 10px; font-size: 10px; }
  .sort-select { font-size: 10px; padding: 4px 8px; }
  
  .analytics-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .stat-card { padding: 12px; }
  .stat-value { font-size: 24px; }
  
  .charts-row { grid-template-columns: 1fr; gap: 12px; }
  
  .task-card { padding: 12px; gap: 10px; }
  .task-title { font-size: 12px; }
  .task-desc { font-size: 10px; }
  .task-meta { gap: 6px; }
  .task-badge { font-size: 9px; padding: 2px 6px; }
  .task-actions { opacity: 1; }
  
  .modal { max-width: 100%; margin: 0; border-radius: 16px 16px 0 0; max-height: 85vh; }
  .modal-header { padding: 16px; }
  .modal-title { font-size: 16px; }
  .modal-body { padding: 16px; gap: 12px; }
  .form-row { flex-direction: column; gap: 12px; }
  .priority-grid { grid-template-columns: repeat(2, 1fr); }
  
  .calendar-grid { gap: 2px; }
  .cal-day { padding: 4px 2px; font-size: 10px; }
  .cal-num { font-size: 11px; }
  .cal-dots { gap: 1px; }
  .cal-dot { width: 4px; height: 4px; }
  
  .notif-stack { width: calc(100% - 32px); right: 16px; left: 16px; }
  .notif { padding: 10px 12px; }
  .notif-title { font-size: 11px; }
  .notif-msg { font-size: 10px; }
  
  .ai-panel { height: 400px; }
  .ai-messages { padding: 12px; gap: 8px; }
  .ai-msg { max-width: 90%; }
  .ai-bubble { padding: 8px 12px; font-size: 11px; }
  
  .quick-stats { flex-direction: column; gap: 8px; }
  .qstat { padding: 8px 12px; }
  .qstat-val { font-size: 18px; }
}

/* Hide hamburger on desktop */
@media (min-width: 769px) {
  .hamburger { display: none; }
  .mobile-close { display: none; }
  .sidebar-header { display: block; }
}

@media (max-width: 480px) {
  .topbar-title { font-size: 16px; }
  .analytics-grid { grid-template-columns: 1fr; }
  .stat-value { font-size: 20px; }
  .task-card { padding: 10px; }
  .modal-body { padding: 12px; }
  .priority-grid { grid-template-columns: 1fr; }
}); color: var(--text); }
.account-avatar { width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
.account-dropdown {
  position: absolute; top: calc(100% + 8px); right: 0; background: var(--bg2); border: 1px solid var(--border2);
  border-radius: var(--radius); box-shadow: 0 8px 32px rgba(0,0,0,0.5); min-width: 260px; z-index: 200;
  animation: slideIn 0.2s ease; overflow: hidden;
}
.account-header { padding: 16px; border-bottom: 1px solid var(--border); }
.account-greeting { font-size: 11px; color: var(--text3); margin-bottom: 4px; }
.account-name { font-family: var(--display); font-size: 16px; font-weight: 700; color: var(--text); }
.account-menu { padding: 8px; }
.account-menu-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-sm);
  cursor: pointer; transition: all 0.15s; font-size: 12px; color: var(--text2); border: none;
  background: transparent; width: 100%; text-align: left;
}
.account-menu-item:hover { background: var(--bg3); color: var(--text); }
.account-menu-item.danger { color: var(--red); }
.account-menu-item.danger:hover { background: rgba(255,59,59,0.1); }
.account-menu-item .icon { font-size: 14px; width: 18px; text-align: center; }
.settings-section { padding: 16px; }
.settings-title { font-size: 12px; font-weight: 700; color: var(--text); margin-bottom: 12px; font-family: var(--display); }
.settings-item { margin-bottom: 12px; }
.settings-item:last-child { margin-bottom: 0; }
`;

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function formatDeadline(dt) {
  if (!dt) return null;
  const d = new Date(dt), now = new Date();
  const diff = d - now, abs = Math.abs(diff);
  const mins = Math.floor(abs / 6e4), hrs = Math.floor(abs / 36e5), days = Math.floor(abs / 864e5);
  if (diff < 0) return { label: `${days > 0 ? days + "d " : ""}${hrs % 24}h overdue`, cls: "overdue" };
  if (mins < 60) return { label: `${mins}m left`, cls: "soon" };
  if (hrs < 24) return { label: `${hrs}h left`, cls: hrs < 3 ? "soon" : "" };
  if (days < 3) return { label: `${days}d left`, cls: "" };
  return { label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), cls: "" };
}

function catColor(cat) {
  const palette = ["#7c6aff","#a855f7","#22d3ee","#4ade80","#f0c040","#ff8c00","#ff3b3b","#ec4899"];
  let hash = 0;
  for (let i = 0; i < cat.length; i++) hash = cat.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

// ============================================================
// NOTIFICATION COMPONENT
// ============================================================
function NotifStack({ notifications, onDismiss }) {
  return (
    <div className="notif-stack">
      {notifications.map(n => (
        <NotifItem key={n.id} notif={n} onDismiss={() => onDismiss(n.id)} />
      ))}
    </div>
  );
}

function NotifItem({ notif, onDismiss }) {
  const [progress, setProgress] = useState(100);
  const [exiting, setExiting] = useState(false);
  const duration = 5000;

  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.max(0, 100 - (elapsed / duration) * 100));
      if (elapsed >= duration) { clearInterval(iv); handleClose(); }
    }, 50);
    return () => clearInterval(iv);
  }, []);

  function handleClose() {
    setExiting(true);
    setTimeout(onDismiss, 300);
  }

  const isOverdue = notif.type === "overdue" || notif.type === "deadline";
  const icons = { "pre-10min": "⏰", "pre-1hr": "🕐", deadline: "🔔", overdue: "🚨", info: "💡", success: "✅", ai: "🤖" };

  return (
    <div className={`notif${exiting ? " exiting" : ""}`} onClick={handleClose}>
      <div className="notif-icon">{icons[notif.type] || "📌"}</div>
      <div className="notif-content">
        <div className="notif-title">{notif.title}</div>
        <div className="notif-msg">{notif.message}</div>
      </div>
      <button className="notif-close" onClick={e => { e.stopPropagation(); handleClose(); }}>×</button>
      <div className={`notif-bar${isOverdue ? " red" : ""}`} style={{ width: `${progress}%` }} />
    </div>
  );
}

// ============================================================
// TASK FORM MODAL
// ============================================================
function TaskModal({ task, onSave, onClose, addNotif }) {
  const isEdit = !!task?.id;
  const [form, setForm] = useState({
    title: task?.title || "",
    description: task?.description || "",
    priority: task?.priority || "medium",
    deadline: task?.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : "",
    category: task?.category || "General",
    status: task?.status || "pending",
    recurring: task?.recurring || false,
    recurringInterval: task?.recurringInterval || 60,
    tags: task?.tags?.join(", ") || "",
  });
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function fetchAiSuggestion() {
    if (!form.title.trim()) return;
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          system: `You are a smart task management assistant. When given a task title and some details, provide a brief suggestion (2-3 sentences max) covering: recommended priority level, realistic time estimate, and one actionable tip. Keep it concise and practical. Format your response with these labels: Priority: [level], Time: [estimate], Tip: [suggestion]`,
          messages: [{ role: "user", content: `Task: "${form.title}"\nDescription: "${form.description}"\nCategory: ${form.category}` }]
        })
      });
      const data = await resp.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      setAiSuggestion(text);
    } catch {
      setAiSuggestion("Could not reach AI service. Please check your connection.");
    }
    setAiLoading(false);
  }

  function handleSave() {
    if (!form.title.trim()) return;
    const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
    const t = new Task({
      ...(isEdit ? task : {}),
      ...form,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      tags,
    });
    onSave(t);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "Edit Task" : "New Task"}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Task Title *</label>
            <input className="form-input" placeholder="What needs to be done?" value={form.title} onChange={e => set("title", e.target.value)} onBlur={() => !isEdit && form.title.length > 3 && fetchAiSuggestion()} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" placeholder="Add details, notes, context..." value={form.description} onChange={e => set("description", e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-input" value={form.category} onChange={e => set("category", e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={e => set("status", e.target.value)}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <div className="priority-grid">
              {Object.entries(PRIORITY_CONFIG).map(([k, cfg]) => (
                <div key={k} className={`priority-option${form.priority === k ? " selected" : ""}`}
                  style={form.priority === k ? { borderColor: cfg.color, background: cfg.bg, color: cfg.color } : {}}
                  onClick={() => set("priority", k)}>
                  <div>{cfg.icon}</div>
                  <div>{cfg.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Deadline</label>
              <input type="datetime-local" className="form-input" value={form.deadline} onChange={e => set("deadline", e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Tags (comma-separated)</label>
            <input className="form-input" placeholder="e.g. urgent, review, client" value={form.tags} onChange={e => set("tags", e.target.value)} />
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.recurring} onChange={e => set("recurring", e.target.checked)} />
            <span>Recurring reminder every</span>
            <input type="number" className="form-input" style={{ width: 60 }} value={form.recurringInterval} onChange={e => set("recurringInterval", +e.target.value)} disabled={!form.recurring} min={5} />
            <span>minutes</span>
          </label>
          {/* AI Suggestion Section */}
          <div className="ai-section">
            <div className="ai-label">✦ AI Smart Suggestion</div>
            {!aiSuggestion && !aiLoading && (
              <button className="btn btn-ghost btn-sm" onClick={fetchAiSuggestion} disabled={!form.title.trim()}>
                ✦ Get AI Suggestion
              </button>
            )}
            {aiLoading && <div className="ai-loading"><div className="ai-spinner" /> Analyzing task...</div>}
            {aiSuggestion && (
              <div className="ai-suggestion"
                dangerouslySetInnerHTML={{ __html: aiSuggestion.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/Priority:/g, "<strong>Priority:</strong>").replace(/Time:/g, "<strong>Time:</strong>").replace(/Tip:/g, "<strong>Tip:</strong>") }}
              />
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!form.title.trim()}>
            {isEdit ? "Save Changes" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TASK CARD COMPONENT
// ============================================================
function TaskCard({ task, onToggle, onEdit, onDelete, style }) {
  const dl = task.deadline ? formatDeadline(task.deadline) : null;
  const pc = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const isOv = task.isOverdue();

  return (
    <div className={`task-card priority-${task.priority}${task.status === "completed" ? " completed" : ""}${isOv ? " overdue" : ""}`}
      style={style} onClick={() => onEdit(task)}>
      <div className={`task-check${task.status === "completed" ? " checked" : ""}`}
        onClick={e => { e.stopPropagation(); onToggle(task.id); }} />
      <div className="task-body">
        <div className={`task-title${task.status === "completed" ? " done" : ""}`}>{task.title}</div>
        {task.description && <div className="task-desc">{task.description.length > 100 ? task.description.slice(0, 100) + "…" : task.description}</div>}
        <div className="task-meta">
          <span className="task-badge" style={{ background: pc.bg, color: pc.color }}>{pc.icon} {pc.label}</span>
          <span className="task-badge" style={{ background: "rgba(255,255,255,0.06)", color: catColor(task.category) }}>
            ◉ {task.category}
          </span>
          <span className="task-badge" style={{ background: "rgba(255,255,255,0.05)", color: STATUS_CONFIG[task.status]?.color }}>
            {STATUS_CONFIG[task.status]?.label || task.status}
          </span>
          {dl && <span className={`task-deadline ${dl.cls}`}>⏱ {dl.label}</span>}
          {task.recurring && <span className="task-badge" style={{ background: "rgba(99,179,237,0.1)", color: "#63b3ed" }}>↺ Recurring</span>}
        </div>
        {task.tags.length > 0 && (
          <div className="task-tags">{task.tags.map(t => <span key={t} className="tag">#{t}</span>)}</div>
        )}
      </div>
      <div className="task-actions" onClick={e => e.stopPropagation()}>
        <button className="action-btn" onClick={() => onEdit(task)} title="Edit">✎</button>
        <button className="action-btn delete" onClick={() => onDelete(task.id)} title="Delete">✕</button>
      </div>
    </div>
  );
}

// ============================================================
// ANALYTICS VIEW
// ============================================================
function AnalyticsView({ tasks }) {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === "completed").length;
  const overdue = tasks.filter(t => t.isOverdue()).length;
  const inProgress = tasks.filter(t => t.status === "in-progress").length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  const byCategory = CATEGORIES.map(c => ({ name: c, count: tasks.filter(t => t.category === c).length })).filter(x => x.count > 0);
  const byPriority = Object.keys(PRIORITY_CONFIG).map(p => ({ name: p, count: tasks.filter(t => t.priority === p).length, color: PRIORITY_CONFIG[p].color }));
  const maxCat = Math.max(...byCategory.map(x => x.count), 1);

  // Last 7 days trend
  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const day = d.toDateString();
    return {
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      completed: tasks.filter(t => t.completedAt && new Date(t.completedAt).toDateString() === day).length,
      created: tasks.filter(t => new Date(t.createdAt).toDateString() === day).length,
    };
  });
  const maxTrend = Math.max(...trend.map(t => Math.max(t.completed, t.created)), 1);

  // Donut
  const donutR = 40, donutC = 251.2;
  const donutDash = total ? (completed / total) * donutC : 0;

  // Productivity score
  const score = Math.min(100, Math.round(pct * 0.6 + (total > 0 ? Math.min(40, total * 2) : 0) - overdue * 5));
  const scoreC = 2 * Math.PI * 45;
  const scoreDash = (score / 100) * scoreC;

  return (
    <div>
      <div className="analytics-grid">
        {[
          { label: "Total Tasks", val: total, sub: "all time", cls: "c1", color: "var(--accent)" },
          { label: "Completed", val: completed, sub: `${pct}% completion rate`, cls: "c2", color: "var(--green)" },
          { label: "Overdue", val: overdue, sub: "need attention", cls: "c3", color: "var(--red)" },
          { label: "In Progress", val: inProgress, sub: "active now", cls: "c4", color: "var(--yellow)" },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.cls}`}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.val}</div>
            <div className="stat-sub">{s.sub}</div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${total ? (s.val / total) * 100 : 0}%`, background: s.color }} /></div>
          </div>
        ))}
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-title">Tasks by Category</div>
          <div className="bar-chart">
            {byCategory.length === 0 ? <div style={{ color: "var(--text3)", fontSize: 11 }}>No data yet</div> :
              byCategory.map(c => (
                <div key={c.name} className="bar-row">
                  <div className="bar-label">{c.name}</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(c.count / maxCat) * 100}%`, background: catColor(c.name) }} />
                  </div>
                  <div className="bar-count">{c.count}</div>
                </div>
              ))
            }
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-title">Completion Status</div>
          <div className="donut-wrap">
            <div className="donut">
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={donutR} fill="none" stroke="var(--bg4)" strokeWidth="12" />
                <circle cx="50" cy="50" r={donutR} fill="none" stroke="var(--accent)" strokeWidth="12"
                  strokeDasharray={`${donutDash} ${donutC}`} strokeLinecap="round" />
              </svg>
              <div className="donut-center">
                <div className="donut-pct" style={{ color: "var(--accent)" }}>{pct}%</div>
                <div className="donut-lbl">done</div>
              </div>
            </div>
            <div className="legend">
              {[["Completed", "var(--green)", completed], ["Pending", "var(--text3)", tasks.filter(t => t.status === "pending").length], ["In Progress", "var(--accent)", inProgress], ["Overdue", "var(--red)", overdue]].map(([l, c, v]) => (
                <div key={l} className="legend-item">
                  <div className="legend-dot" style={{ background: c }} />
                  {l}: <strong style={{ color: "var(--text)", marginLeft: 2 }}>{v}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-title">7-Day Activity</div>
          <div className="trend-chart">
            {trend.map((t, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, alignItems: "stretch" }}>
                <div className="trend-bar" style={{ height: `${(t.created / maxTrend) * 70}px`, background: "rgba(124,106,255,0.4)" }} data-tip={`Created: ${t.created}`} />
                <div className="trend-bar" style={{ height: `${(t.completed / maxTrend) * 70}px`, background: "var(--green)" }} data-tip={`Done: ${t.completed}`} />
              </div>
            ))}
          </div>
          <div className="trend-labels">{trend.map((t, i) => <div key={i} className="trend-label">{t.label}</div>)}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            {[["Created", "rgba(124,106,255,0.4)"], ["Completed", "var(--green)"]].map(([l, c]) => (
              <div key={l} className="legend-item"><div className="legend-dot" style={{ background: c }} />{l}</div>
            ))}
          </div>
        </div>

        <div className="chart-card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="chart-title">Tasks by Priority</div>
          <div className="bar-chart" style={{ flex: 1 }}>
            {byPriority.map(p => (
              <div key={p.name} className="bar-row">
                <div className="bar-label" style={{ textTransform: "capitalize" }}>{p.name}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${total ? (p.count / total) * 100 : 0}%`, background: p.color }} />
                </div>
                <div className="bar-count">{p.count}</div>
              </div>
            ))}
          </div>
          <div className="productivity-score" style={{ marginTop: "auto" }}>
            <div className="score-ring">
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="45" fill="none" stroke="var(--bg4)" strokeWidth="10" />
                <circle cx="60" cy="60" r="45" fill="none" stroke="var(--accent)" strokeWidth="10"
                  strokeDasharray={`${scoreDash} ${scoreC}`} strokeLinecap="round" />
              </svg>
              <div className="score-center">
                <div className="score-num">{score}</div>
                <div className="score-label">Score</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>Productivity Score</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CALENDAR VIEW
// ============================================================
function CalendarView({ tasks, onTaskClick }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const cells = Array.from({ length: firstDay }, () => null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

  const tasksForDay = (day) => {
    if (!day) return [];
    return tasks.filter(t => {
      if (!t.deadline) return false;
      const d = new Date(t.deadline);
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth && d.getDate() === day;
    });
  };

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const selectedTasks = tasksForDay(selectedDay);

  return (
    <div>
      <div className="chart-card">
        <div className="cal-header">
          <button className="btn btn-ghost btn-sm" onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); } else setViewMonth(m => m-1); }}>←</button>
          <div className="cal-title">{monthNames[viewMonth]} {viewYear}</div>
          <button className="btn btn-ghost btn-sm" onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1); } else setViewMonth(m => m+1); }}>→</button>
        </div>
        <div className="calendar-grid">
          {dayNames.map(d => <div key={d} className="cal-day-label">{d}</div>)}
          {cells.map((day, i) => {
            const dayTasks = tasksForDay(day);
            const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
            const isSelected = day === selectedDay;
            return (
              <div key={i} className={`cal-day${!day ? " empty" : ""}${isToday ? " today" : ""}${isSelected && day ? " today" : ""}`}
                onClick={() => day && setSelectedDay(day)}>
                {day && <div className="cal-num">{day}</div>}
                {day && dayTasks.length > 0 && (
                  <div className="cal-dots">
                    {dayTasks.slice(0, 4).map((t, j) => (
                      <div key={j} className="cal-dot" style={{ background: PRIORITY_CONFIG[t.priority]?.color || "var(--accent)" }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {selectedDay && (
        <div className="cal-task-list">
          <div className="section-header">
            <div className="section-title">
              Tasks on {monthNames[viewMonth]} {selectedDay}
              <span className="section-count">{selectedTasks.length}</span>
            </div>
          </div>
          {selectedTasks.length === 0 ? (
            <div style={{ color: "var(--text3)", fontSize: 12, padding: "12px 0" }}>No tasks due on this day</div>
          ) : (
            <div className="task-grid">
              {selectedTasks.map(t => <TaskCard key={t.id} task={t} onToggle={() => {}} onEdit={onTaskClick} onDelete={() => {}} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// AI ASSISTANT PANEL
// ============================================================
function AIAssistantPanel({ tasks }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello! I'm your AI task assistant. I can help you prioritize tasks, suggest schedules, analyze your productivity, and answer questions about your tasks. What would you like to know?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newMsgs = [...messages, { role: "user", content: text }];
    setMessages(newMsgs);
    setLoading(true);

    const taskSummary = tasks.slice(0, 20).map(t =>
      `- "${t.title}" | Priority: ${t.priority} | Status: ${t.status} | Category: ${t.category}${t.deadline ? ` | Due: ${new Date(t.deadline).toLocaleDateString()}` : ""}${t.isOverdue() ? " [OVERDUE]" : ""}`
    ).join("\n");

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          system: `You are an intelligent task management assistant embedded in a to-do app. You help users manage tasks, improve productivity, and provide actionable advice. Be concise (2-4 sentences max per response), friendly, and practical.\n\nUser's current tasks:\n${taskSummary || "No tasks yet."}`,
          messages: newMsgs.map(m => ({ role: m.role, content: m.content }))
        })
      });
      const data = await resp.json();
      const reply = data.content?.find(b => b.type === "text")?.text || "Sorry, I couldn't process that.";
      setMessages(m => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Connection error. Please check your network." }]);
    }
    setLoading(false);
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div className="ai-indicator" />
        <div className="ai-panel-title">✦ AI Task Assistant</div>
        <div style={{ fontSize: 10, color: "var(--text3)" }}>Powered by Claude</div>
      </div>
      <div className="ai-messages">
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role}`}>
            <div className="ai-bubble">{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="ai-msg assistant">
            <div className="ai-bubble">
              <div className="ai-loading"><div className="ai-spinner" /> Thinking…</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="ai-input-row">
        <input className="ai-input" placeholder="Ask about your tasks…" value={input}
          onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} />
        <button className="ai-send" onClick={sendMessage} disabled={loading || !input.trim()}>➤</button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
// ============================================================
// ACCOUNT MENU COMPONENT
// ============================================================
function AccountMenu({ userName, onNameChange, onClearAll }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [nameInput, setNameInput] = useState(userName);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
        setShowSettings(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSaveName = () => {
    onNameChange(nameInput);
    setShowSettings(false);
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all tasks? This action cannot be undone.")) {
      onClearAll();
      setIsOpen(false);
    }
  };

  const initials = userName ? userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "?";
  const displayName = userName || "Guest";

  return (
    <div style={{ position: "relative" }} ref={menuRef}>
      <button className="account-btn" onClick={() => setIsOpen(!isOpen)}>
        <div className="account-avatar">{initials}</div>
        <span>{displayName}</span>
        <span style={{ fontSize: 10 }}>▾</span>
      </button>
      {isOpen && (
        <div className="account-dropdown">
          {!showSettings ? (
            <>
              <div className="account-header">
                <div className="account-greeting">Welcome back,</div>
                <div className="account-name">{displayName}</div>
              </div>
              <div className="account-menu">
                <button className="account-menu-item" onClick={() => setShowSettings(true)}>
                  <span className="icon">⚙</span>
                  Settings
                </button>
                <button className="account-menu-item danger" onClick={handleClearAll}>
                  <span className="icon">🗑</span>
                  Clear All Tasks
                </button>
              </div>
            </>
          ) : (
            <div className="settings-section">
              <div className="settings-title">Account Settings</div>
              <div className="settings-item">
                <div className="form-group">
                  <label className="form-label">Your Name</label>
                  <input
                    className="form-input"
                    placeholder="Enter your name"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(false)}>
                  Back
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleSaveName}>
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [tasks, setTasks] = useState(() => DB.load());
  const [reminders, setReminders] = useState(() => DB.loadReminders());
  const [notifications, setNotifications] = useState([]);
  const [view, setView] = useState("tasks");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortBy, setSortBy] = useState("urgency");
  const [userName, setUserName] = useState(() => DB.loadName());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const reminderTimerRef = useRef(null);

  // Inject CSS
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  // Persist
  useEffect(() => { DB.save(tasks); }, [tasks]);
  useEffect(() => { DB.saveReminders(reminders); }, [reminders]);
  useEffect(() => { DB.saveName(userName); }, [userName]);

  const handleNameChange = (newName) => {
    setUserName(newName);
    addNotif({ type: "success", title: "Profile Updated", message: `Welcome, ${newName || "Guest"}!` });
  };

  const handleClearAll = () => {
    setTasks([]);
    setReminders([]);
    addNotif({ type: "info", title: "All Clear", message: "All tasks have been deleted." });
  };

  // Reminder Engine
  const addNotif = useCallback((notif) => {
    const id = crypto.randomUUID();
    setNotifications(n => [...n, { ...notif, id }]);
  }, []);

  useEffect(() => {
    function checkReminders() {
      const now = new Date();
      setReminders(prev => {
        const updated = [...prev];
        let changed = false;
        updated.forEach(r => {
          if (!r.triggered && new Date(r.triggerAt) <= now) {
            r.triggered = true; changed = true;
            const msgs = { "pre-10min": "⏰ Due in 10 minutes!", "pre-1hr": "🕐 Due in 1 hour", deadline: "🔔 Task is due now!", overdue: "🚨 Task is overdue!" };
            addNotif({ type: r.type, title: r.taskTitle, message: msgs[r.type] || "Reminder" });
          }
        });
        return changed ? updated : prev;
      });
      // Check for newly overdue tasks
      setTasks(prev => {
        let changed = false;
        const updated = prev.map(t => {
          if (t.isOverdue() && t.status !== "completed" && t.status !== "overdue") {
            changed = true;
            return new Task({ ...t, status: "overdue" });
          }
          return t;
        });
        return changed ? updated : prev;
      });
    }
    reminderTimerRef.current = setInterval(checkReminders, 30000);
    checkReminders();
    return () => clearInterval(reminderTimerRef.current);
  }, [addNotif]);

  // Rebuild reminders when tasks change
  useEffect(() => {
    const newReminders = [];
    tasks.forEach(t => {
      if (t.status !== "completed") {
        const existing = reminders.filter(r => r.taskId === t.id && r.triggered);
        const triggeredTypes = new Set(existing.map(r => r.type));
        const fresh = buildReminders(t).filter(r => !triggeredTypes.has(r.type));
        newReminders.push(...fresh);
      }
    });
    // Keep triggered reminders + add fresh ones
    setReminders(prev => {
      const triggered = prev.filter(r => r.triggered);
      const existingTaskIds = new Set(triggered.map(r => r.taskId + r.type));
      const deduped = newReminders.filter(r => !existingTaskIds.has(r.taskId + r.type));
      return [...triggered, ...deduped];
    });
  }, [tasks.length]);

  // CRUD
  function saveTask(task) {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === task.id);
      if (idx >= 0) { const u = [...prev]; u[idx] = task; return u; }
      return [...prev, task];
    });
    addNotif({ type: "success", title: task.title, message: editTask ? "Task updated successfully" : "New task created! Reminders scheduled." });
    setModalOpen(false); setEditTask(null);
  }

  function toggleTask(id) {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const newStatus = t.status === "completed" ? "pending" : "completed";
      const completedAt = newStatus === "completed" ? new Date().toISOString() : null;
      if (newStatus === "completed") addNotif({ type: "success", title: t.title, message: "✅ Task completed! Great work!" });
      return new Task({ ...t, status: newStatus, completedAt });
    }));
  }

  function deleteTask(id) {
    setTasks(prev => prev.filter(t => t.id !== id));
    setReminders(prev => prev.filter(r => r.taskId !== id));
  }

  function openEdit(task) { setEditTask(task); setModalOpen(true); }
  function openNew() { setEditTask(null); setModalOpen(true); }

  // Filter & Sort
  const filteredTasks = useMemo(() => {
    let res = [...tasks];
    if (search) res = res.filter(t => t.title.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase()) || t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase())));
    if (filterStatus !== "all") res = res.filter(t => t.status === filterStatus);
    if (filterPriority !== "all") res = res.filter(t => t.priority === filterPriority);
    if (filterCategory !== "all") res = res.filter(t => t.category === filterCategory);
    if (sortBy === "urgency") res.sort((a, b) => b.getUrgencyScore() - a.getUrgencyScore());
    else if (sortBy === "deadline") res.sort((a, b) => (a.deadline || "z").localeCompare(b.deadline || "z"));
    else if (sortBy === "priority") { const o = { critical: 4, high: 3, medium: 2, low: 1 }; res.sort((a, b) => (o[b.priority] || 0) - (o[a.priority] || 0)); }
    else if (sortBy === "created") res.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else if (sortBy === "title") res.sort((a, b) => a.title.localeCompare(b.title));
    return res;
  }, [tasks, search, filterStatus, filterPriority, filterCategory, sortBy]);

  const overdueCount = tasks.filter(t => t.isOverdue()).length;
  const pendingCount = tasks.filter(t => t.status === "pending" || t.status === "in-progress").length;
  const completedCount = tasks.filter(t => t.status === "completed").length;
  const totalCount = tasks.length;

  const usedCategories = [...new Set(tasks.map(t => t.category))];

  // Sample data seeder
  function seedDemo() {
    const now = new Date();
    const demos = [
      new Task({ title: "Review algorithm assignment", description: "Go through CSC 483.1 search optimization code and verify all test cases pass before submission.", priority: "critical", deadline: new Date(now.getTime() + 2 * 36e5).toISOString(), category: "Learning", tags: ["uni", "code"] }),
      new Task({ title: "Push to GitHub", description: "Create repo, add all Java source files, write README with build instructions.", priority: "high", deadline: new Date(now.getTime() + 5 * 36e5).toISOString(), category: "Project", tags: ["code", "github"] }),
      new Task({ title: "Update stock inventory spreadsheet", description: "Add new items from today's delivery and recalculate profit/loss columns.", priority: "medium", deadline: new Date(now.getTime() + 24 * 36e5).toISOString(), category: "Work", tags: ["inventory"] }),
      new Task({ title: "Complete OOP report", description: "Write the 2-page report on the Library Resource Management System design decisions.", priority: "high", deadline: new Date(now.getTime() + 8 * 36e5).toISOString(), category: "Learning", tags: ["uni", "report"] }),
      new Task({ title: "Exercise routine", priority: "low", deadline: new Date(now.getTime() + 48 * 36e5).toISOString(), category: "Health", status: "completed", completedAt: new Date().toISOString() }),
      new Task({ title: "Buy groceries", description: "Rice, vegetables, fruit, water, toiletries.", priority: "medium", category: "Shopping", tags: ["personal"] }),
      new Task({ title: "Check Drujela availability at pharmacy", description: "Oral ulcer gel – check if restocked at the nearby pharmacy.", priority: "low", category: "Health" }),
    ];
    setTasks(demos);
    addNotif({ type: "info", title: "Demo loaded", message: "7 sample tasks added to get you started!" });
  }

  const navItems = [
    { id: "tasks", icon: "◧", label: "Tasks", badge: pendingCount > 0 ? pendingCount : null },
    { id: "analytics", icon: "◈", label: "Analytics" },
    { id: "calendar", icon: "⬚", label: "Calendar" },
    { id: "ai", icon: "✦", label: "AI Assistant" },
  ];

  return (
    <div className="app-wrapper">
      {/* MOBILE MENU OVERLAY */}
      {mobileMenuOpen && <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} />}
      
      {/* SIDEBAR */}
      <div className={`sidebar${mobileMenuOpen ? " mobile-open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            Task<span>Flow</span>
            <small>Intelligent Planner</small>
          </div>
          <button className="mobile-close" onClick={() => setMobileMenuOpen(false)}>✕</button>
        </div>
        <div className="sidebar-nav">
          {navItems.map(n => (
            <button key={n.id} className={`nav-btn${view === n.id ? " active" : ""}`} onClick={() => { setView(n.id); setMobileMenuOpen(false); }}>
              <span className="icon">{n.icon}</span>
              {n.label}
              {n.badge != null && <span className={`nav-badge${overdueCount > 0 && n.id === "tasks" ? " red" : ""}`}>{n.badge}</span>}
            </button>
          ))}
        </div>
        <div className="sidebar-cats">
          <div className="cats-label">Categories</div>
          <button className={`cat-btn${filterCategory === "all" ? " active" : ""}`} onClick={() => { setFilterCategory("all"); setView("tasks"); setMobileMenuOpen(false); }}>
            <div className="cat-dot" style={{ background: "var(--text3)" }} /> All
          </button>
          {usedCategories.map(c => (
            <button key={c} className={`cat-btn${filterCategory === c ? " active" : ""}`} onClick={() => { setFilterCategory(c); setView("tasks"); setMobileMenuOpen(false); }}>
              <div className="cat-dot" style={{ background: catColor(c) }} /> {c}
              <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text3)" }}>{tasks.filter(t => t.category === c).length}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="stats-mini">
            <div className="stat-mini"><span>Total</span><strong>{totalCount}</strong></div>
            <div className="stat-mini"><span>Done</span><strong style={{ color: "var(--green)" }}>{completedCount}</strong></div>
            <div className="stat-mini"><span>Overdue</span><strong style={{ color: "var(--red)" }}>{overdueCount}</strong></div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="main">
        {/* TOPBAR */}
        <div className="topbar">
          <button className="hamburger" onClick={() => setMobileMenuOpen(true)}>
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div className="topbar-title">
            {view === "tasks" && <>Tasks <span>{filteredTasks.length} shown</span></>}
            {view === "analytics" && <>Analytics <span>insights & trends</span></>}
            {view === "calendar" && <>Calendar <span>deadline view</span></>}
            {view === "ai" && <>AI Assistant <span>smart scheduling</span></>}
          </div>
          {view === "tasks" && (
            <div className="search-box">
              <span className="search-icon">⌕</span>
              <input placeholder="Search tasks, tags…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          )}
          {tasks.length === 0 && <button className="btn btn-ghost btn-sm" onClick={seedDemo}>Load Demo</button>}
          <button className="btn btn-primary" onClick={openNew}>+ New Task</button>
          <AccountMenu userName={userName} onNameChange={handleNameChange} onClearAll={handleClearAll} />
        </div>

        {/* CONTENT */}
        <div className="content">
          {/* TASKS VIEW */}
          {view === "tasks" && (
            <>
              {overdueCount > 0 && (
                <div className="overdue-banner">
                  🚨 <strong>{overdueCount} overdue task{overdueCount > 1 ? "s" : ""}</strong> — address these immediately to stay on track.
                </div>
              )}
              <div className="quick-stats">
                {[["Pending", pendingCount, "var(--text2)"], ["In Progress", tasks.filter(t => t.status === "in-progress").length, "var(--accent)"], ["Completed", completedCount, "var(--green)"], ["Overdue", overdueCount, "var(--red)"]].map(([l, v, c]) => (
                  <div key={l} className="qstat">
                    <div className="qstat-val" style={{ color: c }}>{v}</div>
                    <div className="qstat-lbl">{l}</div>
                  </div>
                ))}
              </div>
              <div className="filter-bar">
                {["all", "pending", "in-progress", "completed", "overdue"].map(s => (
                  <button key={s} className={`filter-chip${filterStatus === s ? " active" : ""}`} onClick={() => setFilterStatus(s)}>
                    {s === "all" ? "All Status" : STATUS_CONFIG[s]?.label || s}
                  </button>
                ))}
                <div style={{ width: 1, background: "var(--border)", margin: "0 4px" }} />
                {["all", "critical", "high", "medium", "low"].map(p => (
                  <button key={p} className={`filter-chip${filterPriority === p ? " active" : ""}`} onClick={() => setFilterPriority(p)}
                    style={filterPriority === p && p !== "all" ? { borderColor: PRIORITY_CONFIG[p]?.color, color: PRIORITY_CONFIG[p]?.color } : {}}>
                    {p === "all" ? "All Priority" : PRIORITY_CONFIG[p]?.icon + " " + PRIORITY_CONFIG[p]?.label}
                  </button>
                ))}
                <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="urgency">Sort: Urgency</option>
                  <option value="deadline">Sort: Deadline</option>
                  <option value="priority">Sort: Priority</option>
                  <option value="created">Sort: Newest</option>
                  <option value="title">Sort: A-Z</option>
                </select>
              </div>
              <div className="section-header">
                <div className="section-title">
                  {filterCategory !== "all" ? filterCategory : "All Tasks"}
                  <span className="section-count">{filteredTasks.length}</span>
                </div>
              </div>
              {filteredTasks.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">◧</div>
                  <p>{tasks.length === 0 ? "No tasks yet. Create your first task or load the demo!" : "No tasks match your filters."}</p>
                  {tasks.length === 0 && <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openNew}>+ Create First Task</button>}
                </div>
              ) : (
                <div className="task-grid">
                  {filteredTasks.map(t => (
                    <TaskCard key={t.id} task={t} onToggle={toggleTask} onEdit={openEdit} onDelete={deleteTask} />
                  ))}
                </div>
              )}
            </>
          )}
          {view === "analytics" && <AnalyticsView tasks={tasks} />}
          {view === "calendar" && <CalendarView tasks={tasks} onTaskClick={openEdit} />}
          {view === "ai" && <AIAssistantPanel tasks={tasks} />}
        </div>
      </div>

      {/* MODAL */}
      {modalOpen && (
        <TaskModal task={editTask} onSave={saveTask} onClose={() => { setModalOpen(false); setEditTask(null); }} addNotif={addNotif} />
      )}

      {/* NOTIFICATIONS */}
      <NotifStack notifications={notifications} onDismiss={id => setNotifications(n => n.filter(x => x.id !== id))} />
    </div>
  );
}
