(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const state = {
    chats: [],
    activeChatId: null,
    busy: false,
    settings: { theme: "dark", mode: "normal" }
  };

  const STORAGE_KEY = "nexa2_chats";
  const SETTINGS_KEY = "nexa2_settings";
  const MAX_STORED_CHATS = 50;

  const makeId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function formatText(value) {
    let text = escapeHtml(value);
    const codeBlocks = [];
    text = text.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, language, code) => {
      const label = language ? `<small>${escapeHtml(language)}</small>` : "";
      const html = `<pre>${label}<code>${code.trim()}</code></pre>`;
      codeBlocks.push(html);
      return `@@CODEBLOCK${codeBlocks.length - 1}@@`;
    });
    text = text.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
    text = text.split("\n").map(line => line || "&nbsp;").join("<br>");
    return text.replace(/@@CODEBLOCK(\d+)@@/g, (_, index) => codeBlocks[Number(index)]);
  }

  function loadSavedData() {
    try {
      const chats = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      state.chats = Array.isArray(chats) ? chats : [];
      state.settings = {
        ...state.settings,
        ...(settings && typeof settings === "object" ? settings : {})
      };
    } catch (error) {
      console.warn("Could not load saved NEXA data:", error);
      state.chats = [];
    }
  }

  function saveChats() {
    try {
      state.chats = state.chats.slice(0, MAX_STORED_CHATS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.chats));
    } catch (error) {
      console.warn("Could not save chat history:", error);
    }
  }

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); }
    catch (error) { console.warn("Could not save settings:", error); }
  }

  function getActiveChat() {
    return state.chats.find(chat => chat.id === state.activeChatId);
  }

  function createChat() {
    const chat = { id: makeId(), title: "New chat", messages: [], createdAt: Date.now() };
    state.chats.unshift(chat);
    state.activeChatId = chat.id;
    saveChats();
    renderChatList();
    renderMessages();
    closeSidebarOnMobile();
    return chat;
  }

  function setActiveChat(id) {
    if (!state.chats.some(chat => chat.id === id)) return;
    state.activeChatId = id;
    renderChatList();
    renderMessages();
    closeSidebarOnMobile();
  }

  function deleteChat(id) {
    state.chats = state.chats.filter(chat => chat.id !== id);
    if (state.activeChatId === id) state.activeChatId = state.chats[0]?.id || null;
    saveChats();
    if (!state.activeChatId) createChat();
    else { renderChatList(); renderMessages(); }
  }

  function renderChatList(filter = "") {
    const container = $("chatList");
    if (!container) return;
    const query = filter.trim().toLowerCase();
    const chats = state.chats.filter(chat => String(chat.title || "New chat").toLowerCase().includes(query));

    if (!chats.length) {
      container.innerHTML = '<div class="empty-history">No chats found</div>';
      return;
    }

    container.innerHTML = chats.map(chat => `
      <div class="chat-item ${chat.id === state.activeChatId ? "active" : ""}" data-chat-id="${escapeHtml(chat.id)}">
        <button class="history-open" data-open-chat="${escapeHtml(chat.id)}" type="button">
          <span class="history-icon"><i class="fas fa-message"></i></span>
          <span class="chat-title">${escapeHtml(chat.title || "New chat")}</span>
        </button>
        <button class="history-delete" data-delete-chat="${escapeHtml(chat.id)}" type="button" aria-label="Delete chat">×</button>
      </div>
    `).join("");
  }

  function renderMessages() {
    const container = $("messages");
    const welcome = $("welcome");
    if (!container) return;

    const messages = getActiveChat()?.messages || [];
    if (welcome) welcome.hidden = messages.length > 0;

    container.innerHTML = messages.map(message => `
      <article class="message ${message.role === "user" ? "user" : "assistant"}">
        <div class="message-avatar">${message.role === "user" ? "You" : "N"}</div>
        <div class="message-content">
          <div class="message-label">${message.role === "user" ? "You" : "NEXA"}</div>
          <div class="message-text">${formatText(message.content)}</div>
          ${message.role === "assistant" ? `
            <div class="message-actions">
              <button type="button" data-copy-message="${escapeHtml(message.id || "")}"><i class="fas fa-copy"></i> Copy</button>
            </div>` : ""}
        </div>
      </article>
    `).join("");

    container.scrollTop = container.scrollHeight;
  }

  function addMessage(role, content) {
    let chat = getActiveChat();
    if (!chat) chat = createChat();
    const message = { id: makeId(), role, content: String(content), timestamp: Date.now() };
    chat.messages.push(message);
    if (role === "user" && (chat.title === "New chat" || !chat.title)) {
      chat.title = message.content.replace(/\s+/g, " ").slice(0, 38) || "New chat";
    }
    saveChats();
    renderChatList($("searchChats")?.value || "");
    renderMessages();
  }

  function setBusy(busy) {
    state.busy = busy;
    const sendButton = $("sendBtn");
    const input = $("userInput");
    if (sendButton) {
      sendButton.disabled = busy;
      sendButton.innerHTML = busy ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-arrow-up"></i>';
    }
    if (input) input.disabled = busy;
    const status = document.querySelector(".status-indicator");
    if (status) status.innerHTML = busy
      ? '<span class="status-dot"></span> NEXA is thinking…'
      : '<span class="status-dot"></span> Local Workspace';
  }

  async function postJson(url, data) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || result.message || `Request failed (${response.status})`);
    return result;
  }

  function extractReply(result) {
    if (typeof result === "string") return result;
    return result?.reply || result?.response || result?.text || result?.message || result?.answer || "I received a response, but it was empty.";
  }

  async function sendMessage(overrideMessage = "") {
    if (state.busy) return;
    const input = $("userInput");
    const message = (overrideMessage || input?.value || "").trim();
    if (!message) return;

    if (input) { input.value = ""; input.style.height = "auto"; }
    const chatBeforeSending = getActiveChat();
    const history = (chatBeforeSending?.messages || []).slice(-12).map(item => ({ role: item.role, content: item.content }));
    addMessage("user", message);
    setBusy(true);

    try {
      const result = await postJson("/api/chat", { message, mode: state.settings.mode || "normal", history });
      addMessage("assistant", extractReply(result));
    } catch (error) {
      addMessage("assistant", `I couldn't connect to the AI service.\n\n${error.message}\n\nMake sure the NEXA server is running and your OpenRouter key is configured in .env.`);
    } finally {
      setBusy(false);
      input?.focus();
    }
  }

  function showModal(title, html, allowHtml = false) {
    const overlay = $("modalOverlay");
    const titleElement = $("modalTitle");
    const body = $("modalBody");
    if (!overlay) return alert(`${title}\n\n${html}`);
    if (titleElement) titleElement.textContent = title;
    if (body) {
      if (allowHtml) body.innerHTML = html;
      else body.textContent = html;
    }
    overlay.classList.remove("hidden");
  }

  function closeModal() { $("modalOverlay")?.classList.add("hidden"); }

  function openJobTool() {
    showModal("Job Skills Analyzer", `
      <p>Paste the skills you have and the job description you are targeting.</p>
      <label for="job-skills">Your skills</label>
      <textarea id="job-skills" placeholder="Python, JavaScript, communication, teamwork..."></textarea>
      <label for="job-description">Job description</label>
      <textarea id="job-description" placeholder="Paste the job description here..."></textarea>
      <button id="job-analyze-button" class="btn primary" type="button"><i class="fas fa-magnifying-glass"></i> Analyze Match</button>
    `, true);
    $("job-analyze-button")?.addEventListener("click", analyzeJob);
  }

  async function analyzeJob() {
    const skills = $("job-skills")?.value.trim() || "";
    const description = $("job-description")?.value.trim() || "";
    if (!skills || !description) return showModal("Job Analyzer", "Please enter both your skills and the job description.");

    setBusy(true);
    try {
      const result = await postJson("/api/job-analyzer", { skills, jobDescription: description });
      const output = `JOB MATCH: ${result.matchPercentage}%\n\nMatched keywords:\n${result.matchedKeywords.join(", ") || "None"}\n\nKeywords to develop:\n${result.suggestedKeywordsToDevelop.join(", ") || "None"}\n\n${result.summary}\n\n${result.note}`;
      closeModal();
      createChat();
      addMessage("user", "Analyze my skills for this job.");
      addMessage("assistant", output);
    } catch (error) {
      showModal("Job Analyzer Error", error.message);
    } finally { setBusy(false); }
  }

  function openFoodTool() {
    showModal("Indian Food Assistant", `
      <p>Tell NEXA what ingredients you have. It will suggest simple Indian-friendly options.</p>
      <label for="food-ingredients">Ingredients</label>
      <textarea id="food-ingredients" placeholder="rice, potato, onion, tomato..."></textarea>
      <label for="food-preference">Preference (optional)</label>
      <input id="food-preference" placeholder="vegetarian / vegan / no preference">
      <button id="food-suggest-button" class="btn primary" type="button"><i class="fas fa-utensils"></i> Suggest Food</button>
    `, true);
    $("food-suggest-button")?.addEventListener("click", suggestFood);
  }

  async function suggestFood() {
    const ingredients = $("food-ingredients")?.value.trim() || "";
    const preferences = $("food-preference")?.value.trim() || "";
    if (!ingredients) return showModal("Food Assistant", "Please enter at least one ingredient.");

    setBusy(true);
    try {
      const result = await postJson("/api/food-assistant", { ingredients, preferences });
      const output = result.suggestions.map((item, index) =>
        `${index + 1}. ${item.name}\nUses: ${item.matchedIngredients.join(", ") || "limited match"}\n${item.description}`
      ).join("\n\n") + `\n\n${result.note}`;
      closeModal();
      createChat();
      addMessage("user", `Suggest food using: ${ingredients}${preferences ? ` (${preferences})` : ""}`);
      addMessage("assistant", output);
    } catch (error) {
      showModal("Food Assistant Error", error.message);
    } finally { setBusy(false); }
  }

  async function checkConnection() {
    try {
      const response = await fetch("/api/status");
      const result = await response.json();
      showModal("NEXA Connection", response.ok
        ? `Server is online.\n\n${JSON.stringify(result, null, 2)}`
        : "The server responded with an error.");
    } catch {
      showModal("Connection Error", "Cannot reach the NEXA server. Run npm.cmd start in the NEXA_2.0 folder.");
    }
  }

  function openTools() {
    showModal("NEXA Tools", `
      <button id="tool-job" class="btn ghost" type="button"><i class="fas fa-briefcase"></i> Job Skills Analyzer</button>
      <button id="tool-food" class="btn ghost" type="button"><i class="fas fa-utensils"></i> Indian Food Assistant</button>
      <button id="tool-status" class="btn ghost" type="button"><i class="fas fa-server"></i> Test NEXA Server</button>
    `, true);
    $("tool-job")?.addEventListener("click", openJobTool);
    $("tool-food")?.addEventListener("click", openFoodTool);
    $("tool-status")?.addEventListener("click", checkConnection);
  }

  function openSettings() {
    showModal("NEXA Settings", `
      <div class="theme-settings-group">
        <label>Choose your NEXA design</label>
        <div class="theme-choice-row">
          <button type="button" class="theme-choice" data-theme-family="aurora">
            <span class="theme-swatch aurora"></span>
            <strong>Aurora</strong>
            <small>Futuristic • Midnight • Cyan and violet</small>
          </button>
          <button type="button" class="theme-choice" data-theme-family="bloom">
            <span class="theme-swatch bloom"></span>
            <strong>Bloom</strong>
            <small>Warm • Friendly • Lavender and mint</small>
          </button>
        </div>
      </div>
      <div class="theme-settings-group">
        <label for="settings-theme">Appearance</label>
        <select id="settings-theme">
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </div>
      <label for="settings-mode">Default mode</label>
      <select id="settings-mode">
        <option value="normal">Normal Chat</option><option value="study">Study Mode</option><option value="coding">Coding Mode</option>
        <option value="research">Research Mode</option><option value="creative">Creative Mode</option><option value="job">Job Mode</option>
        <option value="quick">Quick Answer</option><option value="deep">Deep Analysis</option>
      </select>
      <button id="settings-save" class="btn primary" type="button">Save Settings</button>
      <button id="settings-clear" class="btn ghost" type="button">Clear Saved Chats</button>
    `, true);

    let selectedFamily = state.settings.themeFamily === "bloom" ? "bloom" : "aurora";

    const updateThemeChoices = () => {
      document.querySelectorAll("[data-theme-family]").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.themeFamily === selectedFamily));
      });
    };

    document.querySelectorAll("[data-theme-family]").forEach(button => {
      button.addEventListener("click", () => {
        selectedFamily = button.dataset.themeFamily;
        updateThemeChoices();
        state.settings.themeFamily = selectedFamily;
        applyTheme();
        saveSettings();
      });
    });

    $("settings-theme").value = state.settings.theme || "dark";
    $("settings-theme").addEventListener("change", () => {
      state.settings.theme = $("settings-theme").value;
      applyTheme();
      saveSettings();
    });

    updateThemeChoices();
    $("settings-mode").value = state.settings.mode || "normal";

    $("settings-save")?.addEventListener("click", () => {
      state.settings.themeFamily = selectedFamily;
      state.settings.theme = $("settings-theme").value;
      state.settings.mode = $("settings-mode").value;
      $("modeSelect").value = state.settings.mode;
      applyTheme();
      saveSettings();
      closeModal();
    });

    $("settings-clear")?.addEventListener("click", () => {
      if (confirm("Clear all saved chats?")) {
        state.chats = [];
        state.activeChatId = null;
        saveChats();
        createChat();
        closeModal();
      }
    });
  }
  function applyTheme() {
    const family = state.settings.themeFamily === "bloom" ? "bloom" : "aurora";
    const theme = state.settings.theme === "light" ? "light" : "dark";

    state.settings.themeFamily = family;
    state.settings.theme = theme;

    document.body.classList.remove("theme-aurora", "theme-bloom");
    document.body.classList.add(`theme-${family}`);
    document.body.classList.toggle("light", theme === "light");

    const icon = $("themeBtn")?.querySelector("i");
    if (icon) icon.className = theme === "light" ? "fas fa-sun" : "fas fa-moon";
    $("themeBtn")?.setAttribute("aria-label", `Switch to ${theme === "light" ? "dark" : "light"} appearance`);
  }
  function closeSidebarOnMobile() {
    if (window.innerWidth <= 800) $("sidebar")?.classList.remove("open");
  }

  function bindEvents() {
    $("newChatBtn")?.addEventListener("click", createChat);
    $("sendBtn")?.addEventListener("click", () => sendMessage());
    $("userInput")?.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); }
    });
    $("userInput")?.addEventListener("input", event => {
      event.target.style.height = "auto";
      event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px`;
    });
    $("searchChats")?.addEventListener("input", event => renderChatList(event.target.value));
    $("chatList")?.addEventListener("click", event => {
      const deleteButton = event.target.closest("[data-delete-chat]");
      const openButton = event.target.closest("[data-open-chat]");
      if (deleteButton) {
        event.stopPropagation();
        if (confirm("Delete this chat?")) deleteChat(deleteButton.dataset.deleteChat);
      } else if (openButton) setActiveChat(openButton.dataset.openChat);
    });
    $("modeSelect")?.addEventListener("change", event => {
      state.settings.mode = event.target.value;
      saveSettings();
    });
    $("themeBtn")?.addEventListener("click", () => {
      state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
      applyTheme(); saveSettings();
    });
    $("toggleSidebar")?.addEventListener("click", () => $("sidebar")?.classList.toggle("open"));
    $("toolsBtn")?.addEventListener("click", openTools);
    $("settingsBtn")?.addEventListener("click", openSettings);
    $("closeModal")?.addEventListener("click", closeModal);
    $("modalOverlay")?.addEventListener("click", event => { if (event.target === $("modalOverlay")) closeModal(); });
    document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => {
      const mode = button.dataset.mode;
      state.settings.mode = mode;
      $("modeSelect").value = mode;
      saveSettings();
      $("userInput")?.focus();
    }));
    document.querySelectorAll("[data-tool]").forEach(button => button.addEventListener("click", () => {
      if (button.dataset.tool === "job") openJobTool();
      if (button.dataset.tool === "food") openFoodTool();
    }));
    $("messages")?.addEventListener("click", async event => {
      const button = event.target.closest("[data-copy-message]");
      if (!button) return;
      const chat = getActiveChat();
      const message = chat?.messages.find(item => item.id === button.dataset.copyMessage);
      if (!message) return;
      try { await navigator.clipboard.writeText(message.content); button.innerHTML = '<i class="fas fa-check"></i> Copied'; setTimeout(() => { button.innerHTML = '<i class="fas fa-copy"></i> Copy'; }, 1200); }
      catch { showModal("Copy failed", "Your browser did not allow clipboard access."); }
    });
  }

  function init() {
    loadSavedData();
    applyTheme();
    bindEvents();
    const mode = state.settings.mode || "normal";
    $("modeSelect").value = mode;
    if (!state.chats.length) createChat();
    else { state.activeChatId = state.chats[0].id; renderChatList(); renderMessages(); }
    console.log("NEXA 2.0 frontend initialized.");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
