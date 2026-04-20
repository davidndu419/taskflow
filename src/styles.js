export const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@400;600;700;800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
/* Default (Dark) */
:root, [data-theme='dark'] {
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
  --transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* Light Theme Override */
html[data-theme='light'] {
  --bg: #f8fafc;
  --bg2: #ffffff;
  --bg3: #f1f5f9;
  --bg4: #e2e8f0;
  --border: rgba(0,0,0,0.06);
  --border2: rgba(0,0,0,0.12);
  --text: #0f172a;
  --text2: #475569;
  --text3: #94a3b8;
  --accent: #6366f1;
  --accent2: #8b5cf6;
  --accent-glow: rgba(99,102,241,0.2);
  --red: #f43f5e;
  --green: #10b981;
  --yellow: #eab308;
  --orange: #f59e0b;
}

html, body { 
  background: var(--bg); 
  color: var(--text); 
  min-height: 100vh; 
  transition: background 0.3s ease, color 0.3s ease;
}
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
  border-bottom: 1px solid var(--border); background: var(--bg);
  backdrop-filter: blur(16px); position: sticky; top: 0; z-index: 9;
  min-height: 72px;
}
.topbar-title { 
  font-family: var(--display); font-size: 22px; font-weight: 800; 
  letter-spacing: -0.5px; flex: 1; display: flex; align-items: center;
  line-height: 1;
}
.topbar-title span { 
  color: var(--text3); font-weight: 400; font-size: 14px; 
  margin-left: 8px; font-family: var(--mono); 
}
.search-box {
  display: flex; align-items: center; gap: 8px; background: var(--bg3);
  border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 12px;
  transition: all 0.2s; width: 220px; height: 40px;
}
.search-box:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
.search-box input { background: none; border: none; outline: none; font-family: var(--mono); font-size: 12px; color: var(--text); width: 100%; }
.search-box input::placeholder { color: var(--text3); }
.search-icon { color: var(--text3); font-size: 13px; }
.btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
  border-radius: var(--radius-sm); border: none; cursor: pointer; font-family: var(--mono);
  font-size: 12px; font-weight: 700; transition: all 0.15s; letter-spacing: 0.5px;
  height: 40px;
}
.btn-primary { background: var(--accent); color: white; }
.btn-primary:hover { background: var(--accent2); transform: translateY(-1px); box-shadow: 0 4px 20px var(--accent-glow); }
.btn-ghost { background: transparent; color: var(--text2); border: 1px solid var(--border); }
.btn-icon { width: 40px; height: 40px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 16px; }
.btn-ghost:hover { background: var(--bg4); color: var(--text); border-color: var(--border2); }
.btn-danger { background: rgba(255,59,59,0.15); color: var(--red); border: 1px solid rgba(255,59,59,0.2); }
.btn-danger:hover { background: rgba(255,59,59,0.25); }
.btn-sm { padding: 5px 10px; font-size: 11px; height: 32px; }

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
  cursor: pointer; transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); 
  position: relative; overflow: hidden;
  animation: slideIn 0.25s ease forwards;
}
.task-card::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; transition: width 0.3s ease; }
.task-card.priority-critical::before { background: var(--red); box-shadow: 2px 0 10px rgba(255, 59, 59, 0.4); }
.task-card.priority-high::before { background: var(--orange); box-shadow: 2px 0 10px rgba(255, 140, 0, 0.4); }
.task-card.priority-medium::before { background: var(--yellow); box-shadow: 2px 0 10px rgba(240, 192, 64, 0.4); }
.task-card.priority-low::before { background: var(--green); box-shadow: 2px 0 10px rgba(74, 222, 128, 0.4); }
.task-card:hover { 
  border-color: var(--border2); background: var(--bg3); 
  transform: translateY(-2px) scale(1.01); 
  box-shadow: 0 10px 25px rgba(0,0,0,0.4);
}
.task-card:hover::before { width: 5px; }
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

/* DEADLINE PICKER */
.dp {
  background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 16px; display: flex; flex-direction: column; gap: 14px;
  position: relative; overflow: hidden; transition: border-color 0.3s, box-shadow 0.3s;
}
.dp.has-value {
  border-color: rgba(124,106,255,0.25);
  box-shadow: 0 0 0 1px rgba(124,106,255,0.08), 0 4px 20px rgba(0,0,0,0.15);
}
.dp::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, var(--accent), var(--accent2), var(--accent));
  opacity: 0; transition: opacity 0.3s;
}
.dp.has-value::before { opacity: 1; }
.dp.is-past { border-color: rgba(255,59,59,0.25); }
.dp.is-past::before { background: linear-gradient(90deg, var(--red), #ff6b6b, var(--red)); opacity: 1; }

/* -- Section cards (Date + Time) -- */
.dp-section {
  background: var(--bg4); border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 12px 14px; transition: all 0.2s;
}
.dp-section-head {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
}
.dp-section-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 10px; color: var(--text3); letter-spacing: 1.5px;
  text-transform: uppercase; font-family: var(--mono); font-weight: 700;
}
.dp-section-label-icon {
  width: 22px; height: 22px; border-radius: 6px;
  background: rgba(124,106,255,0.12); display: flex;
  align-items: center; justify-content: center; font-size: 11px;
}
.dp-section-value {
  font-family: var(--display); font-size: 15px; font-weight: 700;
  color: var(--text); letter-spacing: 0.3px;
}
.dp-clear {
  display: flex; align-items: center; gap: 4px;
  padding: 3px 10px; border-radius: 20px; border: 1px solid rgba(255,59,59,0.2);
  background: rgba(255,59,59,0.06); color: var(--red); cursor: pointer;
  font-family: var(--mono); font-size: 10px; font-weight: 700;
  transition: all 0.2s; letter-spacing: 0.5px;
}
.dp-clear:hover { background: rgba(255,59,59,0.15); border-color: rgba(255,59,59,0.4); transform: translateY(-1px); }

/* -- Calendar -- */
.dp-cal-nav {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
}
.dp-cal-title {
  font-family: var(--display); font-size: 14px; font-weight: 700; color: var(--text);
}
.dp-cal-btn {
  width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border);
  background: var(--bg3); color: var(--text2); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; transition: all 0.15s; padding: 0;
}
.dp-cal-btn:hover { background: var(--bg2); border-color: var(--accent); color: var(--accent); }
.dp-cal-grid {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;
}
.dp-cal-dow {
  text-align: center; font-size: 9px; font-family: var(--mono); font-weight: 700;
  color: var(--text3); letter-spacing: 1px; padding: 4px 0; text-transform: uppercase;
}
.dp-cal-day {
  text-align: center; padding: 6px 2px; border-radius: 6px; font-size: 12px;
  font-family: var(--mono); font-weight: 600; cursor: pointer;
  color: var(--text2); transition: all 0.12s; border: 1px solid transparent;
  line-height: 1;
}
.dp-cal-day:hover { background: var(--bg2); color: var(--text); border-color: var(--border); }
.dp-cal-day.today { color: var(--accent); border-color: rgba(124,106,255,0.3); }
.dp-cal-day.selected {
  background: var(--accent); color: white; border-color: var(--accent);
  box-shadow: 0 2px 8px var(--accent-glow);
}
.dp-cal-day.selected.past-day {
  background: var(--red); border-color: var(--red);
  box-shadow: 0 2px 8px rgba(255,59,59,0.3);
}
.dp-cal-day.past-day:not(.selected) { color: var(--text3); opacity: 0.4; }
.dp-cal-day.empty { cursor: default; }
.dp-cal-day.empty:hover { background: transparent; border-color: transparent; }

/* -- Time section -- */
.dp-time-card { transition: all 0.3s; }
.dp-time-card.disabled { opacity: 0.3; pointer-events: none; filter: grayscale(0.5); }
.dp-time-row {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
}
.dp-time-sel {
  background: var(--bg3); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text); font-family: var(--mono); font-size: 18px; font-weight: 700;
  padding: 6px 4px 6px 12px; cursor: pointer; outline: none;
  transition: all 0.2s; min-width: 60px; text-align: center;
}
.dp-time-sel:hover { border-color: var(--border2); background: var(--bg2); }
.dp-time-sel:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }
.dp-time-sel option { background: var(--bg2); color: var(--text); font-size: 14px; }
.dp-time-colon {
  font-size: 22px; font-weight: 800; color: var(--accent);
  line-height: 1; padding: 0 1px; font-family: var(--display);
}
.dp-ampm {
  display: flex; margin-left: auto; border-radius: 8px;
  background: var(--bg3); border: 1px solid var(--border);
  padding: 3px; gap: 3px;
}
.dp-ampm-btn {
  padding: 7px 14px; border-radius: 6px; border: none;
  font-family: var(--mono); font-size: 12px; font-weight: 700;
  cursor: pointer; transition: all 0.2s ease; letter-spacing: 1px;
  background: transparent; color: var(--text3);
}
.dp-ampm-btn:hover { color: var(--text); background: var(--bg2); }
.dp-ampm-btn.active {
  background: var(--accent); color: white;
  box-shadow: 0 2px 8px var(--accent-glow);
}

/* -- Preview banner -- */
.dp-preview {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-radius: var(--radius-sm);
  background: rgba(74,222,128,0.06); border: 1px solid rgba(74,222,128,0.15);
  animation: slideIn 0.25s ease;
}
.dp-preview.past {
  background: rgba(255,59,59,0.06); border-color: rgba(255,59,59,0.2);
}
.dp-preview-icon {
  width: 22px; height: 22px; border-radius: 50%;
  background: rgba(74,222,128,0.15); display: flex;
  align-items: center; justify-content: center; font-size: 11px;
  color: var(--green); flex-shrink: 0;
}
.dp-preview.past .dp-preview-icon { background: rgba(255,59,59,0.15); color: var(--red); }
.dp-preview-text {
  font-size: 12px; color: var(--green); font-weight: 600;
  font-family: var(--mono); letter-spacing: 0.3px; line-height: 1.3;
}
.dp-preview.past .dp-preview-text { color: var(--red); }
.dp-preview-date { color: var(--text); font-weight: 700; }
.dp-preview.past .dp-preview-date { color: var(--red); opacity: 0.8; }
.dp-empty {
  text-align: center; padding: 6px 0; font-size: 11px;
  color: var(--text3); font-style: italic;
}
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
.trend-bar { border-radius: 3px 3px 0 0; transition: height 0.4s ease; position: relative; cursor: pointer; }
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

/* SETTINGS VIEW */
.settings-view { display: flex; flex-direction: column; gap: 20px; max-width: 800px; }
.settings-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; }
.settings-card-title { font-family: var(--display); font-size: 16px; font-weight: 700; margin-bottom: 20px; color: var(--text); }
.settings-item-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.settings-item-label { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
.settings-item-desc { font-size: 11px; color: var(--text3); line-height: 1.5; }
.form-hint { font-size: 10px; color: var(--text3); margin-top: 6px; }
.settings-about { display: flex; flex-direction: column; gap: 12px; }
.settings-about-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); }
.settings-about-item:last-child { border-bottom: none; }
.settings-about-label { font-size: 12px; color: var(--text2); }
.settings-about-value { font-size: 12px; font-weight: 700; color: var(--text); font-family: var(--mono); }

/* NOTIFICATION TOGGLE ROWS */
.notif-prefs { display: flex; flex-direction: column; gap: 6px; }
.notif-prefs.dimmed .notif-pref-row:not(.master) {
  opacity: 0.3; pointer-events: none; filter: grayscale(0.6);
}
.notif-pref-row {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 16px; border-radius: 10px;
  background: var(--bg2); border: 1px solid var(--border);
  backdrop-filter: blur(8px); transition: all 0.2s;
}
.notif-pref-row:hover { border-color: var(--border2); background: var(--bg3); }
.notif-pref-row.master {
  background: var(--bg3); border-color: var(--accent);
  margin-bottom: 4px;
}
.notif-pref-info { flex: 1; min-width: 0; }
.notif-pref-label {
  font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 2px;
}
.notif-pref-desc { font-size: 10px; color: var(--text3); line-height: 1.4; }
.notif-pref-icon {
  width: 28px; height: 28px; border-radius: 8px;
  background: var(--bg4); display: flex;
  align-items: center; justify-content: center; font-size: 13px;
  flex-shrink: 0; margin-right: 4px;
}

/* Toggle Switch */
.toggle {
  position: relative; width: 44px; height: 24px; flex-shrink: 0;
}
.toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.toggle-track {
  position: absolute; inset: 0; border-radius: 12px; cursor: pointer;
  background: var(--bg4); border: 1px solid var(--border2);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.toggle-track::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--text3); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.toggle input:checked + .toggle-track {
  background: var(--accent); border-color: var(--accent);
}
.toggle input:checked + .toggle-track::after {
  transform: translateX(20px);
  background: white;
  box-shadow: 0 0 8px var(--accent-glow), 0 1px 3px rgba(0,0,0,0.3);
}
.toggle input:focus-visible + .toggle-track {
  box-shadow: 0 0 0 3px rgba(234,179,8,0.2);
}


/* MOBILE RESPONSIVE */
@media (max-width: 768px) {
  .app-wrapper { flex-direction: column; }
  
  /* Hamburger Menu */
  .hamburger {
    display: flex; flex-direction: column; gap: 4px; background: none; border: none;
    cursor: pointer; padding: 8px; border-radius: 6px; transition: all 0.2s;
    height: 40px; justify-content: center;
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
  
  .search-box { width: 100%; max-width: none; order: 10; margin-top: 12px; height: 44px; }
  .btn { padding: 7px 12px; font-size: 11px; height: 44px; }
  .btn-sm { padding: 5px 8px; font-size: 10px; height: 36px; }
  
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
  
  .settings-view { max-width: 100%; }
  .settings-card { padding: 16px; }
  .settings-item-row { flex-direction: column; align-items: flex-start; }
  
  /* Deadline picker mobile */
  .dp { padding: 12px; gap: 10px; }
  .dp-section { padding: 10px 12px; }
  .dp-section-head { margin-bottom: 8px; flex-wrap: wrap; gap: 6px; }
  .dp-section-value { font-size: 13px; }
  .dp-cal-day { padding: 5px 1px; font-size: 11px; }
  .dp-cal-title { font-size: 13px; }
  .dp-time-sel { font-size: 16px; min-width: 54px; padding: 5px 3px 5px 10px; }
  .dp-time-colon { font-size: 18px; }
  .dp-ampm { margin-left: 0; flex: 0 0 auto; }
  .dp-ampm-btn { padding: 6px 12px; font-size: 11px; }
  .dp-time-row { gap: 5px; }
}

@media (min-width: 769px) {
  .hamburger { display: none; }
  .mobile-close { display: none; }
}

@media (max-width: 480px) {
  .topbar-title { font-size: 16px; }
  .task-card { padding: 12px; }
  .dp-preview-text { font-size: 11px; }
}
`;
