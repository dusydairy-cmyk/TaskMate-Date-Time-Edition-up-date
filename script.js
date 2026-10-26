const STORAGE_KEY = "taskmate.tasks.v2";

const form = document.querySelector("#taskForm");
const titleInput = document.querySelector("#taskTitle");
const dateInput = document.querySelector("#taskDate");
const timeInput = document.querySelector("#taskTime");
const priorityInput = document.querySelector("#taskPriority");
const categoryInput = document.querySelector("#taskCategory");
const taskList = document.querySelector("#taskList");
const emptyState = document.querySelector("#emptyState");
const countLabel = document.querySelector("#taskCount");
const summaryLabel = document.querySelector("#taskSummary");
const statusFilter = document.querySelector("#filterStatus");
const sortSelect = document.querySelector("#sortTasks");
const todayLabel = document.querySelector("#todayLabel");

let tasks = loadTasks();

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setDefaultDateTime() {
  const now = new Date();
  dateInput.min = localDateString();
  dateInput.value = localDateString(now);
  now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5, 0, 0);
  timeInput.value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function loadTasks() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function dueDate(task) {
  return new Date(`${task.date}T${task.time}:00`);
}

function formatDue(task) {
  const due = dueDate(task);
  return due.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function isOverdue(task) {
  return !task.completed && dueDate(task).getTime() < Date.now();
}

function getDueState(task) {
  if (task.completed) return { text: "Completed", className: "done" };
  const diff = dueDate(task).getTime() - Date.now();
  if (diff < 0) return { text: "Overdue", className: "overdue" };
  if (diff <= 24 * 60 * 60 * 1000) return { text: "Due within 24 hours", className: "soon" };
  return { text: "Upcoming", className: "" };
}

function filteredTasks() {
  let result = [...tasks];
  const filter = statusFilter.value;
  if (filter === "completed") result = result.filter(task => task.completed);
  if (filter === "overdue") result = result.filter(isOverdue);
  if (filter === "upcoming") result = result.filter(task => !task.completed && !isOverdue(task));

  const priorityRank = { high: 0, medium: 1, low: 2 };
  switch (sortSelect.value) {
    case "date-desc":
      result.sort((a, b) => dueDate(b) - dueDate(a));
      break;
    case "priority":
      result.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || dueDate(a) - dueDate(b));
      break;
    case "created":
      result.sort((a, b) => b.createdAt - a.createdAt);
      break;
    default:
      result.sort((a, b) => dueDate(a) - dueDate(b));
  }
  return result;
}

function renderTasks() {
  const visibleTasks = filteredTasks();
  taskList.innerHTML = "";
  emptyState.hidden = visibleTasks.length > 0;

  visibleTasks.forEach(task => {
    const dueState = getDueState(task);
    const card = document.createElement("article");
    card.className = `task-card${task.completed ? " completed" : ""}`;
    card.innerHTML = `
      <button class="check-btn" type="button" data-action="toggle" data-id="${task.id}"
        aria-label="${task.completed ? "Mark incomplete" : "Mark complete"}">${task.completed ? "✓" : ""}</button>
      <div class="task-content">
        <p class="task-title">${escapeHTML(task.title)}</p>
        <div class="task-meta">
          <span class="due-label ${dueState.className}">◷ ${escapeHTML(formatDue(task))}</span>
          <span class="priority ${escapeHTML(task.priority)}">${escapeHTML(task.priority[0].toUpperCase() + task.priority.slice(1))} priority</span>
          ${task.category ? `<span class="meta-pill">${escapeHTML(task.category)}</span>` : ""}
          <span class="due-label ${dueState.className}">${escapeHTML(dueState.text)}</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn" type="button" data-action="edit" data-id="${task.id}" aria-label="Edit task">Edit</button>
        <button class="icon-btn delete" type="button" data-action="delete" data-id="${task.id}" aria-label="Delete task">Delete</button>
      </div>`;
    taskList.appendChild(card);
  });

  const incomplete = tasks.filter(task => !task.completed).length;
  const overdue = tasks.filter(isOverdue).length;
  countLabel.textContent = String(visibleTasks.length);
  summaryLabel.textContent = `${incomplete} unfinished · ${overdue} overdue`;
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const date = dateInput.value;
  const time = timeInput.value;
  if (!title || !date || !time) return;

  const task = {
    id: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    title,
    date,
    time,
    priority: priorityInput.value,
    category: categoryInput.value.trim(),
    completed: false,
    createdAt: Date.now()
  };
  tasks.push(task);
  saveTasks();
  renderTasks();
  form.reset();
  setDefaultDateTime();
  priorityInput.value = "medium";
  titleInput.focus();
});

taskList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const task = tasks.find(item => item.id === button.dataset.id);
  if (!task) return;

  switch (button.dataset.action) {
    case "toggle":
      task.completed = !task.completed;
      saveTasks();
      renderTasks();
      break;
    case "delete":
      if (confirm(`Delete "${task.title}"?`)) {
        tasks = tasks.filter(item => item.id !== task.id);
        saveTasks();
        renderTasks();
      }
      break;
    case "edit":
      titleInput.value = task.title;
      dateInput.value = task.date;
      timeInput.value = task.time;
      priorityInput.value = task.priority;
      categoryInput.value = task.category || "";
      tasks = tasks.filter(item => item.id !== task.id);
      saveTasks();
      renderTasks();
      titleInput.focus();
      document.querySelector("#addTaskHeading").textContent = "Edit task — save your changes";
      break;
  }
});

statusFilter.addEventListener("change", renderTasks);
sortSelect.addEventListener("change", renderTasks);

todayLabel.textContent = new Date().toLocaleDateString(undefined, {
  weekday: "short", month: "short", day: "numeric"
});
setDefaultDateTime();
renderTasks();
