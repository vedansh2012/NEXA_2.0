(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const state = {
    chats: [],
    activeChatId: null,
    busy: false,
    settings: {
      theme: "dark",
      mode: "normal"
    }
  };

  const STORAGE_KEY = "nexa2_chats";
  const SETTINGS_KEY = "nexa2_settings";

  function makeId() {
    return Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function formatText(value) {
    let text = escapeHtml(value);

    text = text.replace(
      /```([\w-]*)\n?([\s\S]*?)```/g,
      (_, language, code) =>
        `<pre><code>${code.trim()}</code></pre>`
    );

    text = text.replace(
      /`([^`\n]+)`/g,
      "<code>$1</code>"
    );

    text = text.replace(
      /\*\*(.+?)\*\*/g,
      "<strong>$1</strong>"
    );

    text = text.replace(
      /\*(.+?)\*/g,
      "<em>$1</em>"
    );

    return text
      .split("\n")
      .map((line) => line || "&nbsp;")
      .join("<br>");
  }

  function loadSavedData() {
    try {
      state.chats = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

      state.settings = {
        ...state.settings,
        ...JSON.parse(
          localStorage.getItem(SETTINGS_KEY) || "{}"
        )
      };
    } catch {
      state.chats = [];
    }

    if (!Array.isArray(state.chats)) {
      state.chats = [];
    }
  }

  function saveChats() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state.chats)
      );
    } catch (error) {
      console.warn("Could not save chat history:", error);
    }
  }

  function saveSettings() {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify(state.settings)
    );
  }

  function getActiveChat() {
    return state.chats.find(
      (chat) => chat.id === state.activeChatId
    );
  }

  function createChat() {
    const chat = {
      id: makeId(),
      title: "New chat",
      messages: [],
      createdAt: Date.now()
    };

    state.chats.unshift(chat);
    state.activeChatId = chat.id;

    saveChats();
    renderChatList();
    renderMessages();
    closeSidebarOnMobile();

    return chat;
  }

  function setActiveChat(id) {
    state.activeChatId = id;
    renderChatList();
    renderMessages();
    closeSidebarOnMobile();
  }

  function deleteChat(id) {
    state.chats = state.chats.filter(
      (chat) => chat.id !== id
    );

    if (state.activeChatId === id) {
      state.activeChatId = state.chats[0]?.id || null;
    }

    saveChats();

    if (!state.activeChatId) {
      createChat();
    } else {
      renderChatList();
      renderMessages();
    }
  }

  function renderChatList(filter = "") {
    const container = $("chat-list");
    if (!container) return;

    const query = filter.toLowerCase();

    const chats = state.chats.filter((chat) =>
      chat.title.toLowerCase().includes(query)
    );

    if (!chats.length) {
      container.innerHTML =
        '<div class="empty-history">No chats found</div>';
      return;
    }

    container.innerHTML = chats.map((chat) => `
      <div class="chat-history-item ${
        chat.id === state.activeChatId ? "active" : ""
      }" data-chat-id="${escapeHtml(chat.id)}">
        <button class="history-open" data-open-chat="${escapeHtml(chat.id)}">
          <span class="history-icon">â—·</span>
          <span class="history-title">${escapeHtml(chat.title)}</span>
        </button>
        <button class="history-delete"
          data-delete-chat="${escapeHtml(chat.id)}"
          aria-label="Delete chat">Ã—</button>
      </div>
    `).join("");
  }

  function renderMessages() {
    const container = $("messages");
    const welcome = $("welcome-screen");

    if (!container) return;

    const chat = getActiveChat();
    const messages = chat?.messages || [];
    const hasMessages = messages.length > 0;

    if (welcome) {
      welcome.hidden = hasMessages;
    }

    container.innerHTML = messages.map((message) => `
      <article class="message ${message.role === "user" ? "user-message" : "assistant-message"}">
        <div class="message-avatar">
          ${message.role === "user" ? "You" : "N"}
        </div>
        <div class="message-content">
          <div class="message-label">
            ${message.role === "user" ? "You" : "NEXA"}
          </div>
          <div class="message-text">${formatText(message.content)}</div>
        </div>
      </article>
    `).join("");

    container.scrollTop = container.scrollHeight;
  }

  function addMessage(role, content) {
    let chat = getActiveChat();

    if (!chat) {
      chat = createChat();
    }

    chat.messages.push({
      role,
      content: String(content),
      timestamp: Date.now()
    });

    if (
      role === "user" &&
      (chat.title === "New chat" || !chat.title)
    ) {
      chat.title = String(content).slice(0, 38);
    }

    saveChats();
    renderChatList();
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

    if (input) {
      input.disabled = busy;
    }

    const indicator = $("typing-indicator");

    if (indicator) {
      indicator.hidden = !busy;
    }
  }

  async function postJson(url, data) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.error ||
        result.message ||
        `Request failed (${response.status})`
      );
    }

    return result;
  }

  function extractReply(result) {
    if (typeof result === "string") return result;

    return (
      result.reply ||
      result.response ||
      result.text ||
      result.message ||
      result.answer ||
      "I received a response, but it was empty."
    );
  }

  async function sendMessage(overrideMessage = "") {
    if (state.busy) return;

    const input = $("userInput");
    const message = (
      overrideMessage ||
      input?.value ||
      ""
    ).trim();

    if (!message) return;

    if (input) {
      input.value = "";
      input.style.height = "auto";
    }

    const chatBeforeSending = getActiveChat();

    const history = (chatBeforeSending?.messages || [])
      .slice(-12)
      .map((item) => ({
        role: item.role,
        content: item.content
      }));

    addMessage("user", message);

    setBusy(true);

    try {
      const result = await postJson("/api/chat", {
        message,
        mode: state.settings.mode || "normal",
        history
      });

      addMessage("assistant", extractReply(result));
    } catch (error) {
      addMessage(
        "assistant",
        `I couldn't connect to the AI service.\n\n${error.message}\n\nPlease check that the NEXA server is running and your API settings are correct.`
      );
    } finally {
      setBusy(false);
      input?.focus();
    }
  }

  async function analyzeJob() {
    const skills = $("job-skills")?.value.trim();
    const description = $("job-description")?.value.trim();

    if (!skills || !description) {
      showModal(
        "Job Analyzer",
        "Please enter both your skills and the job description."
      );
      return;
    }

    setBusy(true);

    try {
      const result = await postJson("/api/job-analyzer", {
        skills,
        description
      });

      createChat();
      addMessage("user", "Analyze my skills for this job.");
      addMessage("assistant", extractReply(result));
      closeModal();
    } catch (error) {
      showModal("Job Analyzer Error", error.message);
    } finally {
      setBusy(false);
    }
  }

  async function suggestFood() {
    const ingredients = $("food-ingredients")?.value.trim() || "";
    const preference = $("food-preference")?.value.trim() || "";

    setBusy(true);

    try {
      const result = await postJson("/api/food-assistant", {
        ingredients,
        preference
      });

      createChat();
      addMessage("user", "Suggest food I can make.");
      addMessage("assistant", extractReply(result));
      closeModal();
    } catch (error) {
      showModal("Food Assistant Error", error.message);
    } finally {
      setBusy(false);
    }
  }

  async function checkConnection() {
    try {
      const response = await fetch("/api/status");
      const result = await response.json();

      showModal(
        "NEXA Connection",
        response.ok
          ? `Server response received.\n${JSON.stringify(result, null, 2)}`
          : "The server responded, but reported an error."
      );
    } catch {
      showModal(
        "Connection Error",
        "Cannot reach the NEXA server. Make sure node server.js is running."
      );
    }
  }

  function showModal(title, content) {
    const modal = $("modal-overlay");
    const titleElement = $("modal-title");
    const body = $("modal-body");

    if (!modal) {
      alert(`${title}\n\n${content}`);
      return;
    }

    if (titleElement) titleElement.textContent = title;
    if (body) body.textContent = content;

    modal.hidden = false;
    modal.classList.add("open");
  }

  function closeModal() {
    const modal = $("modal-overlay");

    if (modal) {
      modal.classList.remove("open");
      modal.hidden = true;
    }
  }

  function closeSidebarOnMobile() {
    if (window.innerWidth <= 760) {
      $("sidebar")?.classList.remove("open");
    }
  }

  function applyTheme() {
    document.documentElement.dataset.theme =
      state.settings.theme || "dark";
  }

  function bindEvents() {
    $("new-chat-button")?.addEventListener("click", createChat);
    $("new-chat")?.addEventListener("click", createChat);

    $("sendBtn")?.addEventListener("click", () => {
      sendMessage();
    });

    $("message-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      sendMessage();
    });

    $("userInput")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });

    $("userInput")?.addEventListener("input", (event) => {
      const input = event.target;
      input.style.height = "auto";
      input.style.height =
        Math.min(input.scrollHeight, 180) + "px";
    });

    $("chat-list")?.addEventListener("click", (event) => {
      const openButton = event.target.closest("[data-open-chat]");
      const deleteButton = event.target.closest("[data-delete-chat]");

      if (deleteButton) {
        event.stopPropagation();

        const id = deleteButton.dataset.deleteChat;

        if (confirm("Delete this chat?")) {
          deleteChat(id);
        }

        return;
      }

      if (openButton) {
        setActiveChat(openButton.dataset.openChat);
      }
    });

    $("chat-search")?.addEventListener("input", (event) => {
      renderChatList(event.target.value);
    });

    $("mode-selector")?.addEventListener("change", (event) => {
      state.settings.mode = event.target.value;
      saveSettings();
    });

    $("theme-toggle")?.addEventListener("click", () => {
      state.settings.theme =
        state.settings.theme === "dark" ? "light" : "dark";

      applyTheme();
      saveSettings();
    });

    $("connection-test")?.addEventListener(
      "click",
      checkConnection
    );

    $("job-analyze-button")?.addEventListener(
      "click",
      analyzeJob
    );

    $("food-suggest-button")?.addEventListener(
      "click",
      suggestFood
    );

    $("close-modal")?.addEventListener("click", closeModal);

    $("modal-overlay")?.addEventListener("click", (event) => {
      if (event.target.id === "modal-overlay") {
        closeModal();
      }
    });

    $("menu-toggle")?.addEventListener("click", () => {
      $("sidebar")?.classList.toggle("open");
    });

    document.querySelectorAll("[data-prompt]").forEach((button) => {
      button.addEventListener("click", () => {
        const prompt = button.dataset.prompt || "";
        sendMessage(prompt);
      });
    });

    document.querySelectorAll("[data-open-tool]").forEach((button) => {
      button.addEventListener("click", () => {
        const tool = button.dataset.openTool;

        if (tool === "job") {
          showModal(
            "Job Skills Analyzer",
            "Open the Job Analyzer section to enter your skills and the job description."
          );
        } else if (tool === "food") {
          showModal(
            "Food Assistant",
            "Open the Food Assistant section to enter available ingredients."
          );
        } else {
          showModal(
            "NEXA Tools",
            "This tool will be connected after the backend is verified."
          );
        }
      });
    });

    $("clear-history")?.addEventListener("click", () => {
      if (confirm("Clear all saved chats?")) {
        state.chats = [];
        state.activeChatId = null;
        saveChats();
        createChat();
      }
    });
  }

  function init() {
    loadSavedData();
    applyTheme();
    bindEvents();

    const modeSelector = $("mode-selector");

    if (modeSelector) {
      modeSelector.value = state.settings.mode || "normal";
    }

    if (!state.chats.length) {
      createChat();
    } else {
      state.activeChatId = state.chats[0].id;
      renderChatList();
      renderMessages();
    }

    console.log("NEXA 2.0 frontend initialized.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
