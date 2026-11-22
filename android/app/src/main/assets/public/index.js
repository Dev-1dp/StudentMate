const USERS_KEY = "studentmate-users";
const SESSION_KEY = "studentmate-session";
const DATA_PREFIX = "studentmate-data-";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const today = new Date();
let authMode = "login";
let currentUser = null;
let userData = null;
let speechRecognition = null;
let assistantInitialized = false;
let voiceRepliesEnabled = false;
let pendingVoiceSample = null;
let installPromptEvent = null;
const reminderTimers = new Set();
const motivationalLines = [
    "Small progress is still progress, yaar. Keep going.",
    "Your future self will thank you for starting today.",
    "One focused session can change the shape of your whole day.",
    "No pressure to be perfect, just take the next useful step.",
    "You are building consistency one completed task at a time."
];
const voiceProfiles = [
    { id: "aria", name: "Aria", gender: "Female", avatar: "👩🏻‍🎓", lang: "en-IN", terms: /aria|heera|neerja/i, rate: 0.94, pitch: 1.18 },
    { id: "sara", name: "Sara", gender: "Female", avatar: "👩🏻‍🚀", lang: "en-US", terms: /sara|samantha|zira|susan|karen|victoria/i, rate: 0.96, pitch: 1.16 },
];

const defaultData = () => ({ notes: [], tasks: [], notices: [], classes: [], assistantVoice: "aria" });
const normalizeAssistantVoice = (voiceId) => voiceProfiles.some((profile) => profile.id === voiceId) ? voiceId : "aria";
const sanitizeStoredAssistantVoices = () => {
    const keys = Object.keys(localStorage || {});
    keys.forEach((key) => {
        if (!key.startsWith(DATA_PREFIX)) return;
        try {
            const storedData = JSON.parse(localStorage.getItem(key) || "null");
            if (!storedData || typeof storedData !== "object") return;
            const normalizedVoice = normalizeAssistantVoice(storedData.assistantVoice);
            if (storedData.assistantVoice !== normalizedVoice) {
                storedData.assistantVoice = normalizedVoice;
                localStorage.setItem(key, JSON.stringify(storedData));
            }
        } catch (error) {
            console.warn("Could not sanitize stored assistant voice:", error);
        }
    });
};
const ensureSavedAssistantVoice = (data, storageKey) => {
    if (!data || !storageKey) return data;
    const originalVoice = data.assistantVoice;
    const normalizedVoice = normalizeAssistantVoice(originalVoice);
    if (originalVoice !== normalizedVoice) {
        data.assistantVoice = normalizedVoice;
        localStorage.setItem(storageKey, JSON.stringify(data));
    }
    return data;
};
const saveData = () => localStorage.setItem(DATA_PREFIX + currentUser.email, JSON.stringify(userData));
const formatDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : "No due date";
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const emptyState = (message) => `<div class="empty-state">${message}</div>`;
const firstName = () => currentUser.name.trim().split(/\s+/)[0];
const greeting = () => today.getHours() < 12 ? "Good Morning" : today.getHours() < 18 ? "Good Afternoon" : "Good Evening";
const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const currentDay = () => today.toLocaleDateString("en-US", { weekday: "long" });
const formatTime = (value) => value ? new Date(`1970-01-01T${value}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
const avatarMarkup = (user, className) => user.photo ? `<img class="${className}" src="${user.photo}" alt="Profile photo">` : `<div class="${className}">${escapeHtml(user.avatar || "👤")}</div>`;
const selectedVoiceProfile = () => voiceProfiles.find((profile) => profile.id === userData.assistantVoice) || voiceProfiles[0];

function setupPWA() {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
    window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); installPromptEvent = event; $("#installAppBtn").classList.remove("hidden"); });
    window.addEventListener("appinstalled", () => { installPromptEvent = null; $("#installAppBtn").classList.add("hidden"); });
}

function classMarkup(classItem) {
    return `<div class="schedule-class"><strong>${escapeHtml(classItem.subject)}</strong><span>${formatTime(classItem.startTime)} - ${formatTime(classItem.endTime)}</span><small>${escapeHtml(classItem.room)} · ${escapeHtml(classItem.teacher)}</small><button class="text-btn delete-class" data-class-id="${classItem.id}" type="button">Delete</button></div>`;
}

function renderClasses() {
    const todaysClasses = userData.classes.filter((classItem) => classItem.day === currentDay()).sort((first, second) => first.startTime.localeCompare(second.startTime));
    $("#todayDay").textContent = currentDay();
    $("#classList").innerHTML = todaysClasses.map((classItem) => `<div class="class-item"><div class="class-time">${formatTime(classItem.startTime)}</div><div class="class-details"><strong>${escapeHtml(classItem.subject)}</strong><span>${escapeHtml(classItem.room)} · ${escapeHtml(classItem.teacher)}</span></div><span class="subject-badge">${escapeHtml(classItem.day.slice(0, 3))}</span></div>`).join("") || emptyState("No classes scheduled for today.");
    $$(".schedule-day").forEach((dayElement) => {
        const day = dayElement.dataset.day;
        const dayClasses = userData.classes.filter((classItem) => classItem.day === day).sort((first, second) => first.startTime.localeCompare(second.startTime));
        dayElement.innerHTML = `<h3>${day}</h3>${dayClasses.map(classMarkup).join("") || '<div class="empty-schedule">No classes added yet.</div>'}`;
    });
}

function taskMarkup(task) {
    return `<div class="task-item ${task.completed ? "task-complete" : ""}"><div class="task-checkbox"><input type="checkbox" data-task-id="${task.id}" ${task.completed ? "checked" : ""}></div><div class="task-details"><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.subject)} · Due ${formatDate(task.dueDate)}</span></div><span class="priority ${task.priority}">${task.priority}</span></div>`;
}

function renderTasks() {
    $("#taskList").innerHTML = userData.tasks.slice(0, 4).map(taskMarkup).join("") || emptyState("No tasks yet.");
    $("#allTasksList").innerHTML = userData.tasks.map((task) => `<div class="all-task-item">${taskMarkup(task)}<button class="text-btn delete-task" data-task-id="${task.id}" type="button">Delete</button></div>`).join("") || emptyState("No tasks yet. Add one to get organized.");
}

function renderFilteredTasks(filter = "all") {
    const tasks = userData.tasks.filter((task) => filter === "all" || (filter === "pending" && !task.completed) || (filter === "completed" && task.completed) || (filter === "high" && task.priority === "high"));
    $("#allTasksList").innerHTML = tasks.map((task) => `<div class="all-task-item">${taskMarkup(task)}<button class="text-btn delete-task" data-task-id="${task.id}" type="button">Delete</button></div>`).join("") || emptyState("No tasks match this filter.");
}

function renderNotes() {
    const query = $("#noteSearch").value.toLowerCase();
    const subject = $("#noteSubjectFilter").value;
    const notes = userData.notes.filter((note) => (subject === "all" || note.subject === subject) && `${note.title} ${note.content}`.toLowerCase().includes(query));
    $("#notesList").innerHTML = notes.map((note) => `<article class="note-card"><span class="note-subject">${escapeHtml(note.subject)}</span><h3>${escapeHtml(note.title)}</h3><p>${escapeHtml(note.content)}</p><button class="text-btn delete-note" data-note-id="${note.id}" type="button">Delete</button></article>`).join("") || emptyState("No matching notes.");
}

function renderNotices() {
    const query = $("#noticeSearch").value.toLowerCase();
    const category = $("#noticeCategoryFilter").value;
    const notices = userData.notices.filter((notice) => (category === "all" || notice.category === category) && `${notice.title} ${notice.description}`.toLowerCase().includes(query));
    const markup = notices.map((notice) => `<div class="notice-item"><div class="notice-icon">📌</div><div class="notice-content"><strong>${escapeHtml(notice.title)}</strong><p>${escapeHtml(notice.description)}</p><span>${notice.date}</span></div>${notice.important ? '<span class="important-badge">Important</span>' : ""}<button class="text-btn delete-notice" data-notice-id="${notice.id}" type="button">Delete</button></div>`).join("");
    $("#noticeList").innerHTML = notices.slice(0, 3).map((notice) => `<div class="notice-item"><div class="notice-icon">📌</div><div class="notice-content"><strong>${escapeHtml(notice.title)}</strong><p>${escapeHtml(notice.description)}</p><span>${notice.date}</span></div></div>`).join("") || emptyState("No notices yet.");
    $("#allNoticesList").innerHTML = markup || emptyState("No matching notices.");
}

function getReportTasks(period) {
    const start = new Date(today.getFullYear(), today.getMonth(), period === "week" ? today.getDate() - ((today.getDay() + 6) % 7) : 1);
    const end = period === "week" ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59) : new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    return { start, end, tasks: userData.tasks.filter((task) => { if (!task.dueDate) return false; const dueDate = new Date(`${task.dueDate}T00:00:00`); return dueDate >= start && dueDate <= end; }) };
}

function renderReport() {
    const period = $("#reportPeriod").value;
    const report = getReportTasks(period);
    const completed = report.tasks.filter((task) => task.completed).length;
    const percentage = report.tasks.length ? Math.round((completed / report.tasks.length) * 100) : 0;
    $("#reportPercentage").textContent = `${percentage}%`;
    $("#reportCompleted").textContent = completed;
    $("#reportPlanned").textContent = report.tasks.length;
    $("#reportRemaining").textContent = report.tasks.length - completed;
    $("#reportDateRange").textContent = `${report.start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${report.end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    $("#reportMessage").textContent = report.tasks.length ? `${completed} of ${report.tasks.length} planned tasks completed.` : "No tasks with due dates fall in this period.";
    $("#reportTaskList").innerHTML = report.tasks.map((task) => `<div class="report-task ${task.completed ? "task-complete" : ""}"><span>${task.completed ? "✓" : "○"}</span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.subject)} · Due ${formatDate(task.dueDate)}</small></div>`).join("") || emptyState("Add tasks with due dates to start tracking progress.");
}

function printReport() {
    const period = $("#reportPeriod").value;
    const report = getReportTasks(period);
    const completed = report.tasks.filter((task) => task.completed).length;
    const percentage = report.tasks.length ? Math.round((completed / report.tasks.length) * 100) : 0;
    const taskRows = report.tasks.map((task) => `<tr><td>${task.completed ? "Completed" : "Pending"}</td><td>${escapeHtml(task.title)}</td><td>${escapeHtml(task.subject)}</td><td>${formatDate(task.dueDate)}</td></tr>`).join("") || '<tr><td colspan="4">No tasks with due dates in this period.</td></tr>';
    const reportWindow = window.open("", "_blank", "width=800,height=900");
    if (!reportWindow) return;
    reportWindow.document.write(`<html><head><title>StudentMate ${period} progress report</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:40px}h1{color:#2563eb}p{color:#64748b}.score{font-size:42px;font-weight:700;margin:30px 0 8px}table{width:100%;border-collapse:collapse;margin-top:30px}th,td{text-align:left;padding:12px;border-bottom:1px solid #e7ebf2}th{color:#64748b;font-size:12px;text-transform:uppercase}</style></head><body><h1>StudentMate Progress Report</h1><p>${period === "week" ? "Weekly" : "Monthly"} report · ${report.start.toLocaleDateString()} - ${report.end.toLocaleDateString()}</p><div class="score">${percentage}%</div><p>${completed} of ${report.tasks.length} planned tasks completed</p><table><thead><tr><th>Status</th><th>Task</th><th>Subject</th><th>Due date</th></tr></thead><tbody>${taskRows}</tbody></table></body></html>`);
    reportWindow.document.close(); reportWindow.focus(); reportWindow.print();
}

function addAssistantMessage(text, type = "bot") {
    $("#assistantMessages").insertAdjacentHTML("beforeend", `<div class="assistant-message ${type}">${escapeHtml(text).replace(/\n/g, "<br>")}</div>`);
    $("#assistantMessages").scrollTop = $("#assistantMessages").scrollHeight;
}

function motivationalLine() {
    return motivationalLines[Math.floor(Math.random() * motivationalLines.length)];
}

function getDueDate(value) {
    const normalized = value.toLowerCase();
    if (normalized === "today") return today.toISOString().slice(0, 10);
    if (normalized === "tomorrow") { const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1); return tomorrow.toISOString().slice(0, 10); }
    return value;
}

function scheduleReminder(task) {
    if (!task.reminderAt || reminderTimers.has(task.id)) return;
    const reminderDate = new Date(task.reminderAt).getTime();
    const delay = reminderDate - Date.now();
    if (delay <= 0) return;
    const timer = setTimeout(() => {
        reminderTimers.delete(task.id);
        const message = `Reminder: ${task.title}`;
        if ("Notification" in window && Notification.permission === "granted") new Notification("StudentMate reminder", { body: message });
        else alert(message);
    }, delay);
    reminderTimers.add(task.id);
}

function scheduleAllReminders() {
    userData.tasks.filter((task) => !task.completed).forEach(scheduleReminder);
}

function requestNotifications() {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
}

function createAssistantTask(title, dueDate, reminderAt = "") {
    const task = { id: crypto.randomUUID(), title: title.trim(), subject: "General", dueDate, priority: "medium", completed: false, reminderAt };
    userData.tasks.unshift(task);
    saveData();
    renderAll();
    scheduleReminder(task);
    return task;
}

function deliverAssistantReply(fullResponse) {
    addAssistantMessage(fullResponse);
    if (voiceRepliesEnabled && "speechSynthesis" in window) { const profile = selectedVoiceProfile(); window.speechSynthesis.cancel(); const voices = window.speechSynthesis.getVoices(); const matchingVoice = voices.find((voice) => profile.terms.test(voice.name) && voice.lang.toLowerCase().startsWith(profile.lang.slice(0, 2).toLowerCase())); if (!matchingVoice) { $("#voiceStatus").textContent = `${profile.name}'s ${profile.gender.toLowerCase()} voice is not installed in this browser.`; return; } const utterance = new SpeechSynthesisUtterance(fullResponse); utterance.voice = matchingVoice; utterance.lang = matchingVoice.lang || profile.lang; utterance.rate = profile.rate; utterance.pitch = profile.pitch; $("#ariaFloatBtn").classList.add("aria-speaking"); utterance.addEventListener("end", () => $("#ariaFloatBtn").classList.remove("aria-speaking")); window.speechSynthesis.speak(utterance); }
}

function findProfileVoice(profile) {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    const language = profile.lang.slice(0, 2).toLowerCase();
    return voices.find((voice) => profile.terms.test(voice.name) && voice.lang.toLowerCase().startsWith(language))
        || voices.find((voice) => voice.lang.toLowerCase().startsWith(language))
        || voices.find((voice) => voice.default)
        || voices[0]
        || null;
}

function speakVoiceSample(profile) {
    if (!("speechSynthesis" in window)) { $("#voiceStatus").textContent = "Voice samples are not supported in this browser."; return; }
    const matchingVoice = findProfileVoice(profile);
    if (!matchingVoice) { pendingVoiceSample = profile; $("#voiceStatus").textContent = `${profile.name}'s voice is loading or is not installed in this browser.`; return; }
    pendingVoiceSample = null;
    window.speechSynthesis.cancel();
    $("#ariaFloatBtn").classList.add("aria-speaking");
    const utterance = new SpeechSynthesisUtterance(`Hi, I am ${profile.name}. Let us make your study plan together.`);
    utterance.voice = matchingVoice;
    utterance.lang = matchingVoice.lang || profile.lang;
    utterance.rate = profile.rate;
    utterance.pitch = profile.pitch;
    utterance.addEventListener("error", () => {
        $("#ariaFloatBtn").classList.remove("aria-speaking");
        $("#voiceStatus").textContent = `Unable to play ${profile.name}'s voice on this device.`;
    });
    utterance.addEventListener("end", () => $("#ariaFloatBtn").classList.remove("aria-speaking"));
    window.speechSynthesis.speak(utterance);
    $("#voiceStatus").textContent = `Playing ${profile.name}'s voice sample.`;
}

function localAssistantReply(prompt) {
    const cleanPrompt = prompt.trim();
    const taskMatch = cleanPrompt.match(/^(?:please\s+)?(?:add|create)\s+(?:a\s+)?task\s+(.+?)(?:\s+subject\s+([^\n]+?))?\s+due\s+(today|tomorrow|\d{4}-\d{2}-\d{2})(?:\s+at\s+(\d{1,2}:\d{2}))?$/i);
    const reminderMatch = cleanPrompt.match(/^(?:please\s+)?remind\s+me\s+to\s+(.+?)\s+at\s+(\d{1,2}:\d{2})$/i);
    let response = "";
    if (taskMatch) {
        const dueDate = getDueDate(taskMatch[3]);
        const reminderAt = taskMatch[4] ? `${dueDate}T${taskMatch[4].padStart(5, "0")}` : "";
        const task = createAssistantTask(taskMatch[1], dueDate, reminderAt);
        if (reminderAt) requestNotifications();
        response = `Done. I added “${task.title}” for ${formatDate(task.dueDate)}${reminderAt ? ` and set a reminder for ${new Date(reminderAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}.`;
    } else if (reminderMatch) {
        const dueDate = today.toISOString().slice(0, 10);
        const reminderAt = `${dueDate}T${reminderMatch[2].padStart(5, "0")}`;
        const task = createAssistantTask(reminderMatch[1], dueDate, reminderAt);
        requestNotifications();
        response = `Done. I added “${task.title}” for today and will remind you at ${new Date(reminderAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`;
    } else if (/how am i doing|progress|status/i.test(cleanPrompt)) {
        const completed = userData.tasks.filter((task) => task.completed).length;
        const pending = userData.tasks.length - completed;
        response = `You have completed ${completed} task${completed === 1 ? "" : "s"} and have ${pending} still to do. Pick one small pending task and give it 25 focused minutes.`;
    } else if (/what should i study|study next|suggest/i.test(cleanPrompt)) {
        const nextTask = userData.tasks.find((task) => !task.completed);
        response = nextTask ? `Start with “${nextTask.title}”${nextTask.subject !== "General" ? ` for ${nextTask.subject}` : ""}. Work on it for 25 minutes, then take a short break.` : "You have no pending tasks. Add one clear study goal for your next session.";
    } else if (/plan|schedule/i.test(cleanPrompt)) {
        const pendingTasks = userData.tasks.filter((task) => !task.completed).slice(0, 3);
        response = pendingTasks.length ? `Here is a focused plan:\n1. ${pendingTasks.map((task) => task.title).join("\n2. ")}\n3. Take a 10-minute review break.` : "Create one task with a due date and I will help you turn it into a focused plan.";
    } else {
        response = "I can add tasks and reminders, suggest what to study next, or help you make a focused plan. Try: “add task Revise DBMS due tomorrow at 18:00”.";
    }
    const fullResponse = `${response}\n\n${motivationalLine()}`;
    deliverAssistantReply(fullResponse);
}

async function assistantReply(prompt) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 500);
        const result = await fetch("http://localhost:8000/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, tasks: userData.tasks }), signal: controller.signal });
        clearTimeout(timeout);
        if (!result.ok) throw new Error("Aria service unavailable");
        const data = await result.json();
        if (data.task) { const task = { ...data.task, id: crypto.randomUUID() }; userData.tasks.unshift(task); saveData(); renderAll(); scheduleReminder(task); if (task.reminderAt) requestNotifications(); }
        deliverAssistantReply(data.reply);
    } catch (error) {
        localAssistantReply(prompt);
    }
}

function setupAssistant() {
    if (!$("#assistantMessages")) return;
    $("#assistantName").textContent = firstName();
    renderVoiceProfiles();
    if (assistantInitialized) return;
    assistantInitialized = true;
    if (!$("#assistantMessages").children.length) addAssistantMessage(`Hey ${firstName()}, Aria here! I’m ready to help. Ask me to add a task, set a reminder, or suggest your next study step.`);
    $("#assistantForm").addEventListener("submit", (event) => { event.preventDefault(); const input = $("#assistantInput"); const prompt = input.value.trim(); if (!prompt) return; addAssistantMessage(prompt, "user"); input.value = ""; assistantReply(prompt); });
    $$(".suggestion-btn").forEach((button) => button.addEventListener("click", () => { addAssistantMessage(button.dataset.prompt, "user"); assistantReply(button.dataset.prompt); }));
    $("#voiceReplyBtn").addEventListener("click", () => { voiceRepliesEnabled = !voiceRepliesEnabled; $("#voiceReplyBtn").setAttribute("aria-pressed", String(voiceRepliesEnabled)); $("#voiceReplyBtn").classList.toggle("recording", voiceRepliesEnabled); $("#voiceStatus").textContent = voiceRepliesEnabled ? "Voice replies enabled." : "Voice replies disabled."; });
    if ("speechSynthesis" in window) window.speechSynthesis.addEventListener("voiceschanged", () => { if (pendingVoiceSample) speakVoiceSample(pendingVoiceSample); else if (voiceRepliesEnabled) $("#voiceStatus").textContent = "Voice options are ready for Aria."; });
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { $("#voiceBtn").disabled = true; $("#voiceStatus").textContent = "Voice input is not supported in this browser."; return; }
    speechRecognition = new Recognition(); speechRecognition.lang = "en-IN"; speechRecognition.interimResults = false; speechRecognition.addEventListener("result", (event) => { $("#assistantInput").value = event.results[0][0].transcript; $("#voiceStatus").textContent = "Voice captured. Press Send to continue."; }); speechRecognition.addEventListener("end", () => { $("#voiceBtn").classList.remove("recording"); });
    $("#voiceBtn").addEventListener("click", () => { $("#voiceStatus").textContent = "Listening..."; $("#voiceBtn").classList.add("recording"); speechRecognition.start(); });
}

function renderVoiceProfiles() {
    const selected = selectedVoiceProfile();
    $("#selectedVoiceName").textContent = `${selected.name} · ${selected.gender}`;
    $("#ariaFloatAvatar").textContent = selected.avatar;
    $("#ariaFloatBtn").setAttribute("aria-label", `Open ${selected.name} AI assistant`);
    $("#ariaFloatBtn").setAttribute("title", `Open ${selected.name} AI assistant`);
    $("#ariaFloatBtn .aria-float-label").textContent = selected.name;
    $("#voiceProfiles").innerHTML = voiceProfiles.map((profile) => `<button class="voice-profile ${profile.id === selected.id ? "selected" : ""}" data-voice-id="${profile.id}" type="button" aria-label="Choose ${profile.name}, ${profile.gender} voice" aria-pressed="${profile.id === selected.id}"><span class="voice-avatar">${profile.avatar}</span><span><strong>${profile.name}</strong><small>${profile.gender}</small></span></button>`).join("");
    $$(".voice-profile").forEach((button) => button.addEventListener("click", () => { userData.assistantVoice = button.dataset.voiceId; saveData(); const profile = selectedVoiceProfile(); renderVoiceProfiles(); speakVoiceSample(profile); }));
}

function renderAll() {
    $("#notesCount").textContent = userData.notes.length;
    $("#tasksCount").textContent = userData.tasks.filter((task) => !task.completed).length;
    $("#completedCount").textContent = userData.tasks.filter((task) => task.completed).length;
    $("#noticesCount").textContent = userData.notices.length;
    renderTasks(); renderNotes(); renderNotices(); renderClasses();
}

function showApp() {
    $("#authScreen").classList.add("hidden"); $("#app").classList.remove("hidden"); $("#ariaFloatBtn").classList.remove("hidden");
    $("#studentName").textContent = currentUser.name; $(".profile-info span").textContent = currentUser.course || "Student";
    $(".profile-avatar").innerHTML = currentUser.photo ? `<img src="${currentUser.photo}" alt="Profile photo">` : escapeHtml(currentUser.avatar || "👤");
    $("#welcomeMessage").textContent = `${greeting()}, ${firstName()}! 👋`;
    $("#profileName").value = currentUser.name; $("#profileEmail").value = currentUser.email; $("#profileCourse").value = currentUser.course || "";
    $("#largeAvatar").innerHTML = currentUser.photo ? `<img src="${currentUser.photo}" alt="Profile photo">` : escapeHtml(currentUser.avatar || "👤");
    $("#currentDate").textContent = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); renderAll(); scheduleAllReminders(); setupAssistant();
}

function openModal(id) { $("#" + id).classList.remove("hidden"); }
function closeModal(id) { $("#" + id).classList.add("hidden"); }
function showAuthError(message) { $("#authError").textContent = message; }

function setupAuth() {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
    const session = localStorage.getItem(SESSION_KEY);
    if (session && users[session]) { currentUser = users[session]; userData = JSON.parse(localStorage.getItem(DATA_PREFIX + session) || "null") || defaultData(); showApp(); }
    $("#authToggle").addEventListener("click", () => { authMode = authMode === "login" ? "register" : "login"; $("#authTitle").textContent = authMode === "login" ? "Welcome back" : "Create your account"; $("#authSubtitle").textContent = authMode === "login" ? "Sign in to continue to your personal dashboard." : "Your notes, tasks, and progress belong to you."; $("#authNameField").classList.toggle("hidden", authMode === "login"); $("#authSubmit").textContent = authMode === "login" ? "Sign in" : "Create account"; $("#authToggle").textContent = authMode === "login" ? "New here? Create an account" : "Already have an account? Sign in"; });
    $("#authForm").addEventListener("submit", (event) => { event.preventDefault(); const email = $("#authEmail").value.trim().toLowerCase(); const password = $("#authPassword").value; const currentUsers = JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); if (authMode === "register") { const name = $("#authName").value.trim(); if (!name) return showAuthError("Please enter your name."); if (currentUsers[email]) return showAuthError("An account with this email already exists."); currentUsers[email] = { name, email, password, course: "", avatar: "🧑‍🎓", photo: "" }; localStorage.setItem(USERS_KEY, JSON.stringify(currentUsers)); localStorage.setItem(DATA_PREFIX + email, JSON.stringify(defaultData())); } else if (!currentUsers[email] || currentUsers[email].password !== password) return showAuthError("Email or password is incorrect."); currentUser = currentUsers[email]; userData = JSON.parse(localStorage.getItem(DATA_PREFIX + email) || "null") || defaultData(); localStorage.setItem(SESSION_KEY, email); showApp(); });
}

function setupInteractions() {
    $$(".nav-link").forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); const target = link.getAttribute("href").slice(1); $$(".nav-link").forEach((item) => item.classList.toggle("active", item === link)); $$(".page-section").forEach((section) => section.classList.toggle("hidden", section.id !== target)); if (target === "reports") renderReport(); if (target === "assistant") setupAssistant(); }));
    $("#ariaFloatBtn").addEventListener("click", () => { if (!currentUser) return; const assistantLink = $(".nav-link[href='#assistant']"); assistantLink.click(); $("#assistantInput").focus(); });
    $("#logoutBtn").addEventListener("click", () => { localStorage.removeItem(SESSION_KEY); location.reload(); });
    $("#themeToggle").addEventListener("click", () => { document.body.classList.toggle("dark-mode"); localStorage.setItem("studentmate-theme", document.body.classList.contains("dark-mode") ? "dark" : "light"); });
    $("#installAppBtn").addEventListener("click", async () => { if (!installPromptEvent) return; installPromptEvent.prompt(); await installPromptEvent.userChoice; installPromptEvent = null; $("#installAppBtn").classList.add("hidden"); });
    if (localStorage.getItem("studentmate-theme") === "dark") document.body.classList.add("dark-mode");
    $("#passwordToggle").addEventListener("click", () => { const password = $("#authPassword"); const isHidden = password.type === "password"; password.type = isHidden ? "text" : "password"; $("#passwordToggle").textContent = isHidden ? "Hide" : "Show"; $("#passwordToggle").setAttribute("aria-label", isHidden ? "Hide password" : "Show password"); });
    $$(".filter-btn").forEach((button) => button.addEventListener("click", () => { $$(".filter-btn").forEach((item) => item.classList.toggle("active", item === button)); renderFilteredTasks(button.dataset.filter); }));
    $("#viewAllNoticesBtn").addEventListener("click", () => { const noticesLink = $(".nav-link[href='#notices']"); noticesLink.click(); });
    $("#addTaskBtn").addEventListener("click", () => openModal("taskModal")); $("#addTaskPageBtn").addEventListener("click", () => openModal("taskModal")); $("#addNoteBtn").addEventListener("click", () => openModal("noteModal")); $("#addNoticeBtn").addEventListener("click", () => openModal("noticeModal")); $("#addClassBtn").addEventListener("click", () => openModal("classModal"));
    $$(".close-modal").forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.modal)));
    $("#noteSearch").addEventListener("input", renderNotes); $("#noteSubjectFilter").addEventListener("change", renderNotes); $("#noticeSearch").addEventListener("input", renderNotices); $("#noticeCategoryFilter").addEventListener("change", renderNotices);
    $("#taskForm").addEventListener("submit", (event) => { event.preventDefault(); const task = { id: crypto.randomUUID(), title: $("#taskTitle").value.trim(), subject: $("#taskSubject").value.trim(), dueDate: $("#taskDueDate").value, priority: $("#taskPriority").value, completed: false, reminderAt: $("#taskReminderTime").value }; userData.tasks.unshift(task); saveData(); renderAll(); scheduleReminder(task); if (task.reminderAt) requestNotifications(); event.target.reset(); closeModal("taskModal"); });
    $("#noteForm").addEventListener("submit", (event) => { event.preventDefault(); userData.notes.unshift({ id: crypto.randomUUID(), title: $("#noteTitle").value.trim(), subject: $("#noteSubject").value.trim(), content: $("#noteContent").value.trim() }); saveData(); renderAll(); event.target.reset(); closeModal("noteModal"); });
    $("#noticeForm").addEventListener("submit", (event) => { event.preventDefault(); userData.notices.unshift({ id: crypto.randomUUID(), title: $("#noticeTitle").value.trim(), description: $("#noticeDescription").value.trim(), category: $("#noticeCategory").value, important: $("#noticeImportant").checked, date: today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) }); saveData(); renderAll(); event.target.reset(); closeModal("noticeModal"); });
    $("#classForm").addEventListener("submit", (event) => { event.preventDefault(); userData.classes.push({ id: crypto.randomUUID(), subject: $("#classSubject").value.trim(), teacher: $("#teacherName").value.trim(), room: $("#classRoom").value.trim(), day: $("#classDay").value, startTime: $("#classStartTime").value, endTime: $("#classEndTime").value }); saveData(); renderAll(); event.target.reset(); closeModal("classModal"); });
    $("#reportPeriod").addEventListener("change", renderReport);
    $("#downloadReportBtn").addEventListener("click", printReport);
    $("#uploadPhotoBtn").addEventListener("click", () => $("#profilePhoto").click());
    $("#profilePhoto").addEventListener("change", (event) => { const [file] = event.target.files; if (!file) return; const reader = new FileReader(); reader.addEventListener("load", () => { currentUser.photo = reader.result; currentUser.avatar = ""; const users = JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); users[currentUser.email] = currentUser; localStorage.setItem(USERS_KEY, JSON.stringify(users)); showApp(); }); reader.readAsDataURL(file); });
    $$(".avatar-option").forEach((button) => button.addEventListener("click", () => { currentUser.avatar = button.dataset.avatar; currentUser.photo = ""; const users = JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); users[currentUser.email] = currentUser; localStorage.setItem(USERS_KEY, JSON.stringify(users)); showApp(); }));
    $("#saveProfileBtn").addEventListener("click", () => { currentUser.name = $("#profileName").value.trim() || currentUser.name; currentUser.course = $("#profileCourse").value.trim(); const users = JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); users[currentUser.email] = currentUser; localStorage.setItem(USERS_KEY, JSON.stringify(users)); showApp(); });
    document.addEventListener("change", (event) => { if (event.target.matches("[data-task-id]")) { const task = userData.tasks.find((item) => item.id === event.target.dataset.taskId); if (task) task.completed = event.target.checked; saveData(); renderAll(); } });
    document.addEventListener("click", (event) => { const task = event.target.closest(".delete-task"); const note = event.target.closest(".delete-note"); const notice = event.target.closest(".delete-notice"); const classButton = event.target.closest(".delete-class"); if (task) userData.tasks = userData.tasks.filter((item) => item.id !== task.dataset.taskId); if (note) userData.notes = userData.notes.filter((item) => item.id !== note.dataset.noteId); if (notice) userData.notices = userData.notices.filter((item) => item.id !== notice.dataset.noticeId); if (classButton) userData.classes = userData.classes.filter((item) => item.id !== classButton.dataset.classId); if (task || note || notice || classButton) { saveData(); renderAll(); } });
}

setupAuth(); setupInteractions();
setupPWA();

