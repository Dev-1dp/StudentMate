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
    "You are building consistency one completed task at a time.",
    "You don't need to do everything today. Just do something.",
    "A little effort today can make tomorrow much easier.",
    "Keep showing up, even when the motivation feels low.",
    "One task at a time, one step closer to where you want to be.",
    "You’ve got this. Just start with the smallest step.",
    "Progress doesn't have to be fast to be meaningful.",
    "Don't wait for the perfect moment. Make this moment count.",
    "Your effort today is an investment in your tomorrow.",
    "Some days are about winning, some are simply about not giving up.",
    "You are closer than you think. Keep moving.",
    "Focus on what you can do right now.",
    "A slow day is still better than a day spent giving up.",
    "You don't need motivation first. Start, and motivation may follow.",
    "Every completed task is a small victory.",
    "Keep going. Future you is counting on you.",
    "You can take it one hour, one task, one step at a time.",
    "Don't compare your chapter to someone else's highlight.",
    "Today doesn't need to be perfect. It just needs to move forward.",
    "Your consistency will take you places motivation never could.",
    "Start messy, learn along the way, and keep improving.",
    "Even ten focused minutes are better than zero.",
    "You’re not behind. You’re still building.",
    "Trust the process, even when the results take time.",
    "One good decision can change the direction of your day.",
    "Keep working quietly. Let your progress speak later.",
    "You don't have to feel ready. You just have to begin.",
    "Every day is another chance to get a little better.",
    "Don't let a difficult start decide how your day ends.",
    "Your goals deserve more than occasional effort.",
    "Keep the momentum going, even if the steps are small.",
    "You are capable of more than your tired mind is telling you.",
    "Do what you can today, and let tomorrow handle the rest.",
    "A focused hour can be more powerful than a distracted day.",
    "Keep choosing progress over excuses.",
    "You’ve already come this far. Don't stop here.",
    "Your dreams are built from ordinary days like this one.",
    "One more attempt could be the one that works.",
    "Don't underestimate what consistent effort can create.",
    "It's okay to move slowly. Just don't stop completely.",
    "Make today useful, even if it isn't extraordinary.",
    "The hardest part is often just getting started.",
    "You don't need a perfect plan to make progress.",
    "Keep your focus on the next step, not the whole staircase.",
    "Your effort matters, even when nobody sees it.",
    "Take a breath, reset, and try again.",
    "You can always start again from where you are.",
    "A productive day starts with one intentional choice.",
    "Don't chase perfection. Chase improvement.",
    "Every small habit is shaping the person you're becoming.",
    "Keep going through the boring days. They build the strongest results.",
    "You don't have to finish everything. Finish something.",
    "Your pace is okay. Your direction matters more.",
    "Give yourself credit for the progress you've already made.",
    "One focused decision can break a whole day of procrastination.",
    "Keep putting in the work. It will add up.",
    "Today's effort may become tomorrow's opportunity.",
    "You are allowed to start small.",
    "Don't quit just because today feels difficult.",
    "A better future starts with what you choose to do now.",
    "Keep your promises to yourself, one day at a time.",
    "You don't need to be the best. Just keep getting better.",
    "Your current effort is creating your future options.",
    "Even when progress feels invisible, you're still learning.",
    "Do the next thing that moves you forward.",
    "One productive choice can change the rest of your day.",
    "Keep going, yaar. You've handled hard days before.",
    "You can rest without giving up.",
    "Don't let one bad day become a reason to stop.",
    "The goal is progress, not perfection.",
    "Your future is built from the choices you make today.",
    "Start where you are and make the next move.",
    "Consistency may feel boring, but the results won't be.",
    "Keep investing in yourself. You're worth the effort.",
    "You don't have to see the whole path to take the next step.",
    "One small win can create the momentum for another.",
    "Keep learning, keep trying, keep moving.",
    "Your best days are still ahead of you.",
    "Don't overthink the beginning. Just begin.",
    "A little discipline today can save you a lot of stress tomorrow.",
    "You are becoming stronger every time you choose to keep going.",
    "Make progress your priority, not perfection.",
    "Even if it's slow, you're moving in the right direction.",
    "Give today's version of you a chance to make tomorrow better.",
    "You don't need to do more. Sometimes you just need to focus better.",
    "Keep showing up for the life you're trying to build.",
    "One completed task can turn a stuck day around.",
    "Don't wait until you feel confident. Action creates confidence.",
    "Your small efforts are adding up behind the scenes.",
    "Keep going, even if all you can manage today is one step.",
    "You have more time to improve than you think.",
    "Make the next hour count. That's all you need to focus on.",
    "Every restart is another chance to do things differently.",
    "You're not aiming for perfect days. You're building better ones.",
    "Stay patient with yourself and consistent with your effort.",
    "Keep moving, yaar. The version of you you're working toward is worth it."

];
const voiceProfiles = [
    { id: "aria", name: "Aria", gender: "Female", avatar: "👩🏻‍🎓", lang: "en-IN", terms: /aria|heera|neerja/i, rate: 0.94, pitch: 1.18 },
    { id: "sara", name: "Sara", gender: "Female", avatar: "👩🏻‍🚀", lang: "en-US", terms: /sara|samantha|zira|susan|karen|victoria/i, rate: 0.96, pitch: 1.16 },
    { id: "aarav", name: "Aarav", gender: "Male", avatar: "🧑🏽‍🎓", lang: "en-IN", terms: /aarav|ravi|hemant/i, rate: 0.98, pitch: 0.92 },
    { id: "rohan", name: "Rohan", gender: "Male", avatar: "👨🏻‍💻", lang: "en-IN", terms: /rohan|ravi|hemant/i, rate: 1, pitch: 0.9 },
    { id: "leo", name: "Leo", gender: "Male", avatar: "👨🏽‍🚀", lang: "en-US", terms: /leo|david|mark|george|daniel/i, rate: 0.96, pitch: 0.9 }
];
const femaleVoiceHints = /aria|heera|neerja|sara|samantha|zira|susan|karen|victoria|female|woman|girl/i;
const maleVoiceHints = /male|man|boy|aarav|rohan|leo|david|mark|george|daniel|james|john|sam|ravi|hemant/i;

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

function dailyMotivation() {
    const dayNumber = Math.floor(new Date().setHours(0, 0, 0, 0) / 86400000);
    return motivationalLines[Math.abs(dayNumber) % motivationalLines.length];
}

function renderDailyMotivation() {
    const motivationElement = $("#dailyMotivation");
    if (motivationElement) motivationElement.textContent = dailyMotivation();
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
    if (voiceRepliesEnabled && "speechSynthesis" in window) { const profile = selectedVoiceProfile(); window.speechSynthesis.cancel(); const matchingVoice = findProfileVoice(profile); if (!matchingVoice) { $("#voiceStatus").textContent = `${profile.name} is set to a female voice, but this device has no female speech voice available. Install a female TTS voice in Windows/Chrome or switch browsers.`; return; } const utterance = new SpeechSynthesisUtterance(fullResponse); utterance.voice = matchingVoice; utterance.lang = matchingVoice.lang || profile.lang; utterance.rate = profile.rate; utterance.pitch = profile.pitch; $("#ariaFloatBtn").classList.add("aria-speaking"); utterance.addEventListener("end", () => $("#ariaFloatBtn").classList.remove("aria-speaking")); window.speechSynthesis.speak(utterance); }
}

function findProfileVoice(profile) {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const language = profile.lang.slice(0, 2).toLowerCase();
    const languageMatches = voices.filter((voice) => (voice.lang || "").toLowerCase().startsWith(language));
    if (profile.gender === "Female") {
        const femaleMatch = languageMatches.find((voice) => {
            const name = (voice.name || "").toLowerCase();
            const matchesProfile = profile.terms.test(voice.name) || femaleVoiceHints.test(name) || /female|woman|girl|zira|aria|samantha|victoria/.test(name);
            return matchesProfile && !maleVoiceHints.test(name) && !name.includes("male") && !name.includes("man") && !name.includes("david");
        });
        return femaleMatch || null;
    }
    return languageMatches[0] || null;
}

function speakVoiceSample(profile) {
    if (!("speechSynthesis" in window)) { $("#voiceStatus").textContent = "Voice samples are not supported in this browser."; return; }
    const matchingVoice = findProfileVoice(profile);
    if (!matchingVoice) { pendingVoiceSample = profile; $("#voiceStatus").textContent = `${profile.name} is set to a female voice, but no female speech voice is installed on this device. Install one in your OS/browser settings, then try again.`; return; }
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
    const mathExpression = cleanPrompt.replace(/^(what is|calculate|solve)\s+/i, "").replace(/\?$/, "").trim();
    const scienceAnswers = {
        photosynthesis: "Photosynthesis is the process plants use to make food from sunlight, water, and carbon dioxide. It produces glucose and releases oxygen.",
        gravity: "Gravity is the attractive force between objects with mass. On Earth, it accelerates falling objects at about 9.8 m/s².",
        force: "A force is a push or pull that can change an object's motion. Force is measured in newtons and is described by F = m × a.",
        atom: "An atom is the basic unit of an element. It has a nucleus containing protons and neutrons, surrounded by electrons.",
        dna: "DNA is the molecule that stores hereditary instructions. Its sequence helps cells make proteins and pass traits to new cells.",
        electricity: "Electricity is the movement or presence of electric charge. Current is measured in amperes, voltage in volts, and resistance in ohms."
    };
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
    } else if (/^[0-9+\-*/().%\s^]+$/.test(mathExpression) && /\d/.test(mathExpression)) {
        try { const result = Function(`"use strict"; return (${mathExpression.replace(/\^/g, "**")})`)(); response = Number.isFinite(result) ? `The answer is ${Number.isInteger(result) ? result : Number(result.toFixed(10))}.` : "I could not calculate that expression."; } catch (error) { response = "I could not calculate that expression."; }
    } else if (/^\d+$/.test(cleanPrompt)) {
        response = `You sent ${cleanPrompt}. Tell me what you want me to do with it, such as explain a topic, create a task, or make a study plan.`;
    } else if (/can we be friends?|be my friend|are you my friend/i.test(cleanPrompt)) {
        response = "Of course. I am happy to be your study companion. I can listen, help you learn, and keep you on track whenever you need me.";
    } else if (/thank you|thanks|thx/i.test(cleanPrompt)) {
        response = "You're welcome. I am glad I could help.";
    } else if (/^(bye|goodbye|see you|see ya)\b/i.test(cleanPrompt)) {
        response = "See you later. Keep going with your studies, one small step at a time.";
    } else if (/^[a-zA-Z]+$/.test(cleanPrompt) && cleanPrompt.length <= 6) {
        response = `I heard “${cleanPrompt}”. Could you tell me a little more about what you need?`;
    } else {
        const scienceTopic = Object.keys(scienceAnswers).find((topic) => cleanPrompt.toLowerCase().includes(topic));
        response = scienceTopic ? scienceAnswers[scienceTopic] : "I want to help with that. Could you add a little more detail or tell me the subject? For example: 'Explain gravity' or 'Make a study plan for biology.'";
    }
    deliverAssistantReply(response);
}

async function assistantReply(prompt) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const result = await fetch("http://localhost:8000/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, tasks: userData.tasks }), signal: controller.signal });
        clearTimeout(timeout);
        if (!result.ok) throw new Error("Aria service unavailable");
        const data = await result.json();
        if (data.task) { const task = { ...data.task, id: crypto.randomUUID() }; userData.tasks.unshift(task); saveData(); renderAll(); scheduleReminder(task); if (task.reminderAt) requestNotifications(); }
        if (data.provider === "offline") $("#voiceStatus").textContent = "I can help with study questions, tasks, reminders, and plans.";
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
    renderTasks(); renderNotes(); renderNotices(); renderClasses(); renderDailyMotivation();
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
    sanitizeStoredAssistantVoices();
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
    const session = localStorage.getItem(SESSION_KEY);
    if (session && users[session]) { currentUser = users[session]; userData = JSON.parse(localStorage.getItem(DATA_PREFIX + session) || "null") || defaultData(); userData = ensureSavedAssistantVoice(userData, DATA_PREFIX + session); showApp(); }
    $("#authToggle").addEventListener("click", () => { authMode = authMode === "login" ? "register" : "login"; $("#authTitle").textContent = authMode === "login" ? "Welcome back" : "Create your account"; $("#authSubtitle").textContent = authMode === "login" ? "Sign in to continue to your personal dashboard." : "Your notes, tasks, and progress belong to you."; $("#authNameField").classList.toggle("hidden", authMode === "login"); $("#authSubmit").textContent = authMode === "login" ? "Sign in" : "Create account"; $("#authToggle").textContent = authMode === "login" ? "New here? Create an account" : "Already have an account? Sign in"; });
    $("#authForm").addEventListener("submit", (event) => { event.preventDefault(); const email = $("#authEmail").value.trim().toLowerCase(); const password = $("#authPassword").value; const currentUsers = JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); if (authMode === "register") { const name = $("#authName").value.trim(); if (!name) return showAuthError("Please enter your name."); if (currentUsers[email]) return showAuthError("An account with this email already exists."); currentUsers[email] = { name, email, password, course: "", avatar: "🧑‍🎓", photo: "" }; localStorage.setItem(USERS_KEY, JSON.stringify(currentUsers)); localStorage.setItem(DATA_PREFIX + email, JSON.stringify(defaultData())); } else if (!currentUsers[email] || currentUsers[email].password !== password) return showAuthError("Email or password is incorrect."); currentUser = currentUsers[email]; userData = JSON.parse(localStorage.getItem(DATA_PREFIX + email) || "null") || defaultData(); userData = ensureSavedAssistantVoice(userData, DATA_PREFIX + email); localStorage.setItem(SESSION_KEY, email); showApp(); });
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

