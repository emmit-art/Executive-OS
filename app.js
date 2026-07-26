import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://hnvvvdibncwlplweeuod.supabase.co",
  "sb_publishable_J-iF_-7VvAfXQKITPiNM_Q_cJUlokA1",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage
    }
  }
);

const state = {
  user: null,
  workspaces: [],
  tasks: [],
  waiting: [],
  calendar: [],
  syncing: false
};

const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const todayKey = () => new Date().toISOString().slice(0, 10);
const openTasks = () => state.tasks.filter((task) => !["completed", "cancelled"].includes(task.status));
const workspaceArea = (task) => state.workspaces.find((workspace) => workspace.id === task.workspace_id)?.area || "personal";
const workspaceId = (area) => state.workspaces.find((workspace) => workspace.area === area)?.id || null;
const areaName = (area) => ({ dom_con: "Dom Con", eli_global: "ELI Global", personal: "Personal", second_brain: "Second Brain" }[area] || area);

function setMessage(id, message, isError = false) {
  const element = byId(id);
  if (!element) return;
  element.textContent = message || "";
  element.style.color = isError ? "#c83f55" : "";
}

function setSyncLabel(label, spinning = false) {
  const labelElement = byId("sync");
  const icon = document.querySelector(".sync-icon");
  if (labelElement) labelElement.textContent = label;
  if (icon) icon.style.animation = spinning ? "spin .8s linear infinite" : "";
}

function showAuthenticatedView(session) {
  state.user = session?.user || null;
  byId("authView")?.classList.toggle("hidden", Boolean(state.user));
  byId("appView")?.classList.toggle("hidden", !state.user);
}

function taskUrgency(task) {
  let score = { p1: 100, p2: 70, p3: 40, p4: 20 }[task.priority] || 40;
  if (task.due_at) {
    const days = (new Date(task.due_at) - new Date()) / 86400000;
    if (days < 0) score += 50;
    else if (days < 1) score += 30;
    else if (days < 3) score += 15;
  }
  if (task.estimated_minutes && task.estimated_minutes <= 45) score += 8;
  return score;
}

function sortedOpenTasks() {
  return [...openTasks()].sort((a, b) => taskUrgency(b) - taskUrgency(a));
}

function taskRow(task) {
  const done = task.status === "completed";
  const due = task.due_at ? new Date(task.due_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "No due date";
  return `
    <div class="task-row">
      <input class="task-check" type="checkbox" data-task-toggle="${escapeHtml(task.id)}" ${done ? "checked" : ""} aria-label="Mark ${escapeHtml(task.title)} complete">
      <div>
        <div class="task-title ${done ? "done" : ""}">${escapeHtml(task.title)}</div>
        <div class="task-meta">${escapeHtml(areaName(workspaceArea(task)))} · ${escapeHtml(due)}</div>
      </div>
      <span class="task-pill">${escapeHtml(String(task.priority || "p3").toUpperCase())}</span>
    </div>`;
}

function renderTaskList(id, tasks, emptyText = "Nothing here yet.") {
  const element = byId(id);
  if (!element) return;
  element.innerHTML = tasks.length ? tasks.map(taskRow).join("") : `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
}

function renderGreeting() {
  const now = new Date();
  const hour = now.getHours();
  const daypart = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  byId("greeting").innerHTML = `${daypart},<br>Emmit.`;
  byId("dateText").textContent = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function renderBriefing(ranked, overdue, dueToday) {
  const nextEvent = state.calendar.find((event) => new Date(event.starts_at) > new Date());
  const lines = [];
  if (ranked[0]) lines.push(["▣", `${escapeHtml(ranked[0].title)} is your top priority`]);
  else lines.push(["✓", "Your active task list is clear"]);

  if (nextEvent) lines.push(["⌑", `${escapeHtml(nextEvent.title)} is next on your calendar`]);
  else lines.push(["⌑", state.calendar.length ? `You have ${state.calendar.length} calendar event${state.calendar.length === 1 ? "" : "s"} today` : "Your calendar is clear today"]);

  if (overdue.length) lines.push(["✉", `${overdue.length} overdue item${overdue.length === 1 ? " needs" : "s need"} your attention`]);
  else if (dueToday.length) lines.push(["✉", `${dueToday.length} item${dueToday.length === 1 ? " is" : "s are"} due today`]);
  else lines.push(["✉", "Nothing urgent is overdue"]);

  byId("briefing").innerHTML = lines.map(([icon, text]) => `
    <div class="brief-line"><span class="brief-icon">${icon}</span><span>${text}</span><span class="brief-chevron">›</span></div>`).join("");
}

function renderNextAction(task, overdueCount) {
  const element = byId("nextActionContent");
  if (!element) return;
  if (!task) {
    element.innerHTML = `<span class="flag-icon">⚑</span><div><div class="first-title">Choose today's first win</div><div class="first-meta">Your task list is clear</div></div><div class="score-ring" style="--score:100"><strong>100</strong><small>SCORE</small></div>`;
    return;
  }
  const score = Math.max(40, Math.min(99, 92 - Math.max(0, overdueCount - 1) * 4));
  const dueText = task.due_at ? (new Date(task.due_at) < new Date() ? "Overdue" : `Due ${new Date(task.due_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`) : "Start today";
  element.innerHTML = `<span class="flag-icon">⚑</span><div><div class="first-title">${escapeHtml(task.title)}</div><div class="first-meta"><span class="priority-text">${task.priority === "p1" ? "High Priority" : "Priority"}</span> · ${escapeHtml(dueText)}</div></div><div class="score-ring" style="--score:${score}"><strong>${score}</strong><small>SCORE</small></div>`;
}

function renderCalendar() {
  const element = byId("scheduleList");
  if (!element) return;
  if (!state.calendar.length) {
    element.innerHTML = `<div class="empty-state">No events today</div>`;
    return;
  }
  const visible = state.calendar.slice(0, 3);
  element.innerHTML = visible.map((event) => {
    const time = event.all_day ? "All day" : new Date(event.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return `<div class="calendar-item"><span class="calendar-time">${escapeHtml(time)}</span><span class="calendar-title">${escapeHtml(event.title)}</span></div>`;
  }).join("") + (state.calendar.length > 3 ? `<div class="calendar-more">+ ${state.calendar.length - 3} more event${state.calendar.length - 3 === 1 ? "" : "s"}</div>` : "");
}

function renderWaiting() {
  const element = byId("waitingList");
  if (!element) return;
  element.innerHTML = state.waiting.length ? state.waiting.map((item) => `
    <div class="task-row"><span>↗</span><div><div class="task-title">${escapeHtml(item.item)}</div><div class="task-meta">${escapeHtml(item.person_or_company || "Follow-up")}</div></div><span class="task-pill">OPEN</span></div>`).join("") : `<div class="empty-state">No open follow-ups.</div>`;
}

function render() {
  const open = openTasks();
  const ranked = sortedOpenTasks();
  const now = new Date();
  const overdue = open.filter((task) => task.due_at && new Date(task.due_at) < now);
  const dueToday = open.filter((task) => task.due_at && task.due_at.slice(0, 10) === todayKey());

  byId("overdueCountDetail").textContent = overdue.length;
  byId("dueTodayCountDetail").textContent = dueToday.length;
  byId("waitingCountDetail").textContent = state.waiting.length;

  renderBriefing(ranked, overdue, dueToday);
  renderNextAction(ranked[0], overdue.length);
  renderCalendar();
  renderTaskList("allTasks", state.tasks.filter((task) => task.status !== "cancelled"), "Add your first task above.");
  renderTaskList("domTasks", open.filter((task) => workspaceArea(task) === "dom_con"), "No open Dom Con tasks.");
  renderTaskList("eliTasks", open.filter((task) => workspaceArea(task) === "eli_global"), "No open ELI Global tasks.");
  renderWaiting();
}

async function loadDashboard() {
  if (!state.user || state.syncing) return;
  state.syncing = true;
  setSyncLabel("Syncing", true);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  try {
    const [workspaces, tasks, waiting, calendar] = await Promise.all([
      supabase.from("workspaces").select("*"),
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("waiting_on").select("*").is("resolved_at", null).order("created_at", { ascending: false }),
      supabase.from("calendar_events_cache").select("*").gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString()).order("starts_at")
    ]);

    const resultWithError = [workspaces, tasks, waiting, calendar].find((result) => result.error);
    if (resultWithError) throw resultWithError.error;

    state.workspaces = workspaces.data || [];
    state.tasks = tasks.data || [];
    state.waiting = waiting.data || [];
    state.calendar = calendar.data || [];
    render();
    setSyncLabel("Synced");
  } catch (error) {
    console.error("Coffee Run load failed", error);
    setSyncLabel("Retry");
    setMessage("calendarStatus", "Could not refresh data. Tap Sync to retry.", true);
  } finally {
    state.syncing = false;
  }
}

async function syncCalendar(force = true) {
  if (!state.user) return;
  setMessage("calendarStatus", "Syncing calendar…");
  try {
    const { error } = await supabase.functions.invoke("sync-calendars", { body: { force } });
    if (error) throw error;
    setMessage("calendarStatus", "Calendar updated.");
  } catch (error) {
    console.error("Calendar sync failed", error);
    setMessage("calendarStatus", "Calendar sync unavailable. Showing saved events.", true);
  }
}

async function refreshEverything() {
  await syncCalendar(true);
  await loadDashboard();
}

async function handleSignIn(event) {
  event.preventDefault();
  const email = byId("email").value.trim();
  const password = byId("password").value;
  if (!email || !password) {
    setMessage("authMsg", "Enter both your email and password.", true);
    return;
  }
  const button = byId("signIn");
  button.disabled = true;
  button.textContent = "Signing In…";
  setMessage("authMsg", "Signing in…");
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    showAuthenticatedView(data.session);
    setMessage("authMsg", "");
    await loadDashboard();
  } catch (error) {
    console.error("Sign in failed", error);
    setMessage("authMsg", error?.message || "Sign in failed. Please try again.", true);
  } finally {
    button.disabled = false;
    button.textContent = "Sign In";
  }
}

async function handleSignUp() {
  const email = byId("email").value.trim();
  const password = byId("password").value;
  if (!email || password.length < 6) {
    setMessage("authMsg", "Enter a valid email and a password with at least 6 characters.", true);
    return;
  }
  const button = byId("signUp");
  button.disabled = true;
  button.textContent = "Creating…";
  try {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: "Emmit" } } });
    if (error) throw error;
    setMessage("authMsg", "Account created. Check your email if confirmation is required.");
  } catch (error) {
    setMessage("authMsg", error?.message || "Could not create the account.", true);
  } finally {
    button.disabled = false;
    button.textContent = "Create Account";
  }
}

async function addQuickTask() {
  const titleElement = byId("quickTitle");
  const title = titleElement.value.trim();
  if (!title || !state.user) return;
  const button = byId("quickAdd");
  button.disabled = true;
  try {
    const area = byId("quickArea").value;
    const payload = {
      owner_id: state.user.id,
      workspace_id: workspaceId(area),
      title,
      status: "planned",
      priority: byId("quickPriority").value,
      source: "coffee_run"
    };
    const { error } = await supabase.from("tasks").insert(payload);
    if (error) throw error;
    titleElement.value = "";
    await loadDashboard();
  } catch (error) {
    console.error("Task creation failed", error);
    alert(error?.message || "Coffee Run could not add that task.");
  } finally {
    button.disabled = false;
  }
}

async function toggleTask(id, completed) {
  const { error } = await supabase.from("tasks").update({
    status: completed ? "completed" : "planned",
    completed_at: completed ? new Date().toISOString() : null
  }).eq("id", id);
  if (error) {
    console.error("Task update failed", error);
    alert(error.message);
  }
  await loadDashboard();
}

async function saveCapture(process) {
  const input = byId("aiInput");
  const rawText = input.value.trim();
  if (!rawText || !state.user) return;
  setMessage("aiResult", "Saving…");
  const { error } = await supabase.from("assistant_captures").insert({
    owner_id: state.user.id,
    raw_text: rawText,
    status: process ? "pending" : "inbox",
    source: "coffee_run"
  });
  if (error) {
    setMessage("aiResult", error.message, true);
    return;
  }
  input.value = "";
  setMessage("aiResult", process ? "Saved and queued for organization." : "Saved to your inbox.");
}

function switchTab(tab) {
  document.querySelectorAll(".page").forEach((page) => page.classList.toggle("active", page.id === tab));
  document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function wireControls() {
  byId("authForm")?.addEventListener("submit", handleSignIn);
  byId("signUp")?.addEventListener("click", handleSignUp);
  byId("refreshAll")?.addEventListener("click", refreshEverything);
  byId("refreshCalendar")?.addEventListener("click", refreshEverything);
  byId("quickAdd")?.addEventListener("click", addQuickTask);
  byId("quickTitle")?.addEventListener("keydown", (event) => { if (event.key === "Enter") addQuickTask(); });
  byId("aiSubmit")?.addEventListener("click", () => saveCapture(true));
  byId("aiInboxOnly")?.addEventListener("click", () => saveCapture(false));
  byId("signOut")?.addEventListener("click", () => supabase.auth.signOut());

  document.addEventListener("click", (event) => {
    const tabButton = event.target.closest("[data-tab]");
    if (tabButton) switchTab(tabButton.dataset.tab);

    const aiButton = event.target.closest("[data-ai-open]");
    if (aiButton) switchTab("ai");

    const promptButton = event.target.closest("[data-prompt]");
    if (promptButton) {
      byId("aiInput").value = promptButton.dataset.prompt;
      byId("aiInput").focus();
    }
  });

  document.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-task-toggle]");
    if (checkbox) toggleTask(checkbox.dataset.taskToggle, checkbox.checked);
  });
}

async function initialize() {
  wireControls();
  renderGreeting();
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    showAuthenticatedView(data.session);
    if (data.session) await loadDashboard();
  } catch (error) {
    console.error("Coffee Run initialization failed", error);
    showAuthenticatedView(null);
    setMessage("authMsg", "Coffee Run could not connect. Refresh and try again.", true);
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    showAuthenticatedView(session);
    if (session) setTimeout(loadDashboard, 0);
  });
}

initialize();