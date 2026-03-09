import { useState, useEffect, useRef, useCallback } from "react";
import { initGoogle, initTokenClient, signIn, signOut, isSignedIn, loadFromDrive, saveToDrive } from "./drive";

// ── Constants ──────────────────────────────────────────────────────────────────
const SUBJECTS = ["Math","Science","English","History","Computer Science","Art","Music","PE","Foreign Language","Other"];
const PRIORITIES = ["Low","Medium","High","Critical"];
const TYPES = ["Essay","Problem Set","Lab Report","Reading","Project","Presentation","Quiz Prep","Other"];
const COLORS = {
  Math:"#f59e0b", Science:"#10b981", English:"#6366f1", History:"#ef4444",
  "Computer Science":"#06b6d4", Art:"#ec4899", Music:"#8b5cf6",
  PE:"#84cc16", "Foreign Language":"#f97316", Other:"#94a3b8"
};
const PRI_COLORS = { Low:"#64748b", Medium:"#f59e0b", High:"#f97316", Critical:"#ef4444" };

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDay(year, month) { return new Date(year, month, 1).getDay(); }
function dateStr(d) { return d.toISOString().split("T")[0]; }
function today() { return dateStr(new Date()); }

async function callClaude(systemPrompt, userPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });
  const data = await res.json();
  return data.content?.[0]?.text || "No response.";
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("dashboard");
  const [assignments, setAssignments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);
  const [driveReady, setDriveReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const saveTimer = useRef(null);

  // Init Google APIs
  useEffect(() => {
    const waitForGapi = setInterval(() => {
      if (window.gapi && window.google) {
        clearInterval(waitForGapi);
        initGoogle().then(() => {
          initTokenClient(
            async () => {
              setSignedIn(true);
              setSyncing(true);
              const data = await loadFromDrive();
              setAssignments(data);
              setSyncing(false);
              showToast("Synced with Google Drive ✓");
            },
            (err) => { showToast("Sign in failed: " + err, "error"); }
          );
          setDriveReady(true);
        });
      }
    }, 200);
    return () => clearInterval(waitForGapi);
  }, []);

  // Auto-save to Drive whenever assignments change
  useEffect(() => {
    if (!signedIn || assignments.length === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveToDrive(assignments);
    }, 1500);
  }, [assignments, signedIn]);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function addAssignment(a) {
    setAssignments(prev => [...prev, { ...a, id: Date.now(), done: false, createdAt: today() }]);
    showToast("Assignment saved to Drive ✓");
    setView("dashboard");
  }
  function toggleDone(id) { setAssignments(prev => prev.map(a => a.id === id ? { ...a, done: !a.done } : a)); }
  function deleteAssignment(id) { setAssignments(prev => prev.filter(a => a.id !== id)); showToast("Deleted.", "error"); }
  function updateAssignment(id, patch) { setAssignments(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a)); }

  function handleSignIn() { if (driveReady) signIn(); }
  function handleSignOut() { signOut(); setSignedIn(false); setAssignments([]); showToast("Signed out.", "error"); }

  if (!signedIn) {
    return (
      <div style={styles.root}>
        <style>{globalCSS}</style>
        <div style={styles.loginPage}>
          <div style={styles.loginCard}>
            <div style={styles.loginLogo}>
              <span style={{ fontSize: 48, color: "#6366f1" }}>◉</span>
              <h1 style={styles.loginTitle}>StudyOS</h1>
              <p style={styles.loginSub}>Your AI-powered assignment tracker</p>
            </div>
            <div style={styles.loginFeatures}>
              {["Track assignments across all subjects", "AI suggestions & study scheduling", "Synced to your Google Drive", "Access from any device"].map(f => (
                <div key={f} style={styles.loginFeature}><span style={{ color: "#6366f1", marginRight: 10 }}>◆</span>{f}</div>
              ))}
            </div>
            <button style={styles.googleBtn} onClick={handleSignIn} disabled={!driveReady}>
              <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: 10 }}>
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
              </svg>
              {driveReady ? "Continue with Google" : "Loading…"}
            </button>
            <p style={styles.loginNote}>Your data is saved privately in your own Google Drive.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <style>{globalCSS}</style>
      <Sidebar view={view} setView={setView} assignments={assignments} onSignOut={handleSignOut} syncing={syncing} />
      <main style={styles.main}>
        {syncing && <div style={styles.syncBar}>⟳ Syncing with Google Drive…</div>}
        {view === "dashboard" && <Dashboard assignments={assignments} onSelect={a => { setSelected(a); setView("detail"); }} onToggle={toggleDone} onDelete={deleteAssignment} onAdd={() => setView("add")} />}
        {view === "add" && <AddForm onSave={addAssignment} onCancel={() => setView("dashboard")} />}
        {view === "calendar" && <CalendarView assignments={assignments} />}
        {view === "ai" && <AIHub assignments={assignments} />}
        {view === "detail" && selected && (
          <DetailView
            assignment={assignments.find(a => a.id === selected.id) || selected}
            onBack={() => setView("dashboard")}
            onToggle={toggleDone}
            onDelete={id => { deleteAssignment(id); setView("dashboard"); }}
            onUpdate={updateAssignment}
          />
        )}
      </main>
      {toast && <div style={{ ...styles.toast, background: toast.type === "error" ? "#ef4444" : "#10b981" }}>{toast.msg}</div>}
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({ view, setView, assignments, onSignOut, syncing }) {
  const pending = assignments.filter(a => !a.done).length;
  const overdue = assignments.filter(a => !a.done && a.dueDate < today()).length;
  const navItems = [
    { id: "dashboard", icon: "⊞", label: "Dashboard" },
    { id: "add", icon: "＋", label: "New Assignment" },
    { id: "calendar", icon: "◫", label: "Calendar" },
    { id: "ai", icon: "◈", label: "AI Assistant" },
  ];
  return (
    <nav style={styles.sidebar}>
      <div style={styles.logo}>
        <span style={styles.logoMark}>◉</span>
        <span style={styles.logoText}>StudyOS</span>
      </div>
      <div style={styles.statsRow}>
        <div style={styles.statChip}><span style={{ color: "#f59e0b" }}>◆</span> {pending} pending</div>
        {overdue > 0 && <div style={{ ...styles.statChip, color: "#ef4444" }}><span>!</span> {overdue} overdue</div>}
        {syncing && <div style={{ ...styles.statChip, color: "#6366f1" }}>⟳ syncing…</div>}
      </div>
      {navItems.map(n => (
        <button key={n.id} style={{ ...styles.navBtn, ...(view === n.id ? styles.navBtnActive : {}) }} onClick={() => setView(n.id)}>
          <span style={styles.navIcon}>{n.icon}</span><span>{n.label}</span>
        </button>
      ))}
      <div style={styles.sidebarFooter}>
        <div style={styles.driveIndicator}>
          <svg width="14" height="14" viewBox="0 0 87.3 78" style={{ marginRight: 6 }}>
            <path fill="#0066DA" d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z"/>
            <path fill="#00AC47" d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 48.75c-.8 1.4-1.2 2.95-1.2 4.5h27.5z"/>
            <path fill="#EA4335" d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z"/>
            <path fill="#00832D" d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z"/>
            <path fill="#2684FC" d="M59.8 53.25H27.5L13.75 77.05c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"/>
            <path fill="#FFBA00" d="M73.4 26.5l-25.2-43.6c-1.35-.8-2.9-1.2-4.5-1.2s-3.15.45-4.5 1.2L57.4 1.2 73.4 26.5c.8 1.4 1.2 2.95 1.2 4.5s-.4 3.1-1.2 4.5l-12.85 22.25h27.45c0-1.55-.4-3.1-1.2-4.5z"/>
          </svg>
          <span style={{ fontSize: 11, color: "#475569" }}>Drive sync on</span>
        </div>
        <button style={styles.signOutBtn} onClick={onSignOut}>Sign out</button>
      </div>
    </nav>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
function Dashboard({ assignments, onSelect, onToggle, onDelete, onAdd }) {
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("dueDate");

  const sorted = [...assignments]
    .filter(a => filter === "all" ? true : filter === "done" ? a.done : !a.done)
    .sort((a, b) => {
      if (sortBy === "dueDate") return (a.dueDate || "").localeCompare(b.dueDate || "");
      if (sortBy === "priority") return PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority);
      if (sortBy === "subject") return (a.subject || "").localeCompare(b.subject || "");
      return 0;
    });

  const upcoming = assignments.filter(a => !a.done && a.dueDate >= today()).slice(0, 3);

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Dashboard</h1>
          <p style={styles.pageSubtitle}>Track, manage, and conquer your assignments.</p>
        </div>
        <button style={styles.primaryBtn} onClick={onAdd}>＋ Add Assignment</button>
      </div>
      <div style={styles.summaryGrid}>
        {[
          { label: "Total", val: assignments.length, icon: "◧", color: "#6366f1" },
          { label: "Pending", val: assignments.filter(a => !a.done).length, icon: "◷", color: "#f59e0b" },
          { label: "Completed", val: assignments.filter(a => a.done).length, icon: "◉", color: "#10b981" },
          { label: "Overdue", val: assignments.filter(a => !a.done && a.dueDate < today()).length, icon: "◈", color: "#ef4444" },
        ].map(c => (
          <div key={c.label} style={{ ...styles.summaryCard, borderTopColor: c.color }}>
            <div style={{ ...styles.summaryIcon, color: c.color }}>{c.icon}</div>
            <div style={styles.summaryVal}>{c.val}</div>
            <div style={styles.summaryLabel}>{c.label}</div>
          </div>
        ))}
      </div>
      {upcoming.length > 0 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>⚡ Coming Up</h2>
          <div style={styles.upcomingRow}>
            {upcoming.map(a => (
              <div key={a.id} style={{ ...styles.upcomingCard, borderLeftColor: COLORS[a.subject] || "#94a3b8" }} onClick={() => onSelect(a)}>
                <div style={styles.upcomingSubject}>{a.subject}</div>
                <div style={styles.upcomingTitle}>{a.title}</div>
                <div style={styles.upcomingDue}>Due {a.dueDate}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={styles.filterBar}>
        <div style={styles.filterGroup}>
          {["all","pending","done"].map(f => (
            <button key={f} style={{ ...styles.filterBtn, ...(filter === f ? styles.filterBtnActive : {}) }} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <select style={styles.select} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="dueDate">Sort: Due Date</option>
          <option value="priority">Sort: Priority</option>
          <option value="subject">Sort: Subject</option>
        </select>
      </div>
      {sorted.length === 0 ? (
        <div style={styles.empty}><div style={styles.emptyIcon}>◎</div><p>No assignments here. Add one to get started!</p></div>
      ) : (
        <div style={styles.assignList}>
          {sorted.map(a => <AssignmentRow key={a.id} a={a} onSelect={onSelect} onToggle={onToggle} onDelete={onDelete} />)}
        </div>
      )}
    </div>
  );
}

function AssignmentRow({ a, onSelect, onToggle, onDelete }) {
  const isOverdue = !a.done && a.dueDate < today();
  return (
    <div style={{ ...styles.assignRow, opacity: a.done ? 0.55 : 1 }}>
      <button style={styles.checkBtn} onClick={() => onToggle(a.id)}>
        <span style={{ ...styles.checkMark, background: a.done ? "#10b981" : "transparent", borderColor: a.done ? "#10b981" : "#475569" }}>
          {a.done ? "✓" : ""}
        </span>
      </button>
      <div style={{ ...styles.subjectDot, background: COLORS[a.subject] || "#94a3b8" }} />
      <div style={styles.assignInfo} onClick={() => onSelect(a)}>
        <div style={{ ...styles.assignTitle, textDecoration: a.done ? "line-through" : "none" }}>{a.title}</div>
        <div style={styles.assignMeta}>
          <span>{a.subject}</span><span style={styles.metaDot}>·</span>
          <span>{a.type}</span><span style={styles.metaDot}>·</span>
          <span style={{ color: isOverdue ? "#ef4444" : "#94a3b8" }}>{isOverdue ? "⚠ " : ""}Due {a.dueDate}</span>
        </div>
      </div>
      <div style={{ ...styles.priTag, background: PRI_COLORS[a.priority] + "22", color: PRI_COLORS[a.priority] }}>{a.priority}</div>
      <button style={styles.deleteBtn} onClick={() => onDelete(a.id)}>✕</button>
    </div>
  );
}

// ── Add Form ───────────────────────────────────────────────────────────────────
function AddForm({ onSave, onCancel }) {
  const [form, setForm] = useState({
    title: "", subject: "Math", type: "Essay", priority: "Medium",
    dueDate: "", estimatedHours: "", instructions: "", notes: "", attachments: []
  });
  const [importing, setImporting] = useState(false);
  const [gdUrl, setGdUrl] = useState("");
  const fileRef = useRef();

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function handleFiles(files) {
    const names = Array.from(files).map(f => f.name);
    set("attachments", [...form.attachments, ...names]);
  }
  async function importGDrive() {
    if (!gdUrl) return;
    setImporting(true);
    await new Promise(r => setTimeout(r, 1200));
    set("attachments", [...form.attachments, `[Google Drive] ${gdUrl.split("/").pop() || "document"}`]);
    setGdUrl(""); setImporting(false);
  }
  function submit() {
    if (!form.title || !form.dueDate) return alert("Please fill in Title and Due Date.");
    onSave(form);
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div><h1 style={styles.pageTitle}>New Assignment</h1><p style={styles.pageSubtitle}>Fill in the details below.</p></div>
        <button style={styles.ghostBtn} onClick={onCancel}>← Back</button>
      </div>
      <div style={styles.formGrid}>
        <div style={styles.formCol}>
          <FormField label="Assignment Title *">
            <input style={styles.input} value={form.title} placeholder="e.g. Newton's Laws Essay" onChange={e => set("title", e.target.value)} />
          </FormField>
          <div style={styles.formRow2}>
            <FormField label="Subject">
              <select style={styles.input} value={form.subject} onChange={e => set("subject", e.target.value)}>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Type">
              <select style={styles.input} value={form.type} onChange={e => set("type", e.target.value)}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </FormField>
          </div>
          <div style={styles.formRow2}>
            <FormField label="Due Date *">
              <input type="date" style={styles.input} value={form.dueDate} onChange={e => set("dueDate", e.target.value)} />
            </FormField>
            <FormField label="Priority">
              <select style={styles.input} value={form.priority} onChange={e => set("priority", e.target.value)}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Estimated Hours">
            <input type="number" style={styles.input} value={form.estimatedHours} placeholder="e.g. 3" min="0.5" step="0.5" onChange={e => set("estimatedHours", e.target.value)} />
          </FormField>
          <FormField label="Notes">
            <textarea style={{ ...styles.input, ...styles.textarea }} rows={3} value={form.notes} placeholder="Any personal notes…" onChange={e => set("notes", e.target.value)} />
          </FormField>
        </div>
        <div style={styles.formCol}>
          <FormField label="Assignment Instructions (for AI suggestions)">
            <textarea style={{ ...styles.input, ...styles.textarea, minHeight: 130 }} rows={5}
              value={form.instructions} placeholder="Paste the full assignment instructions here. The AI will use this to give you tailored suggestions."
              onChange={e => set("instructions", e.target.value)} />
          </FormField>
          <FormField label="Attachments">
            <div style={styles.uploadZone} onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileRef.current?.click()}>
              <div style={styles.uploadIcon}>⇪</div>
              <div style={styles.uploadText}>Drop files here or click to upload</div>
              <div style={styles.uploadSub}>PDF, DOCX, PNG, JPG, etc.</div>
              <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
            </div>
          </FormField>
          <FormField label="Import from Google Drive">
            <div style={styles.gdRow}>
              <input style={{ ...styles.input, flex: 1 }} value={gdUrl} placeholder="Paste Google Drive link…" onChange={e => setGdUrl(e.target.value)} />
              <button style={styles.gdBtn} onClick={importGDrive} disabled={importing}>{importing ? "…" : "Import"}</button>
            </div>
          </FormField>
          {form.attachments.length > 0 && (
            <div style={styles.attachList}>
              {form.attachments.map((f, i) => (
                <div key={i} style={styles.attachChip}>
                  <span style={{ marginRight: 6 }}>📎</span>{f}
                  <button style={styles.attachRemove} onClick={() => set("attachments", form.attachments.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={styles.formActions}>
        <button style={styles.ghostBtn} onClick={onCancel}>Cancel</button>
        <button style={styles.primaryBtn} onClick={submit}>Save Assignment</button>
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return <div style={styles.formField}><label style={styles.label}>{label}</label>{children}</div>;
}

// ── Calendar ───────────────────────────────────────────────────────────────────
function CalendarView({ assignments }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const days = getDaysInMonth(year, month);
  const firstDay = getFirstDay(year, month);
  const monthName = new Date(year, month, 1).toLocaleString("default", { month: "long" });
  function prev() { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); }
  function next() { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); }
  function assignmentsOnDay(d) {
    const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    return assignments.filter(a => a.dueDate === ds);
  }
  function studyBlocksOnDay(d) {
    const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const blocks = [];
    assignments.filter(a => !a.done && a.estimatedHours && a.dueDate).forEach(a => {
      const due = new Date(a.dueDate + "T00:00:00");
      const sessions = Math.ceil(parseFloat(a.estimatedHours) / 1.5);
      for (let i = 1; i <= sessions; i++) {
        const sd = new Date(due); sd.setDate(due.getDate() - i);
        if (dateStr(sd) === ds) blocks.push(a);
      }
    });
    return blocks;
  }
  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div><h1 style={styles.pageTitle}>Calendar</h1><p style={styles.pageSubtitle}>Due dates + AI-suggested study blocks.</p></div>
        <div style={styles.calNav}>
          <button style={styles.calNavBtn} onClick={prev}>‹</button>
          <span style={styles.calMonthLabel}>{monthName} {year}</span>
          <button style={styles.calNavBtn} onClick={next}>›</button>
        </div>
      </div>
      <div style={styles.calLegend}>
        <div style={styles.legendItem}><div style={{ ...styles.legendDot, background: "#ef4444" }} /> Due Date</div>
        <div style={styles.legendItem}><div style={{ ...styles.legendDot, background: "#6366f1", opacity: 0.6 }} /> Suggested Study</div>
      </div>
      <div style={styles.calGrid}>
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d} style={styles.calDayHeader}>{d}</div>)}
        {Array.from({ length: firstDay }).map((_, i) => <div key={"b"+i} style={styles.calCell} />)}
        {Array.from({ length: days }).map((_, i) => {
          const d = i + 1;
          const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          const due = assignmentsOnDay(d);
          const study = studyBlocksOnDay(d);
          const isToday = ds === today();
          return (
            <div key={d} style={{ ...styles.calCell, ...(isToday ? styles.calCellToday : {}) }}>
              <div style={{ ...styles.calDayNum, ...(isToday ? { background: "#6366f1", color: "#fff", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" } : {}) }}>{d}</div>
              {due.map(a => <div key={a.id} style={{ ...styles.calEvent, background: COLORS[a.subject] || "#94a3b8" }} title={a.title}>{a.title.substring(0,12)}{a.title.length > 12 ? "…" : ""}</div>)}
              {study.map((a, idx) => <div key={idx} style={{ ...styles.calEvent, background: "#6366f150", color: "#a5b4fc", border: "1px solid #6366f1" }} title={`Study: ${a.title}`}>📖 {a.title.substring(0,10)}…</div>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── AI Hub ─────────────────────────────────────────────────────────────────────
function AIHub({ assignments }) {
  const [selectedId, setSelectedId] = useState(assignments[0]?.id || null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [mode, setMode] = useState("suggestions");
  const selected = assignments.find(a => a.id === selectedId);

  async function runAI() {
    if (!selected) return;
    setLoading(true); setResult("");
    try {
      let sys = "", user = "";
      if (mode === "suggestions") {
        sys = "You are a helpful academic coach. Give concise, specific, actionable suggestions for the student's assignment.";
        user = `Assignment: ${selected.title}\nSubject: ${selected.subject}\nType: ${selected.type}\nDue: ${selected.dueDate}\nInstructions: ${selected.instructions || "(none provided)"}\n\nGive 5 specific suggestions for how to excel at this assignment. Format as a numbered list.`;
      } else if (mode === "schedule") {
        sys = "You are a study planner. Create a realistic day-by-day study schedule.";
        user = `Assignment: ${selected.title}\nDue: ${selected.dueDate}\nEstimated hours: ${selected.estimatedHours || "unknown"}\nToday: ${today()}\n\nCreate a study schedule from today until the due date.`;
      } else if (mode === "outline") {
        sys = "You are an academic writing coach. Create clear, detailed outlines for assignments.";
        user = `Assignment: ${selected.title}\nType: ${selected.type}\nSubject: ${selected.subject}\nInstructions: ${selected.instructions || "(none)"}\n\nCreate a detailed outline or structure for this assignment.`;
      } else if (mode === "breakdown") {
        sys = "You are a task decomposition expert. Break complex assignments into small, manageable steps.";
        user = `Assignment: ${selected.title}\nType: ${selected.type}\nInstructions: ${selected.instructions || "(none)"}\nDue: ${selected.dueDate}\n\nBreak this assignment into small, concrete steps with estimated time for each.`;
      }
      setResult(await callClaude(sys, user));
    } catch (e) { setResult("Error: " + e.message); }
    setLoading(false);
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div><h1 style={styles.pageTitle}>AI Assistant</h1><p style={styles.pageSubtitle}>Let AI help you plan, outline, and succeed.</p></div>
      </div>
      {assignments.length === 0 ? (
        <div style={styles.empty}><div style={styles.emptyIcon}>◈</div><p>Add assignments first to use AI tools.</p></div>
      ) : (
        <div style={styles.aiLayout}>
          <div style={styles.aiSidebar}>
            <div style={styles.aiSection}>
              <div style={styles.label}>Choose Assignment</div>
              {assignments.map(a => (
                <button key={a.id} style={{ ...styles.aiAssignBtn, ...(selectedId === a.id ? styles.aiAssignBtnActive : {}) }} onClick={() => setSelectedId(a.id)}>
                  <div style={{ ...styles.subjectDot, background: COLORS[a.subject] || "#94a3b8", margin: "0 8px 0 0", flexShrink: 0 }} />
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{a.subject} · Due {a.dueDate}</div>
                  </div>
                </button>
              ))}
            </div>
            <div style={styles.aiSection}>
              <div style={styles.label}>AI Mode</div>
              {[
                { id: "suggestions", icon: "◆", label: "Suggestions", desc: "How to excel" },
                { id: "schedule", icon: "◷", label: "Study Schedule", desc: "Day-by-day plan" },
                { id: "outline", icon: "◧", label: "Outline", desc: "Structure & flow" },
                { id: "breakdown", icon: "◈", label: "Step Breakdown", desc: "Micro tasks" },
              ].map(m => (
                <button key={m.id} style={{ ...styles.modeBtn, ...(mode === m.id ? styles.modeBtnActive : {}) }} onClick={() => setMode(m.id)}>
                  <span style={{ marginRight: 8, color: mode === m.id ? "#6366f1" : "#64748b" }}>{m.icon}</span>
                  <div><div style={{ fontWeight: 600, fontSize: 13 }}>{m.label}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{m.desc}</div></div>
                </button>
              ))}
            </div>
            <button style={{ ...styles.primaryBtn, width: "100%", marginTop: 8 }} onClick={runAI} disabled={loading || !selected}>
              {loading ? "Thinking…" : "◈ Run AI"}
            </button>
          </div>
          <div style={styles.aiMain}>
            {selected && (
              <div style={styles.aiAssignPreview}>
                <div style={{ ...styles.subjectDot, background: COLORS[selected.subject] || "#94a3b8", width: 10, height: 10, marginRight: 10 }} />
                <div>
                  <span style={{ fontWeight: 700, color: "#e2e8f0" }}>{selected.title}</span>
                  <span style={{ color: "#64748b", marginLeft: 10, fontSize: 13 }}>{selected.subject} · {selected.type} · Due {selected.dueDate}</span>
                </div>
              </div>
            )}
            <div style={styles.aiResult}>
              {loading && <div style={styles.aiLoading}><div style={styles.aiSpinner} /><p style={{ color: "#64748b", marginTop: 16 }}>AI is analyzing your assignment…</p></div>}
              {!loading && result && <div style={styles.aiText}>{result.split("\n").map((line, i) => <p key={i} style={{ margin: "6px 0", lineHeight: 1.7 }}>{line}</p>)}</div>}
              {!loading && !result && <div style={styles.aiPlaceholder}><div style={{ fontSize: 48, opacity: 0.2 }}>◈</div><p style={{ color: "#475569", marginTop: 12 }}>Select an assignment and mode, then click "Run AI".</p></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Detail View ────────────────────────────────────────────────────────────────
function DetailView({ assignment: a, onBack, onToggle, onDelete, onUpdate }) {
  const [aiSugg, setAiSugg] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [notes, setNotes] = useState(a.notes || "");
  const isOverdue = !a.done && a.dueDate < today();

  async function getQuickSuggestion() {
    setLoadingAI(true);
    try {
      const text = await callClaude(
        "You are an academic coach. Give 3 quick, actionable tips for completing this assignment well.",
        `Assignment: ${a.title}\nSubject: ${a.subject}\nType: ${a.type}\nDue: ${a.dueDate}\nInstructions: ${a.instructions || "Not provided."}`
      );
      setAiSugg(text);
    } catch (e) { setAiSugg("Error: " + e.message); }
    setLoadingAI(false);
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <button style={styles.ghostBtn} onClick={onBack}>← Back</button>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={styles.ghostBtn} onClick={() => onToggle(a.id)}>{a.done ? "Mark Pending" : "Mark Done ✓"}</button>
          <button style={{ ...styles.ghostBtn, color: "#ef4444", borderColor: "#ef444440" }} onClick={() => onDelete(a.id)}>Delete</button>
        </div>
      </div>
      <div style={styles.detailLayout}>
        <div style={styles.detailMain}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ ...styles.subjectDot, width: 14, height: 14, background: COLORS[a.subject] || "#94a3b8" }} />
            <span style={{ color: COLORS[a.subject] || "#94a3b8", fontWeight: 700, fontSize: 14 }}>{a.subject}</span>
            {isOverdue && <span style={{ background: "#ef444422", color: "#ef4444", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>OVERDUE</span>}
            {a.done && <span style={{ background: "#10b98122", color: "#10b981", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>DONE</span>}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#e2e8f0", margin: "0 0 20px 0", textDecoration: a.done ? "line-through" : "none" }}>{a.title}</h1>
          <div style={styles.detailMeta}>
            {[{ label: "Type", val: a.type },{ label: "Priority", val: a.priority, color: PRI_COLORS[a.priority] },{ label: "Due Date", val: a.dueDate },{ label: "Est. Hours", val: a.estimatedHours || "—" }].map(m => (
              <div key={m.label} style={styles.metaCard}>
                <div style={styles.metaLabel}>{m.label}</div>
                <div style={{ ...styles.metaVal, color: m.color || "#e2e8f0" }}>{m.val}</div>
              </div>
            ))}
          </div>
          {a.instructions && <div style={styles.detailSection}><div style={styles.detailSectionTitle}>Instructions</div><div style={styles.detailText}>{a.instructions}</div></div>}
          <div style={styles.detailSection}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={styles.detailSectionTitle}>Notes</div>
              <button style={styles.microBtn} onClick={() => { if (editMode) onUpdate(a.id, { notes }); setEditMode(e => !e); }}>{editMode ? "Save" : "Edit"}</button>
            </div>
            {editMode ? <textarea style={{ ...styles.input, ...styles.textarea }} value={notes} onChange={e => setNotes(e.target.value)} rows={4} /> : <div style={styles.detailText}>{a.notes || <span style={{ color: "#475569" }}>No notes yet.</span>}</div>}
          </div>
          {a.attachments?.length > 0 && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>Attachments</div>
              <div style={styles.attachList}>{a.attachments.map((f, i) => <div key={i} style={styles.attachChip}><span style={{ marginRight: 6 }}>📎</span>{f}</div>)}</div>
            </div>
          )}
        </div>
        <div style={styles.detailAI}>
          <div style={styles.aiPanelHeader}><span style={{ fontSize: 18 }}>◈</span> AI Quick Tips</div>
          {!aiSugg && !loadingAI && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <p style={{ color: "#475569", marginBottom: 16, fontSize: 14 }}>Get instant AI-powered tips for this assignment.</p>
              <button style={styles.primaryBtn} onClick={getQuickSuggestion}>Get Suggestions</button>
            </div>
          )}
          {loadingAI && <div style={styles.aiLoading}><div style={styles.aiSpinner} /><p style={{ color: "#64748b", marginTop: 12, fontSize: 13 }}>Analyzing…</p></div>}
          {aiSugg && !loadingAI && (
            <div>
              <div style={styles.aiText}>{aiSugg.split("\n").map((l, i) => <p key={i} style={{ margin: "5px 0", lineHeight: 1.7, fontSize: 14 }}>{l}</p>)}</div>
              <button style={{ ...styles.ghostBtn, marginTop: 12, width: "100%" }} onClick={getQuickSuggestion}>Refresh ↺</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = {
  root: { display: "flex", minHeight: "100vh", background: "#0b0f1a", color: "#e2e8f0", fontFamily: "'DM Sans', system-ui, sans-serif" },
  main: { flex: 1, overflow: "auto", maxHeight: "100vh" },
  syncBar: { background: "#6366f120", color: "#818cf8", padding: "8px 24px", fontSize: 13, borderBottom: "1px solid #6366f130" },
  sidebar: { width: 220, background: "#0f1623", borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", padding: "24px 12px", gap: 4, position: "sticky", top: 0, height: "100vh", flexShrink: 0 },
  logo: { display: "flex", alignItems: "center", gap: 10, padding: "0 8px 20px", borderBottom: "1px solid #1e293b", marginBottom: 12 },
  logoMark: { fontSize: 22, color: "#6366f1" },
  logoText: { fontSize: 18, fontWeight: 800, letterSpacing: "-0.5px", color: "#e2e8f0" },
  statsRow: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 },
  statChip: { fontSize: 12, color: "#64748b", padding: "4px 8px", display: "flex", gap: 6, alignItems: "center" },
  navBtn: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", fontSize: 14, fontWeight: 500, width: "100%" },
  navBtnActive: { background: "#1e293b", color: "#e2e8f0" },
  navIcon: { fontSize: 16, width: 20, textAlign: "center" },
  sidebarFooter: { marginTop: "auto", borderTop: "1px solid #1e293b", paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 },
  driveIndicator: { display: "flex", alignItems: "center", padding: "4px 8px" },
  signOutBtn: { background: "transparent", border: "1px solid #1e293b", color: "#475569", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12, margin: "0 8px" },
  // Login
  loginPage: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" },
  loginCard: { background: "#0f1623", border: "1px solid #1e293b", borderRadius: 20, padding: "48px 40px", width: 420, textAlign: "center" },
  loginLogo: { marginBottom: 32 },
  loginTitle: { fontSize: 36, fontWeight: 800, margin: "12px 0 8px", letterSpacing: "-1px" },
  loginSub: { color: "#64748b", fontSize: 15 },
  loginFeatures: { textAlign: "left", marginBottom: 32, display: "flex", flexDirection: "column", gap: 12 },
  loginFeature: { display: "flex", alignItems: "center", fontSize: 14, color: "#94a3b8" },
  googleBtn: { display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", color: "#1e293b", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", marginBottom: 16 },
  loginNote: { color: "#334155", fontSize: 12 },
  // Page
  page: { padding: "32px 40px", maxWidth: 1100, margin: "0 auto" },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 },
  pageTitle: { fontSize: 30, fontWeight: 800, margin: 0, letterSpacing: "-0.5px" },
  pageSubtitle: { color: "#64748b", margin: "6px 0 0", fontSize: 14 },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 },
  summaryCard: { background: "#0f1623", border: "1px solid #1e293b", borderTop: "3px solid", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 4 },
  summaryIcon: { fontSize: 20, marginBottom: 4 },
  summaryVal: { fontSize: 32, fontWeight: 800, lineHeight: 1 },
  summaryLabel: { fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 },
  upcomingRow: { display: "flex", gap: 14 },
  upcomingCard: { flex: "1 1 200px", background: "#0f1623", border: "1px solid #1e293b", borderLeft: "4px solid", borderRadius: 10, padding: 16, cursor: "pointer" },
  upcomingSubject: { fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  upcomingTitle: { fontSize: 15, fontWeight: 700, color: "#e2e8f0", marginBottom: 6 },
  upcomingDue: { fontSize: 12, color: "#94a3b8" },
  filterBar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  filterGroup: { display: "flex", gap: 8 },
  filterBtn: { padding: "6px 16px", border: "1px solid #1e293b", borderRadius: 20, background: "transparent", color: "#64748b", cursor: "pointer", fontSize: 13, fontWeight: 500 },
  filterBtnActive: { background: "#1e293b", color: "#e2e8f0", borderColor: "#334155" },
  select: { background: "#0f1623", border: "1px solid #1e293b", borderRadius: 8, color: "#e2e8f0", padding: "6px 12px", fontSize: 13, cursor: "pointer" },
  assignList: { display: "flex", flexDirection: "column", gap: 8 },
  assignRow: { display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#0f1623", border: "1px solid #1e293b", borderRadius: 10 },
  checkBtn: { background: "transparent", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 },
  checkMark: { width: 20, height: 20, border: "2px solid", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff" },
  subjectDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  assignInfo: { flex: 1, cursor: "pointer", minWidth: 0 },
  assignTitle: { fontSize: 15, fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  assignMeta: { display: "flex", gap: 6, fontSize: 12, color: "#64748b", marginTop: 3, flexWrap: "wrap" },
  metaDot: { color: "#334155" },
  priTag: { padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0 },
  deleteBtn: { background: "transparent", border: "none", color: "#334155", cursor: "pointer", fontSize: 14, padding: "2px 6px", flexShrink: 0 },
  empty: { textAlign: "center", padding: "60px 0", color: "#475569" },
  emptyIcon: { fontSize: 48, opacity: 0.2, marginBottom: 16 },
  primaryBtn: { background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 },
  ghostBtn: { background: "transparent", border: "1px solid #1e293b", color: "#94a3b8", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontSize: 14, fontWeight: 500 },
  microBtn: { background: "#1e293b", border: "none", color: "#94a3b8", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 12 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 24 },
  formCol: { display: "flex", flexDirection: "column", gap: 16 },
  formRow2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  formField: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8 },
  input: { background: "#0f1623", border: "1px solid #1e293b", borderRadius: 8, color: "#e2e8f0", padding: "10px 14px", fontSize: 14, width: "100%", boxSizing: "border-box", outline: "none", fontFamily: "inherit" },
  textarea: { resize: "vertical", lineHeight: 1.6 },
  uploadZone: { border: "2px dashed #1e293b", borderRadius: 12, padding: 28, textAlign: "center", cursor: "pointer", background: "#0f1623" },
  uploadIcon: { fontSize: 28, color: "#334155", marginBottom: 8 },
  uploadText: { color: "#94a3b8", fontWeight: 600, fontSize: 14 },
  uploadSub: { color: "#475569", fontSize: 12, marginTop: 4 },
  gdRow: { display: "flex", gap: 10, alignItems: "center" },
  gdBtn: { background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, flexShrink: 0 },
  attachList: { display: "flex", flexWrap: "wrap", gap: 8 },
  attachChip: { display: "flex", alignItems: "center", background: "#1e293b", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#94a3b8" },
  attachRemove: { background: "transparent", border: "none", color: "#64748b", cursor: "pointer", marginLeft: 6, padding: 0, fontSize: 12 },
  formActions: { display: "flex", justifyContent: "flex-end", gap: 12, paddingTop: 8, borderTop: "1px solid #1e293b" },
  calGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 },
  calDayHeader: { textAlign: "center", padding: "8px 0", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 1 },
  calCell: { background: "#0f1623", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 6px", minHeight: 90 },
  calCellToday: { border: "1px solid #6366f1" },
  calDayNum: { fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 4 },
  calEvent: { fontSize: 10, padding: "2px 6px", borderRadius: 4, marginBottom: 2, color: "#fff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  calNav: { display: "flex", alignItems: "center", gap: 16 },
  calNavBtn: { background: "#1e293b", border: "none", color: "#e2e8f0", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 18, fontWeight: 700 },
  calMonthLabel: { fontSize: 18, fontWeight: 700, minWidth: 160, textAlign: "center" },
  calLegend: { display: "flex", gap: 20, marginBottom: 16 },
  legendItem: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748b" },
  legendDot: { width: 10, height: 10, borderRadius: "50%" },
  aiLayout: { display: "grid", gridTemplateColumns: "280px 1fr", gap: 24 },
  aiSidebar: { background: "#0f1623", border: "1px solid #1e293b", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 4 },
  aiSection: { marginBottom: 20 },
  aiAssignBtn: { display: "flex", alignItems: "center", width: "100%", padding: "10px 12px", background: "transparent", border: "1px solid transparent", borderRadius: 8, cursor: "pointer", color: "#94a3b8", marginBottom: 4 },
  aiAssignBtnActive: { background: "#1e293b", borderColor: "#334155", color: "#e2e8f0" },
  modeBtn: { display: "flex", alignItems: "center", width: "100%", padding: "10px 12px", background: "transparent", border: "1px solid transparent", borderRadius: 8, cursor: "pointer", color: "#94a3b8", marginBottom: 4 },
  modeBtnActive: { background: "#1e293b", borderColor: "#6366f130", color: "#e2e8f0" },
  aiMain: { background: "#0f1623", border: "1px solid #1e293b", borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" },
  aiAssignPreview: { display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #1e293b" },
  aiResult: { flex: 1, padding: 24, overflowY: "auto", minHeight: 400 },
  aiLoading: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "40px 0" },
  aiSpinner: { width: 36, height: 36, border: "3px solid #1e293b", borderTop: "3px solid #6366f1", borderRadius: "50%", animation: "spin 1s linear infinite" },
  aiText: { color: "#cbd5e1", lineHeight: 1.8, fontSize: 14 },
  aiPlaceholder: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" },
  detailLayout: { display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 },
  detailMain: { background: "#0f1623", border: "1px solid #1e293b", borderRadius: 12, padding: 28 },
  detailMeta: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 },
  metaCard: { background: "#0b0f1a", border: "1px solid #1e293b", borderRadius: 10, padding: "12px 14px" },
  metaLabel: { fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  metaVal: { fontSize: 16, fontWeight: 700 },
  detailSection: { marginTop: 20, paddingTop: 20, borderTop: "1px solid #1e293b" },
  detailSectionTitle: { fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  detailText: { fontSize: 14, color: "#94a3b8", lineHeight: 1.8 },
  detailAI: { background: "#0f1623", border: "1px solid #1e293b", borderRadius: 12, padding: 20 },
  aiPanelHeader: { display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 16, marginBottom: 16, color: "#6366f1" },
  toast: { position: "fixed", bottom: 24, right: 24, padding: "12px 24px", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 14, zIndex: 9999, boxShadow: "0 8px 32px rgba(0,0,0,.4)" },
};

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; background: #0b0f1a; }
  @keyframes spin { to { transform: rotate(360deg); } }
  input:focus, select:focus, textarea:focus { border-color: #6366f1 !important; }
  button:hover { opacity: 0.88; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #0b0f1a; }
  ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
`;
