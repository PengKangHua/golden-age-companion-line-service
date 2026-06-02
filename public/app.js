const userId = "demo-user";
const messagesEl = document.querySelector("#messages");
const form = document.querySelector("#messageForm");
const input = document.querySelector("#messageInput");
const pushButton = document.querySelector("#pushButton");
const imageButton = document.querySelector("#imageButton");
const dueButton = document.querySelector("#dueButton");
const runSchedulerButton = document.querySelector("#runSchedulerButton");
const eventsButton = document.querySelector("#eventsButton");
const metricsButton = document.querySelector("#metricsButton");
const applyPlanButton = document.querySelector("#applyPlanButton");
const debugPanel = document.querySelector("#debugPanel");
let selectedPlanId = "companion_plus";

async function loadMessages() {
  const response = await fetch(`/api/sim/messages/${encodeURIComponent(userId)}`);
  const data = await response.json();
  renderMessages(data.messages ?? []);
}

async function sendMessage(text) {
  if (!text.trim()) return;

  input.value = "";
  const response = await fetch("/api/sim/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, text })
  });
  const data = await response.json();
  renderMessages(data.messages ?? []);
  loadEvents();
}

async function fakePayment(planId) {
  const response = await fetch("/api/sim/fake-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, planId, source: "simulator" })
  });
  const data = await response.json();
  renderMessages(data.messages ?? []);
  loadEvents();
}

async function viewPlan(planId) {
  selectedPlanId = planId;
  const response = await fetch("/api/sim/fake-payment-view", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, planId, source: "simulator" })
  });
  const data = await response.json();
  debugPanel.textContent = `目前方案：${data.offer.title}\n${data.offer.priceLabel}\n${data.offer.description}`;
  loadEvents();
}

async function abandonPlan(reason) {
  const response = await fetch("/api/sim/fake-payment-abandon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, planId: selectedPlanId, reason, source: "simulator" })
  });
  await response.json();
  debugPanel.textContent = "已記錄放棄原因，不會扣款。";
  loadEvents();
}

async function pushCheckIn() {
  const response = await fetch("/api/sim/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId })
  });
  const data = await response.json();
  renderMessages(data.messages ?? []);
  loadEvents();
}

async function simulateImage() {
  const response = await fetch("/api/sim/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, messageId: `sim-image-${Date.now()}`, source: "simulator" })
  });
  const data = await response.json();
  renderMessages(data.messages ?? []);
  loadEvents();
}

async function loadDueCheckIns() {
  const response = await fetch(`/api/sim/due-check-ins?now=${encodeURIComponent(twoDaysFromNow())}`);
  const data = await response.json();
  debugPanel.textContent =
    data.dueUsers.length === 0
      ? "兩天後沒有到點用戶。"
      : data.dueUsers.map((user) => `${user.id} / ${user.experimentGroup} / ${user.cadence}`).join("\n");
}

async function runScheduler() {
  const response = await fetch("/api/sim/run-scheduler", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ now: twoDaysFromNow(), limit: 10 })
  });
  const data = await response.json();
  debugPanel.textContent =
    data.sent.length === 0
      ? "沒有送出新的主動問候。"
      : data.sent.map((item) => `${item.userId}: ${item.message}`).join("\n\n");
  await loadMessages();
  await loadEvents();
}

async function loadEvents() {
  const response = await fetch(`/api/sim/events/${encodeURIComponent(userId)}`);
  const data = await response.json();
  const events = data.events ?? [];
  debugPanel.textContent =
    events.length === 0
      ? "目前沒有事件。"
      : events
          .slice(-12)
          .map((event) => `${event.createdAt}  ${event.type}`)
          .join("\n");
}

async function loadMetrics() {
  const response = await fetch("/api/sim/metrics");
  const metrics = await response.json();
  debugPanel.textContent = [
    `用戶數：${metrics.totalUsers}`,
    `主動問候：${metrics.checkInsSent}`,
    `收到圖片：${metrics.imagesReceived}`,
    `方案瀏覽：${metrics.fakePaymentFunnel.viewed}`,
    `申請試用：${metrics.fakePaymentFunnel.clicked}`,
    `放棄方案：${metrics.fakePaymentFunnel.abandoned}`,
    "",
    "事件數：",
    ...Object.entries(metrics.eventCounts).map(([type, count]) => `${type}: ${count}`)
  ].join("\n");
}

function twoDaysFromNow() {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  return date.toISOString();
}

function renderMessages(messages) {
  messagesEl.innerHTML = "";

  if (messages.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "先按「跟我聊聊」，或直接輸入一句話。";
    messagesEl.append(empty);
    return;
  }

  for (const message of messages) {
    const bubble = document.createElement("article");
    bubble.className = `bubble ${message.role === "user" ? "user" : "assistant"}`;
    bubble.textContent = message.content;
    messagesEl.append(bubble);
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(input.value);
});

document.querySelectorAll("[data-send]").forEach((button) => {
  button.addEventListener("click", () => sendMessage(button.dataset.send));
});

document.querySelectorAll("[data-prefill]").forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.dataset.prefill;
    input.focus();
  });
});

document.querySelectorAll("[data-plan-view]").forEach((button) => {
  button.addEventListener("click", () => viewPlan(button.dataset.planView));
});

document.querySelectorAll("[data-abandon]").forEach((button) => {
  button.addEventListener("click", () => abandonPlan(button.dataset.abandon));
});

pushButton.addEventListener("click", pushCheckIn);
imageButton.addEventListener("click", simulateImage);
dueButton.addEventListener("click", loadDueCheckIns);
runSchedulerButton.addEventListener("click", runScheduler);
eventsButton.addEventListener("click", loadEvents);
metricsButton.addEventListener("click", loadMetrics);
applyPlanButton.addEventListener("click", () => fakePayment(selectedPlanId));

loadMessages();
loadEvents();
