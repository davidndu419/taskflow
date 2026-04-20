import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { model } from "./lib/gemini";
import { Task } from "./models";
import { GLOBAL_CSS } from "./styles";




// Reminder type suffixes for fired_reminders tracking
const REMINDER_TYPES = {
  "10m": { offset: 10 * 60 * 1000, prefKey: "pre10min", msg: "Due in 10 minutes — get on it!", notifType: "pre-10min" },
  "1hr": { offset: 60 * 60 * 1000, prefKey: "pre1hr", msg: "Due in 1 hour — plan ahead!", notifType: "pre-1hr" },
  "deadline": { offset: 0, prefKey: "deadline", msg: "This task is due right now!", notifType: "deadline" },
};

// ============================================================
// PERSISTENCE — localStorage-backed DB
// ============================================================
const DB = {
  save(tasks, onError) { 
    try { 
      localStorage.setItem("taskflow_tasks", JSON.stringify(tasks)); 
      return true;
    } catch (e) {
      console.error("Storage failed:", e);
      if (onError) onError(e);
      return false;
    }
  },
  load() {
    try {
      const raw = localStorage.getItem("taskflow_tasks");
      if (!raw) return [];
      return JSON.parse(raw).map(t => new Task(t));
    } catch { return []; }
  },
  saveName(name) { try { localStorage.setItem("taskflow_username", name); } catch {} },
  loadName() { try { return localStorage.getItem("taskflow_username") || ""; } catch { return ""; } },
  saveNotificationPrefs(prefs) { try { localStorage.setItem("taskflow_settings", JSON.stringify(prefs)); } catch {} },
  loadNotificationPrefs() {
    try {
      const raw = localStorage.getItem("taskflow_settings");
      if (!raw) return { enabled: true, pre10min: true, pre1hr: true, deadline: true, overdue: true };
      return JSON.parse(raw);
    } catch { return { enabled: true, pre10min: true, pre1hr: true, deadline: true, overdue: true }; }
  },
  // Fired reminders tracking
  loadFired() {
    try {
      const raw = localStorage.getItem("taskflow_fired_reminders");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },
  saveFired(arr) {
    try { localStorage.setItem("taskflow_fired_reminders", JSON.stringify(arr)); } catch {}
  },
  clearFiredForTask(taskId) {
    try {
      const fired = this.loadFired().filter(id => !id.startsWith(taskId + "-"));
      this.saveFired(fired);
    } catch {}
  },
  clearAllFired() {
    try { localStorage.removeItem("taskflow_fired_reminders"); } catch {}
  },
  saveTheme(theme) { try { localStorage.setItem("taskflow_theme", theme); } catch {} },
  loadTheme() { try { return localStorage.getItem("taskflow_theme") || "dark"; } catch { return "dark"; } },
  exportData() {
    try {
      const tasks = localStorage.getItem("taskflow_tasks") || "[]";
      const firedReminders = localStorage.getItem("taskflow_fired_reminders") || "[]";
      const settings = localStorage.getItem("taskflow_settings") || "{}";
      const username = localStorage.getItem("taskflow_username") || "";
      const theme = localStorage.getItem("taskflow_theme") || "dark";
      const backup = {
        version: "1.0.1",
        exportDate: new Date().toISOString(),
        tasks: JSON.parse(tasks),
        firedReminders: JSON.parse(firedReminders),
        settings: JSON.parse(settings),
        username: username,
        theme: theme
      };
      return JSON.stringify(backup, null, 2);
    } catch (e) {
      console.error("Export failed:", e);
      return null;
    }
  }
};

// ============================================================
// REMINDER ENGINE — scans tasks directly, uses fired_reminders
// ============================================================
const SAFETY_WINDOW_MS = 60 * 1000; // Only fire if trigger point was within last 60 seconds

function fireNotification(title, body, addNotif, notifType) {
  // Try browser Notification API first
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      const n = new Notification(title, {
        body,
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📌</text></svg>",
        tag: `taskflow-${notifType}-${Date.now()}`,
        silent: false,
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch {}
  }
  // Always also show in-app toast as fallback/supplement
  addNotif({ type: notifType, title, message: body });
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
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
// HELPER FUNCTIONS
// ============================================================
/** Parse datetime-local string → ISO 8601 (UTC). */
function datetimeLocalToISO(val) {
  if (val == null || String(val).trim() === "") return null;
  const d = new Date(String(val).trim());
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Build Task from modal fields — avoids spreading `form` (deadline/tags shapes differ from Task). */
function taskFromModalFields(baseTask, form, deadlineISO, tags) {
  const isEdit = !!baseTask?.id;
  return new Task({
    ...(isEdit ? baseTask : {}),
    title: (form.title || "").trim(),
    description: form.description ?? "",
    priority: form.priority || "medium",
    category: form.category || "General",
    status: form.status || "pending",
    recurring: !!form.recurring,
    recurringInterval: form.recurring ? (Number(form.recurringInterval) || 60) : null,
    deadline: deadlineISO,
    tags,
  });
}

/**
 * Build a Task from modal form state. Deadline comes only from datetimeLocalToISO(formData.deadline).
 */
function createTaskObject(formData, existingTask) {
  const tags = String(formData.tags ?? "").split(",").map(t => t.trim()).filter(Boolean);
  const deadlineISO = datetimeLocalToISO(formData.deadline);
  return taskFromModalFields(existingTask || null, formData, deadlineISO, tags);
}

/** Stored ISO instant → value for datetime-local (local components). */
function isoToDatetimeLocalValue(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDeadline(dt) {
  if (!dt) return null;
  const d = new Date(dt), now = new Date();
  const diff = d - now, abs = Math.abs(diff);
  const mins = Math.floor(abs / 6e4), hrs = Math.floor(abs / 36e5), days = Math.floor(abs / 864e5);
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}`;
  
  if (diff < 0) return { label: `${formattedDate} (${days > 0 ? days + "d " : ""}${hrs % 24}h overdue)`, cls: "overdue" };
  if (mins < 60) return { label: `${formattedDate} (${mins}m left)`, cls: "soon" };
  if (hrs < 24) return { label: `${formattedDate} (${hrs}h left)`, cls: hrs < 3 ? "soon" : "" };
  if (days < 3) return { label: `${formattedDate} (${days}d left)`, cls: "" };
  return { label: formattedDate, cls: "" };
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
// DELETE CONFIRMATION MODAL
// ============================================================
function DeleteConfirmModal({ confirmData, onConfirm, onCancel }) {
  const cancelBtnRef = useRef(null);

  useEffect(() => {
    if (confirmData && cancelBtnRef.current) {
      cancelBtnRef.current.focus();
    }
  }, [confirmData]);

  if (!confirmData) return null;
  
  const isClearAll = confirmData.type === 'clearAll';
  const isPastDeadline = confirmData.type === 'pastDeadline';
  
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div className="modal-title">
            {isClearAll ? 'Clear All Tasks?' : isPastDeadline ? 'Past Deadline Warning' : 'Delete Task?'}
          </div>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text2)' }}>
            {isClearAll 
              ? 'Are you sure you want to delete ALL tasks? This will permanently remove all your tasks, reminders, and progress data.'
              : isPastDeadline
              ? `The deadline you selected (${confirmData.deadlineDisplay}) has already passed. Do you want to save this task anyway?`
              : `Are you sure you want to delete "${confirmData.taskTitle}"?`
            }
          </p>
          {!isPastDeadline && (
            <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 12 }}>
              This action cannot be undone.
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button ref={cancelBtnRef} className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className={`btn ${isPastDeadline ? 'btn-primary' : 'btn-danger'}`} onClick={onConfirm}>
            {isClearAll ? 'Delete All Tasks' : isPastDeadline ? 'Save Anyway' : 'Delete Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CUSTOM DEADLINE PICKER — Calendar + 12-hour Time
// ============================================================
const MONTH_NAMES_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_NAMES_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_HEADERS = ["M","T","W","T","F","S","S"];

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

function DeadlinePicker({ value, onChange }) {
  // Parse "YYYY-MM-DDThh:mm" → parts
  const parts = useMemo(() => {
    const def = { day: 0, month: 0, year: 0, hour: 12, minute: 0, ampm: "PM" };
    if (!value) return def;
    const [datePart, timePart] = value.split("T");
    if (!datePart) return def;
    const [y, m, d] = datePart.split("-").map(Number);
    let hour = 12, minute = 0, ampm = "PM";
    if (timePart) {
      const [h24, min] = timePart.split(":").map(Number);
      minute = isNaN(min) ? 0 : min;
      hour = h24 % 12 || 12;
      ampm = h24 < 12 ? "AM" : "PM";
    }
    return { day: d || 0, month: m || 0, year: y || 0, hour, minute, ampm };
  }, [value]);

  const hasDate = parts.day > 0 && parts.month > 0 && parts.year > 0;
  const today = useMemo(() => new Date(), []);
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getFullYear();

  // Calendar view state
  const [viewMonth, setViewMonth] = useState(() => parts.month || todayMonth);
  const [viewYear, setViewYear] = useState(() => parts.year || todayYear);

  // Build calendar grid cells
  const calCells = useMemo(() => {
    const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0=Sun
    const offset = firstDow === 0 ? 6 : firstDow - 1; // Mon=0
    const totalDays = daysInMonth(viewMonth, viewYear);
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(0); // empty
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    return cells;
  }, [viewMonth, viewYear]);

  // Emit YYYY-MM-DDThh:mm
  function emit(changes) {
    const m = { ...parts, ...changes };
    if (!m.day || !m.month || !m.year) { onChange(""); return; }
    let h24 = m.hour % 12;
    if (m.ampm === "PM") h24 += 12;
    const ds = `${m.year}-${String(m.month).padStart(2,"0")}-${String(m.day).padStart(2,"0")}`;
    const ts = `${String(h24).padStart(2,"0")}:${String(m.minute).padStart(2,"0")}`;
    onChange(`${ds}T${ts}`);
  }

  function selectDay(d) {
    if (!d) return;
    const next = { day: d, month: viewMonth, year: viewYear };
    if (!hasDate) { next.hour = 12; next.minute = 0; next.ampm = "PM"; }
    else { next.hour = parts.hour; next.minute = parts.minute; next.ampm = parts.ampm; }
    emit(next);
  }

  function prevMonth() {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function isDayPast(d) {
    if (!d) return false;
    const sel = new Date(viewYear, viewMonth - 1, d, 23, 59, 59);
    return sel < today;
  }

  // Preview
  const preview = useMemo(() => {
    if (!hasDate) return null;
    return `${String(parts.day).padStart(2,"0")}/${String(parts.month).padStart(2,"0")}/${parts.year} at ${parts.hour}:${String(parts.minute).padStart(2,"0")} ${parts.ampm}`;
  }, [hasDate, parts]);

  // Past check
  const isPast = useMemo(() => {
    if (!hasDate) return false;
    let h24 = parts.hour % 12;
    if (parts.ampm === "PM") h24 += 12;
    return new Date(parts.year, parts.month - 1, parts.day, h24, parts.minute) < new Date();
  }, [hasDate, parts]);

  // Date display string
  const dateDisplay = hasDate
    ? `${String(parts.day).padStart(2,"0")}.${String(parts.month).padStart(2,"0")}.${parts.year}`
    : "Select a date";
  const timeDisplay = `${String(parts.hour).padStart(2,"0")}:${String(parts.minute).padStart(2,"0")} ${parts.ampm}`;

  return (
    <div className={`dp${hasDate ? " has-value" : ""}${isPast ? " is-past" : ""}`}>

      {/* DATE SECTION */}
      <div className="dp-section">
        <div className="dp-section-head">
          <div className="dp-section-label">
            <span className="dp-section-label-icon">📅</span> Date:
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="dp-section-value">{dateDisplay}</span>
            {hasDate && (
              <button type="button" className="dp-clear" onClick={() => onChange("")}>✕</button>
            )}
          </div>
        </div>

        {/* Calendar nav */}
        <div className="dp-cal-nav">
          <button type="button" className="dp-cal-btn" onClick={prevMonth}>‹</button>
          <span className="dp-cal-title">{MONTH_NAMES_FULL[viewMonth - 1]} {viewYear}</span>
          <button type="button" className="dp-cal-btn" onClick={nextMonth}>›</button>
        </div>

        {/* Calendar grid */}
        <div className="dp-cal-grid">
          {DAY_HEADERS.map((d, i) => <div key={i} className="dp-cal-dow">{d}</div>)}
          {calCells.map((d, i) => {
            if (d === 0) return <div key={`e${i}`} className="dp-cal-day empty" />;
            const isSelected = hasDate && d === parts.day && viewMonth === parts.month && viewYear === parts.year;
            const isToday = d === todayDay && viewMonth === todayMonth && viewYear === todayYear;
            const past = isDayPast(d);
            let cls = "dp-cal-day";
            if (isSelected) cls += " selected";
            if (isToday && !isSelected) cls += " today";
            if (past) cls += " past-day";
            return (
              <div key={d} className={cls} onClick={() => selectDay(d)}>
                {d}
              </div>
            );
          })}
        </div>
      </div>

      {/* TIME SECTION */}
      <div className={`dp-section dp-time-card${hasDate ? "" : " disabled"}`}>
        <div className="dp-section-head">
          <div className="dp-section-label">
            <span className="dp-section-label-icon">🕔</span> Time:
          </div>
          <span className="dp-section-value">{hasDate ? timeDisplay : "--:-- --"}</span>
        </div>
        <div className="dp-time-row">
          <select className="dp-time-sel" value={parts.hour} onChange={e => emit({ hour: +e.target.value })} disabled={!hasDate}>
            {[12,1,2,3,4,5,6,7,8,9,10,11].map(h => <option key={h} value={h}>{String(h).padStart(2,"0")}</option>)}
          </select>
          <span className="dp-time-colon">:</span>
          <select className="dp-time-sel" value={parts.minute} onChange={e => emit({ minute: +e.target.value })} disabled={!hasDate}>
            {Array.from({length:60},(_,i) => <option key={i} value={i}>{String(i).padStart(2,"0")}</option>)}
          </select>
          <div className="dp-ampm">
            <button type="button" className={`dp-ampm-btn${parts.ampm==="AM"?" active":""}`} onClick={() => hasDate && emit({ampm:"AM"})} disabled={!hasDate}>AM</button>
            <button type="button" className={`dp-ampm-btn${parts.ampm==="PM"?" active":""}`} onClick={() => hasDate && emit({ampm:"PM"})} disabled={!hasDate}>PM</button>
          </div>
        </div>
      </div>

      {/* PREVIEW / WARNING */}
      {preview && isPast ? (
        <div className="dp-preview past">
          <div className="dp-preview-icon">✗</div>
          <span className="dp-preview-text">Can't set a deadline in the past — <span className="dp-preview-date">{preview}</span></span>
        </div>
      ) : preview ? (
        <div className="dp-preview">
          <div className="dp-preview-icon">✓</div>
          <span className="dp-preview-text">Due <span className="dp-preview-date">{preview}</span></span>
        </div>
      ) : (
        <div className="dp-empty">Select a date from the calendar</div>
      )}
    </div>
  );
}

// ============================================================
// TASK FORM MODAL
// ============================================================
function TaskModal({ task, onAttemptSave, onClose, addNotif }) {
  const isEdit = !!task?.id;
  
  const [form, setForm] = useState({
    title: task?.title || "",
    description: task?.description || "",
    priority: task?.priority || "medium",
    deadline: isoToDatetimeLocalValue(task?.deadline),
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
      const prompt = `You are a smart task management assistant. When given a task title and some details, provide a brief suggestion (2-3 sentences max) covering: recommended priority level, realistic time estimate, and one actionable tip. Keep it concise and practical. Format your response with these labels: Priority: [level], Time: [estimate], Tip: [suggestion]\n\nTask: "${form.title}"\nDescription: "${form.description}"\nCategory: ${form.category}`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      if (!text) throw new Error("Empty response from Gemini");
      setAiSuggestion(text);
    } catch (error) {
      console.error("Gemini Suggestion Error:", error);
      setAiSuggestion("AI suggestion currently unavailable. (Check API key or CORS settings)");
    }
    setAiLoading(false);
  }

  function handleSave() {
    if (!form.title.trim()) return;
    onAttemptSave(form);
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
              <DeadlinePicker value={form.deadline} onChange={v => set("deadline", v)} />
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
          {false && (
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
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!form.title.trim()}>
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
        <button className="action-btn delete" onClick={() => onDelete(task.id, task.title)} title="Delete">✕</button>
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

  // Activity Trend (Creation/Completion)
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

  // Workload Trend (Upcoming Deadlines)
  const upcomingTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    const day = d.toDateString();
    return {
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      count: tasks.filter(t => t.deadline && new Date(t.deadline).toDateString() === day).length,
    };
  });
  const maxUpcoming = Math.max(...upcomingTrend.map(t => t.count), 1);

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
          <div className="chart-title">Activity (Past 7 Days)</div>
          <div className="trend-chart">
            {trend.map((t, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, alignItems: "stretch", justifyContent: "flex-end" }}>
                <div className="trend-bar" style={{ height: `${(t.created / maxTrend) * 70}px`, background: "var(--accent)", opacity: 0.5 }} data-tip={`Created: ${t.created}`} />
                <div className="trend-bar" style={{ height: `${(t.completed / maxTrend) * 70}px`, background: "var(--green)" }} data-tip={`Done: ${t.completed}`} />
              </div>
            ))}
          </div>
          <div className="trend-labels">{trend.map((t, i) => <div key={i} className="trend-label">{t.label}</div>)}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            {[["Created", "var(--accent)"], ["Completed", "var(--green)"]].map(([l, c]) => (
              <div key={l} className="legend-item"><div className="legend-dot" style={{ background: c }} />{l}</div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-title">Upcoming Workload</div>
          <div className="trend-chart">
            {upcomingTrend.map((t, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-end" }}>
                <div className="trend-bar" style={{ height: `${(t.count / maxUpcoming) * 70}px`, background: "var(--accent)" }} data-tip={`Deadlines: ${t.count}`} />
              </div>
            ))}
          </div>
          <div className="trend-labels">{upcomingTrend.map((t, i) => <div key={i} className="trend-label">{t.label}</div>)}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <div className="legend-item"><div className="legend-dot" style={{ background: "var(--accent)" }} />Tasks Due</div>
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
      try {
        const d = new Date(t.deadline);
        if (isNaN(d.getTime())) return false;
        return d.getFullYear() === viewYear && d.getMonth() === viewMonth && d.getDate() === day;
      } catch (e) {
        return false;
      }
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
    // 1. Pre-calculate the current interaction
    const userMsg = { role: "user", content: text };
    const historyBeforeThisMessage = messages.slice(1); // Exclude the initial assistant greeting
    
    // 2. Add user message to UI state
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const taskSummary = tasks.slice(0, 20).map(t =>
      `- "${t.title}" | Priority: ${t.priority} | Status: ${t.status} | Category: ${t.category}${t.deadline ? ` | Due: ${new Date(t.deadline).toLocaleDateString()}` : ""}${t.isOverdue() ? " [OVERDUE]" : ""}`
    ).join("\n");

    try {
      // 3. Prepare valid Gemini history (User must be first, no model first)
      const history = historyBeforeThisMessage.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const chat = model.startChat({
        history: history,
        generationConfig: {
          maxOutputTokens: 500,
        },
      });

      const systemInstruction = `You are an intelligent task management assistant. User's current tasks:\n${taskSummary || "No tasks yet."}\n\nHelp the user manage these tasks. Be concise (2-4 sentences max).`;
      
      const result = await chat.sendMessage(`Context: ${systemInstruction}\n\nUser Message: ${text}`);
      const response = await result.response;
      const reply = response.text();
      
      if (!reply) throw new Error("Empty response from Gemini");
      setMessages(m => [...m, { role: "assistant", content: reply }]);
    } catch (error) {
      console.error("Gemini Assistant Error:", error);
      const errMsg = error.message?.includes("CORS") 
        ? "AI Assistant error: CORS restriction. Gemini requires a backend for production, or specific local settings."
        : "AI Assistant unavailable. Please check your API key and connection.";
      setMessages(m => [...m, { role: "assistant", content: errMsg }]);
    }
    setLoading(false);
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div className="ai-indicator" />
        <div className="ai-panel-title">✦ AI Task Assistant</div>
        <div style={{ fontSize: 10, color: "var(--text3)" }}>Powered by Gemini</div>
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
export default function App() {
  const [tasks, setTasks] = useState(() => DB.load());
  const [notifications, setNotifications] = useState([]);
  const [view, setView] = useState("tasks");
  const [theme, setTheme] = useState(() => DB.loadTheme());
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortBy, setSortBy] = useState("urgency");
  const [userName, setUserName] = useState(() => DB.loadName());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState(() => DB.loadNotificationPrefs());
  const saveTimeoutRef = useRef(null);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    DB.saveTheme(theme);
  }, [theme]);

  // Inject CSS
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  // Global Escape key handler for modals
  useEffect(() => {
    function handleEscape(e) {
      if (e.key === "Escape") {
        if (deleteConfirmModal) {
          setDeleteConfirmModal(null);
        } else if (modalOpen) {
          setModalOpen(false);
          setEditTask(null);
        }
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [deleteConfirmModal, modalOpen]);

  // Notification helper
  const addNotif = useCallback((notif) => {
    const id = crypto.randomUUID();
    setNotifications(n => [...n, { ...notif, id }]);
  }, []);

  // Debounced Persist for tasks (500ms)
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      const success = DB.save(tasks, (error) => {
        addNotif({ 
          type: "overdue", 
          title: "Storage Error", 
          message: error.name === "QuotaExceededError" 
            ? "Storage full! Please delete some tasks or export your data." 
            : "Failed to save tasks. Your changes may not persist."
        });
      });
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [tasks, addNotif]);

  // Persist username
  useEffect(() => { DB.saveName(userName); }, [userName]);

  // Persist notification preferences
  useEffect(() => { DB.saveNotificationPrefs(notifPrefs); }, [notifPrefs]);

  function updateNotifPref(key, val) {
    setNotifPrefs(prev => ({ ...prev, [key]: val }));
  }

  const handleNameChange = (newName) => {
    setUserName(newName);
    addNotif({ type: "success", title: "Profile Updated", message: `Welcome, ${newName || "Guest"}!` });
  };

  const requestClearAll = () => {
    setDeleteConfirmModal({ type: 'clearAll' });
  };

  const requestDeleteTask = (id, title) => {
    setDeleteConfirmModal({ type: 'single', taskId: id, taskTitle: title });
  };

  const confirmDelete = () => {
    if (!deleteConfirmModal) return;
    
    if (deleteConfirmModal.type === 'single') {
      setTasks(prev => prev.filter(t => t.id !== deleteConfirmModal.taskId));
      DB.clearFiredForTask(deleteConfirmModal.taskId);
      addNotif({ type: 'info', title: 'Task Deleted', message: 'Task removed successfully' });
    } else if (deleteConfirmModal.type === 'clearAll') {
      setTasks([]);
      DB.clearAllFired();
      addNotif({ type: 'info', title: 'All Clear', message: 'All tasks have been deleted.' });
    }
    
    setDeleteConfirmModal(null);
  };

  const cancelDelete = () => {
    setDeleteConfirmModal(null);
  };

  // ========================================
  // BACKGROUND REMINDER ENGINE
  // ========================================
  // Request browser notification permission on mount
  useEffect(() => { requestNotificationPermission(); }, []);

  useEffect(() => {
    function checkReminders() {
      const now = new Date();
      const nowMs = now.getTime();

      // Load current fired list
      const fired = new Set(DB.loadFired());
      const prefs = notifPrefs; // captured from closure
      let firedChanged = false;

      // Scan every task
      tasks.forEach(task => {
        // Skip completed or tasks without deadlines
        if (!task.deadline || task.status === "completed") return;

        const dlMs = new Date(task.deadline).getTime();

        // Check each trigger point
        Object.entries(REMINDER_TYPES).forEach(([suffix, config]) => {
          const firedKey = `${task.id}-${suffix}`;
          if (fired.has(firedKey)) return; // already fired

          const triggerMs = dlMs - config.offset;

          // Has the trigger point been reached?
          if (nowMs >= triggerMs) {
            // SAFETY: only fire if trigger point was within the last 60 seconds
            // This prevents stale reminders firing when the app is first opened
            const elapsed = nowMs - triggerMs;
            if (elapsed > SAFETY_WINDOW_MS) {
              // Silently mark as fired without alerting
              fired.add(firedKey);
              firedChanged = true;
              return;
            }

            // Check notification preferences
            if (!prefs.enabled || prefs[config.prefKey] === false) {
              // Mark as fired but don't alert
              fired.add(firedKey);
              firedChanged = true;
              return;
            }

            // Fire the notification
            fireNotification(task.title, config.msg, addNotif, config.notifType);
            fired.add(firedKey);
            firedChanged = true;
          }
        });
      });

      // Auto-mark overdue tasks
      setTasks(prev => {
        let changed = false;
        const updated = prev.map(t => {
          if (
            t.deadline &&
            t.status !== "completed" &&
            t.status !== "overdue" &&
            new Date(t.deadline) < now
          ) {
            changed = true;
            return new Task({ ...t, status: "overdue" });
          }
          return t;
        });
        return changed ? updated : prev;
      });

      // Persist fired list if changed
      if (firedChanged) {
        DB.saveFired([...fired]);
      }
    }

    const interval = setInterval(checkReminders, 30000);
    checkReminders(); // Run immediately
    return () => clearInterval(interval);
  }, [tasks, addNotif, notifPrefs]);

  // CRUD — commit task first, then reset modal state (DB.save runs via useEffect on `tasks`).
  function executeFinalSave(task) {
    const isUpdate = tasks.some(t => t.id === task.id);

    // Clear old fired reminders for this task so new ones can reschedule
    DB.clearFiredForTask(task.id);

    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === task.id);
      if (idx >= 0) {
        const u = [...prev];
        u[idx] = task;
        return u;
      }
      return [...prev, task];
    });

    addNotif({
      type: "success",
      title: task.title,
      message: isUpdate ? "Task updated — reminders rescheduled!" : "Task created — reminders scheduled!",
    });

    setModalOpen(false);
    setEditTask(null);
  }

  function attemptSaveTask(form) {
    if (!form.title?.trim()) return;

    const deadlineISO = datetimeLocalToISO(form.deadline);
    if (form.deadline && String(form.deadline).trim() !== "" && deadlineISO == null) {
      addNotif({ type: "info", title: "Invalid deadline", message: "Please enter a valid date and time." });
      return;
    }

    // Block past deadlines entirely
    if (deadlineISO && new Date(deadlineISO) < new Date()) {
      addNotif({ type: "info", title: "Past deadline", message: "Can't set a deadline in the past. Please choose a future date and time." });
      return;
    }

    const built = createTaskObject(form, editTask);
    executeFinalSave(built);
  }

  function toggleTask(id) {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const newStatus = t.status === "completed" ? "pending" : "completed";
      const completedAt = newStatus === "completed" ? new Date().toISOString() : null;
      if (newStatus === "completed") addNotif({ type: "success", title: t.title, message: "Task completed! Great work!" });
      return new Task({ ...t, status: newStatus, completedAt });
    }));
  }

  function openEdit(task) { setEditTask(task); setModalOpen(true); }
  function openNew() { setEditTask(null); setModalOpen(true); }

  // Export Data
  function handleExportData() {
    const jsonData = DB.exportData();
    if (!jsonData) {
      addNotif({ type: "overdue", title: "Export Failed", message: "Could not export data. Please try again." });
      return;
    }
    
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const timestamp = new Date().toISOString().split('T')[0];
    link.download = `taskflow-backup-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    addNotif({ type: "success", title: "Backup Created", message: "Your tasks have been exported successfully!" });
  }

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
    // { id: "ai", icon: "✦", label: "AI Assistant" },
    { id: "settings", icon: "⚙", label: "Settings" },
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
            {view === "settings" && <>Settings <span>preferences</span></>}
          </div>
          {view === "tasks" && (
            <div className="search-box">
              <span className="search-icon">⌕</span>
              <input placeholder="Search tasks, tags…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          )}
          <button className="btn btn-ghost btn-icon" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} title="Toggle Theme">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          {tasks.length === 0 && <button className="btn btn-ghost btn-sm" onClick={seedDemo}>Load Demo</button>}
          <button className="btn btn-primary" onClick={openNew}>+ New Task</button>
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
                    <TaskCard key={t.id} task={t} onToggle={toggleTask} onEdit={openEdit} onDelete={(id, title) => requestDeleteTask(id, title)} />
                  ))}
                </div>
              )}
            </>
          )}
          {view === "analytics" && <AnalyticsView tasks={tasks} />}
          {view === "calendar" && <CalendarView tasks={tasks} onTaskClick={openEdit} />}
          {/* {view === "ai" && <AIAssistantPanel tasks={tasks} />} */}
          {view === "settings" && (
            <div className="settings-view">
              <div className="settings-card">
                <div className="settings-card-title">Account</div>
                <div className="form-group">
                  <label className="form-label">Your Name</label>
                  <input
                    className="form-input"
                    placeholder="Enter your name"
                    value={userName}
                    onChange={e => handleNameChange(e.target.value)}
                  />
                  <div className="form-hint">This name will be used to personalize your experience</div>
                </div>
              </div>
              
              <div className="settings-card">
                <div className="settings-card-title">Data Management</div>
                <div className="settings-item-row">
                  <div>
                    <div className="settings-item-label">Clear All Tasks</div>
                    <div className="settings-item-desc">Permanently delete all tasks and start fresh</div>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={requestClearAll}>Clear All</button>
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card-title">Notification Preferences</div>
                <div className={`notif-prefs${!notifPrefs.enabled ? " dimmed" : ""}`}>
                  {/* Master toggle */}
                  <div className="notif-pref-row master">
                    <span className="notif-pref-icon">🔔</span>
                    <div className="notif-pref-info">
                      <div className="notif-pref-label">Enable All Notifications</div>
                      <div className="notif-pref-desc">Master switch — turn off to silence everything</div>
                    </div>
                    <label className="toggle">
                      <input type="checkbox" checked={notifPrefs.enabled} onChange={e => updateNotifPref("enabled", e.target.checked)} />
                      <span className="toggle-track" />
                    </label>
                  </div>
                  {/* Individual toggles */}
                  {[
                    { key: "pre10min", icon: "⏰", label: "10-Minute Reminder", desc: "Get alerted 10 minutes before a deadline" },
                    { key: "pre1hr",  icon: "🕐", label: "1-Hour Reminder",    desc: "Get alerted 1 hour before a deadline" },
                    { key: "deadline", icon: "🔔", label: "Deadline Reminder",  desc: "Get alerted when a task is due right now" },
                    { key: "overdue",  icon: "🚨", label: "Overdue Alerts",     desc: "Get alerted when a task passes its deadline" },
                  ].map(item => (
                    <div key={item.key} className="notif-pref-row">
                      <span className="notif-pref-icon">{item.icon}</span>
                      <div className="notif-pref-info">
                        <div className="notif-pref-label">{item.label}</div>
                        <div className="notif-pref-desc">{item.desc}</div>
                      </div>
                      <label className="toggle">
                        <input type="checkbox" checked={notifPrefs[item.key] !== false} onChange={e => updateNotifPref(item.key, e.target.checked)} />
                        <span className="toggle-track" />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card-title">About</div>
                <div className="settings-about">
                  <div className="settings-about-item">
                    <span className="settings-about-label">Version</span>
                    <span className="settings-about-value">1.0.0</span>
                  </div>
                  <div className="settings-about-item">
                    <span className="settings-about-label">Total Tasks</span>
                    <span className="settings-about-value">{totalCount}</span>
                  </div>
                  <div className="settings-about-item">
                    <span className="settings-about-label">Completed</span>
                    <span className="settings-about-value">{completedCount}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}
      {modalOpen && (
        <TaskModal
          key={editTask?.id ?? "new"}
          task={editTask}
          onAttemptSave={attemptSaveTask}
          onClose={() => { setModalOpen(false); setEditTask(null); }}
          addNotif={addNotif}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <DeleteConfirmModal 
        confirmData={deleteConfirmModal} 
        onConfirm={confirmDelete} 
        onCancel={cancelDelete} 
      />

      {/* NOTIFICATIONS */}
      <NotifStack notifications={notifications} onDismiss={id => setNotifications(n => n.filter(x => x.id !== id))} />
    </div>
  );
}
