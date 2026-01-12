/* ============================================================
   CAMPUS AI - CLEAN & OPTIMIZED CHATBOT SCRIPT
   Backend URL: http://localhost:5000/api/chat
   Response Format: { reply: "..." }
============================================================ */

/* ------------------------
   GLOBAL STATE
------------------------ */
let appState = {
    chats: [],
    activeChatId: null,
    attachedFiles: []
};

const DOM = {
    input: document.getElementById("input"),
    messages: document.getElementById("messages"),
    filePreview: document.getElementById("filePreview"),
    fileInput: document.getElementById("fileInput"),
    imageInput: document.getElementById("imageInput"),
    history: document.querySelector(".history"),
    attachMenu: document.getElementById("attachMenu"),
    attachBtn: document.getElementById("attachBtn"),
    sendBtn: document.querySelector(".send-btn"),
    chatIdDisplay: document.getElementById("chatIdDisplay"),
    scrollBtn: document.getElementById("scrollDownBtn"),
    scrollCenterBtn: document.getElementById("scrollTopCenterBtn"),


};

/* ------------------------
   INIT APP
------------------------ */
document.addEventListener("DOMContentLoaded", () => {
    loadState();
    bindEvents();
    renderApp();

    if (appState.chats.length === 0) createNewChat();
});

/* ------------------------
   STORAGE
------------------------ */
function saveState() {
    localStorage.setItem("campus_ai_chat", JSON.stringify(appState));
}

function loadState() {
    const saved = localStorage.getItem("campus_ai_chat");
    if (saved) appState = JSON.parse(saved);
}

/* ------------------------
   BIND EVENTS
------------------------ */
function bindEvents() {
    if (DOM.sendBtn) DOM.sendBtn.addEventListener("click", sendMessage);
    if (DOM.input) {
        DOM.input.addEventListener("keydown", handleInputKeydown);
        DOM.input.addEventListener("input", autoResize);
    }
    if (DOM.scrollCenterBtn) {
    DOM.scrollCenterBtn.addEventListener("click", scrollToBottomInstant);
    }


    if (DOM.attachBtn) DOM.attachBtn.addEventListener("click", toggleAttachMenu);

    if (DOM.fileInput) DOM.fileInput.addEventListener("change", handleFileSelect);
    if (DOM.imageInput) DOM.imageInput.addEventListener("change", handleFileSelect);

    const newChatBtn = document.querySelector(".new-chat");
    if (newChatBtn) newChatBtn.addEventListener("click", createNewChat);

    // 🔥 Global click handler (existing)
    document.addEventListener("click", (e) => {
        const menu = document.getElementById("globalMenu");

        if (!e.target.closest(".menu-btn") && !e.target.closest(".global-menu")) {
            menu.classList.remove("show");
        }

        // Attach menu outside click
        if (!e.target.closest(".menu-wrapper") && !e.target.closest("#attachBtn")) {
            DOM.attachMenu.classList.remove("show");
        }
    });


    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("regen-btn")) {
            const ts = e.target.getAttribute("data-timestamp");
            regenerateResponse(ts);
        }
    });


    // ⭐ SCROLL-TO-BOTTOM LISTENERS (NEW)
    if (DOM.messages) {
        DOM.messages.addEventListener("scroll", checkScrollButton);
    }

    if (DOM.scrollBtn) {
        DOM.scrollBtn.addEventListener("click", scrollToBottom);
    }
}


/* ------------------------
   CHAT OPERATIONS
------------------------ */
function createNewChat() {
    const newChat = {
        id: "chat_" + Date.now(),
        title: "New Chat",
        messages: []
    };

    appState.chats.unshift(newChat);
    appState.activeChatId = newChat.id;
    saveState();
    renderApp();
    focusInput();
}

function getCurrentChat() {
    return appState.chats.find(c => c.id === appState.activeChatId);
}

function switchChat(id) {
    appState.activeChatId = id;
    appState.attachedFiles = [];
    saveState();
    renderApp();
    focusInput();
}

function deleteChat(id) {
    appState.chats = appState.chats.filter(c => c.id !== id);

    if (appState.activeChatId === id) {
        appState.activeChatId = appState.chats[0]?.id || null;
    }

    saveState();
    renderApp();
}

function renameChat(id, newName) {
    const chat = appState.chats.find(c => c.id === id);
    if (chat) chat.title = newName.substring(0, 40);

    saveState();
    renderHistory();
}

/* ------------------------
   SEND MESSAGE
------------------------ */
async function sendMessage() {
    const text = DOM.input.value.trim();
    const chat = getCurrentChat();
    if (!chat) return;

    const filesToSend = [...appState.attachedFiles];

    // Nothing to send
    if (!text && filesToSend.length === 0) return;

    // If files selected → show UI preview
    if (filesToSend.length > 0) {
        await addFileMessage(chat);
    }

    // Add user message to chat
    if (text) {
        chat.messages.push({
            role: "user",
            text: text,
            files: [],
            timestamp: Date.now()
        });

        // Auto assign chat title
        if (chat.title === "New Chat") {
            chat.title = autoGenerateTitle(text);
            updateChatTitle();
            renderHistory();
        }
    }

    renderMessages();
    scrollToBottomInstant();
    resetInput();
    appState.attachedFiles = [];
    saveState();

    // --------------------------------------------------
    // SUPER SMART — "WHO DEVELOPED YOU" INTENT DETECTOR
    // --------------------------------------------------
    const lower = text.toLowerCase().trim();

    // Keywords that may appear in ANY language
    const keywords = [
        // English
        "develop", "developer", "created", "creator", "made you",
        "built you", "programmed", "designer", "owner", "founder",
        "your maker", "who made", "who develop", "who create",
        "who build", "who program", "who designed", "who is behind",
        // Shortcuts / broken text
        "who maked", "who creat", "devloper", "who make u", "made u",
        "ur creator", "ur maker", "creator?", "owner?",
        // Telugu
        "ఎవరు", "వెవరు", "తయారు", "డెవలప్",  
        // Tamil
        "யார்", "உருவாக்கின", "டெவலப்",
        // Hindi
        "किसने", "बनाया", "डेवलपर",  
        // Spanish
        "quien", "creo", "creó", "desarrolló",
        // Chinese
        "谁", "开发", "制作"
    ];

    let isDeveloperQuestion = false;

    for (let k of keywords) {
        if (lower.includes(k)) {
            isDeveloperQuestion = true;
            break;
        }
    }

    // Extra fuzzy matching like ChatGPT
    if (
        lower.match(/who.*you/) ||
        lower.match(/who.*made/) ||
        lower.match(/who.*create/) ||
        lower.match(/your.*creator/) ||
        lower.match(/ur.*creator/) ||
        lower.match(/developer.*you/) ||
        lower.match(/who.*developer/)
    ) {
        isDeveloperQuestion = true;
    }

    // If developer-related → reply instantly
    if (isDeveloperQuestion) {
        chat.messages.push({
            role: "assistant",
            text: "I was developed by Vasu Goli — the creator of CampusAI.",
            files: [],
            timestamp: Date.now()
        });

        renderMessages();
        scrollToBottomInstant();
        saveState();
        return; // STOP API CALL
    }

    // --------------------------------------------------
    // Normal flow → send to backend
    // --------------------------------------------------
    showTyping();

    const reply = await sendToBackend(text, filesToSend);

    hideTyping();

    await streamBotReply(chat, reply);

    renderMessages();
    scrollToBottomInstant();
    saveState();
    focusInput();
}



async function addFileMessageWithCopy(chat, files) {
    const images = files.filter(f => f.type.startsWith("image/"));
    
    if (images.length > 0) {
        chat.messages.push({
            role: "user",
            text: "",
            files: await Promise.all(images.map(f => fileToObj(f))),
            timestamp: Date.now()
        });
        renderMessages();
    }
}



/* ------------------------
   BACKEND COMMUNICATION
------------------------ */
async function sendToBackend(message) {
    try {
        const chat = getCurrentChat();

        // Build correct history with both text + images
        const history = chat.messages.map(m => {
            if (m.files?.length > 0 && !m.text) {
                // Image-only history entry
                return {
                    role: m.role,
                    content: [
                        ...m.files.map(f => ({
                            type: "image_url",
                            image_url: { url: f.data }
                        }))
                    ]
                };
            }

            // Normal text message
            return {
                role: m.role,
                content: m.text || ""
            };
        });

        const formData = new FormData();
        formData.append("message", message);
        formData.append("history", JSON.stringify(history));

        // Add actual file uploads for backend vision
        if (appState.attachedFiles.length > 0) {
            for (let file of appState.attachedFiles) {
                formData.append("files", file);
            }
        }

        const response = await fetch("https://campus-ai-chatbot.onrender.com/api/chat", {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        return data.reply || "⚠️ No reply from backend";

    } catch (err) {
        console.error("Backend error:", err);
        return "⚠️ Backend unavailable — check if server is running.";
    }
}






/* ------------------------
   FILE HANDLING
------------------------ */
async function addFileMessage(chat) {
    const images = appState.attachedFiles.filter(f => f.type.startsWith("image/"));
    const others = appState.attachedFiles.filter(f => !f.type.startsWith("image/"));

    if (images.length > 0) {
        chat.messages.push({
            role: "user",
            text: "",
            files: await Promise.all(images.map(f => fileToObj(f))),
            timestamp: Date.now()
        });
    }

    if (others.length > 0) {
        chat.messages.push({
            role: "user",
            text: "",
            files: others.map(f => ({ name: f.name, data: null })),
            timestamp: Date.now()
        });
    }
}

function fileToObj(file) {
    return new Promise(res => {
        const reader = new FileReader();
        reader.onload = () => res({ name: file.name, data: reader.result });
        reader.readAsDataURL(file);
    });
}

function handleFileSelect(e) {
    [...e.target.files].forEach(file => appState.attachedFiles.push(file));
    renderFilePreview();
    e.target.value = "";
    focusInput();
}

function removeFile(index) {
    appState.attachedFiles.splice(index, 1);
    renderFilePreview();
}

/* ------------------------
   RENDER ENGINE
------------------------ */
function renderApp() {
    renderHistory();
    renderMessages();
    renderFilePreview();
    updateChatTitle();
}

function renderHistory() {
    DOM.history.innerHTML = `<p class="history-title">Recent</p>`;

    appState.chats.forEach(chat => {
        const item = document.createElement("div");
        item.className = `history-item ${chat.id === appState.activeChatId ? "active" : ""}`;
        item.dataset.id = chat.id;

        item.innerHTML = `
            <div class="history-dot"></div>
            <div class="chat-title">${chat.title}</div>
            <span class="menu-btn">⋮</span>
        `;

        // Switch chat when clicking the item (not the 3 dots)
        item.addEventListener("click", (e) => {
            if (!e.target.classList.contains("menu-btn")) {
                switchChat(chat.id);
            }
        });

        // OPEN MENU when clicking ⋮
        item.querySelector(".menu-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            showChatMenu(e, chat.id);
        });

        DOM.history.appendChild(item);
    });
}


function showChatMenu(e, chatId) {
    e.stopPropagation();

    const menu = document.getElementById("globalMenu");
    const rect = e.target.getBoundingClientRect();

    // Position next to the 3-dots
    menu.style.left = rect.right - 150 + "px";
    menu.style.top = rect.bottom + 8 + "px";

    menu.classList.add("show");

    // Rename
    menu.querySelector(".rename").onclick = () => {
        const newName = prompt("Rename chat:");
        if (newName) renameChat(chatId, newName);
        menu.classList.remove("show");
    };

    // Delete
    menu.querySelector(".delete").onclick = () => {
        deleteChat(chatId);
        menu.classList.remove("show");
    };
}

function renderMessages() {
    const chat = getCurrentChat();
    if (!chat) return;

    DOM.messages.innerHTML = "";

    chat.messages.forEach(msg =>
        DOM.messages.insertAdjacentHTML("beforeend", createBubble(msg))
    );

    DOM.messages.scrollTop = DOM.messages.scrollHeight;
}







function createBubble(msg) {
    const cls = msg.role === "user" ? "user-msg" : "bot-msg";

    const hasImage = msg.files?.length > 0;
    const hasText = msg.text && msg.text.trim().length > 0;

    // ---------------------------------------------------
    // 1️⃣ IMAGE ONLY — RETURN IMAGE + TIME (NO BUBBLE)
    // ---------------------------------------------------
    if (hasImage && !hasText) {
        const imgs = msg.files
            .map(f => `<img src="${f.data}" class="chat-image">`)
            .join("");

        return `
            <div class="${msg.role}-image-only image-container">
                ${imgs}
                <div class="image-time">${formatTimestamp(msg.timestamp)}</div>
            </div>
        `;

    }

    // ---------------------------------------------------
    // 2️⃣ IMAGE + TEXT — SHOW IMAGE FIRST (NO TIME), THEN TEXT BUBBLE WITH TIME
    // ---------------------------------------------------
    if (hasImage && hasText) {
        const imgs = msg.files
            .map(f => `<img src="${f.data}" class="chat-image">`)
            .join("");

        return `
            <div class="${msg.role}-image-only">${imgs}</div>

            <div class="${cls}">
                <div class="bubble-text">${msg.text}</div>
                <div class="bubble-footer ${msg.role === "user" ? "user-footer" : ""}">
                    <span class="bubble-time">${formatTimestamp(msg.timestamp)}</span>
                </div>
            </div>
        `;
    }

    // ---------------------------------------------------
    // 3️⃣ TEXT ONLY — NORMAL BUBBLE
    // ---------------------------------------------------
    return `
        <div class="${cls}">
            <div class="bubble-text">${formatMessage(msg.text || "")}</div>
            <div class="bubble-footer ${msg.role === "user" ? "user-footer" : ""}">
                <span class="bubble-time">${formatTimestamp(msg.timestamp)}</span>
                ${msg.role === "assistant" ? `<button class="regen-btn" data-timestamp="${msg.timestamp}">🔄</button>` : ""}
            </div>
        </div>
    `;
}




function createFilesGrid(files) {
    const gridClass = files.length === 1 ? "single" : "multiple";

    return `
        <div class="bubble-files-grid ${gridClass}">
            ${files
                .map(f =>
                    f.data
                        ? `<img src="${f.data}">`
                        : `<div class="bubble-file">${f.name}</div>`
                )
                .join("")}
        </div>
    `;
}

/* ------------------------
   FILE PREVIEW
------------------------ */
function renderFilePreview() {
    DOM.filePreview.innerHTML = "";
    DOM.attachBtn.removeAttribute("data-count");

    if (appState.attachedFiles.length === 0) return;

    DOM.attachBtn.setAttribute("data-count", appState.attachedFiles.length);

    appState.attachedFiles.forEach((file, index) => {
        const chip = document.createElement("div");
        chip.className = "file-chip";

        if (file.type?.startsWith("image/")) {
            chip.innerHTML += `<img src="${URL.createObjectURL(file)}">`;
        }

        chip.innerHTML += `
            <span>${file.name.slice(0, 15)}</span>
            <span style="color:red; cursor:pointer" onclick="removeFile(${index})">×</span>
        `;

        DOM.filePreview.appendChild(chip);
    });
}

/* ------------------------
   INPUT UTILITIES
------------------------ */
function resetInput() {
    DOM.input.value = "";
    DOM.input.style.height = "auto";
    appState.attachedFiles = [];
    renderFilePreview();
}

function handleInputKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function autoResize() {
    DOM.input.style.height = "auto";
    DOM.input.style.height = Math.min(DOM.input.scrollHeight, 150) + "px";
}

function focusInput() {
    setTimeout(() => DOM.input.focus(), 50);
}

/* ------------------------
   ATTACH MENU
------------------------ */
function toggleAttachMenu(e) {
    e.stopPropagation();
    DOM.attachMenu.classList.toggle("show");
}

/* ------------------------
   UPDATE TITLE
------------------------ */
function updateChatTitle() {
    const chat = getCurrentChat();
    if (chat) DOM.chatIdDisplay.textContent = chat.title;
}

/* ------------------------
   IMAGE VIEWER
------------------------ */
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("chat-image")) {
        document.getElementById("viewerImage").src = e.target.src;
        document.getElementById("imageViewer").classList.add("show");
    }
});

document.getElementById("imageViewer").addEventListener("click", () => {
    document.getElementById("imageViewer").classList.remove("show");
    document.getElementById("viewerImage").src = "";
});



/* ------------------------
   TYPING INDICATOR
------------------------ */
function showTyping() {
    if (document.getElementById("typingIndicator")) return;

    const container = document.createElement("div");
    container.id = "typingIndicator";
    container.className = "bot-msg typing-indicator";
    container.innerHTML = "<span></span><span></span><span></span>";

    DOM.messages.appendChild(container);
    DOM.messages.scrollTop = DOM.messages.scrollHeight;
}


function hideTyping() {
    const el = document.getElementById("typingIndicator");
    if (el) el.remove();
}



/* ------------------------
   STREAMING BOT REPLY
------------------------ */
async function streamBotReply(chat, fullText) {
    return new Promise((resolve) => {
        let index = 0;
        const speed = 15;

        // Create bot message object
        const msg = {
            role: "assistant",
            text: "",
            timestamp: Date.now()
        };

        chat.messages.push(msg);

        // Render once
        renderMessages();

        // Select the bubble created by renderMessages
        const bubble = DOM.messages.querySelector(".bot-msg:last-of-type");

        // Select bubble-text
        const textDiv = bubble.querySelector(".bubble-text");

        const interval = setInterval(() => {
            msg.text += fullText[index];
            textDiv.innerHTML = formatMessage(msg.text);


            index++;
            DOM.messages.scrollTop = DOM.messages.scrollHeight;

            if (index >= fullText.length) {
                clearInterval(interval);
                resolve();
            }
        }, speed);
    });
}




function autoGenerateTitle(text) {
    if (!text) return "New Chat";

    // Take first 6 words max
    let words = text.split(" ").slice(0, 6).join(" ");

    // Capitalize first letter
    words = words.charAt(0).toUpperCase() + words.slice(1);

    return words;
}


/* ------------------------
   SCROLL TO BOTTOM BUTTON
------------------------ */
function checkScrollButton() {
    const msg = DOM.messages;

    // Show button only if scrolled up
    if (msg.scrollTop + msg.clientHeight < msg.scrollHeight - 50) {
        DOM.scrollBtn.classList.add("show");
    } else {
        DOM.scrollBtn.classList.remove("show");
    }
}

// Smooth scroll to bottom
function scrollToBottom() {
    DOM.messages.scrollTo({
        top: DOM.messages.scrollHeight,
        behavior: "smooth"
    });
}


function scrollToBottomInstant() {
    DOM.messages.scrollTo({
        top: DOM.messages.scrollHeight,
        behavior: "smooth"
    });
}


function formatTimestamp(ts) {
    const date = new Date(ts);
    const now = new Date();

    const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

    const isYesterday =
        date.getDate() === now.getDate() - 1 &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

    let timeString = date.toLocaleString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });

    if (isToday) return `Today • ${timeString}`;
    if (isYesterday) return `Yesterday • ${timeString}`;

    return `${date.toLocaleDateString("en-IN")} • ${timeString}`;
}


async function regenerateResponse(botTimestamp) {
    const chat = getCurrentChat();
    if (!chat) return;

    // Find the bot message to regenerate
    const botIndex = chat.messages.findIndex(m => m.timestamp == botTimestamp);
    if (botIndex === -1) return;

    // The user message BEFORE this bot reply
    let userMsg = null;

    for (let i = botIndex - 1; i >= 0; i--) {
        if (chat.messages[i].role === "user") {
            userMsg = chat.messages[i];
            break;
        }

    }

    if (!userMsg) return;

    // Remove old bot reply
    chat.messages.splice(botIndex, 1);
    saveState();

    renderMessages();

    // Show typing
    showTyping();

    // Get new reply from backend
    const newReply = await sendToBackend(userMsg.text);

    // Hide typing
    hideTyping();

    // Stream replacement reply
    await streamBotReply(chat, newReply);

    saveState();
    renderMessages();
}

function formatMessage(text) {
    if (!text) return "";

    // Convert markdown-style line breaks
    text = text.replace(/\n/g, "<br>");

    // Convert **bold**
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Convert *italic*
    text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");

    // Convert ### headings
    text = text.replace(/### (.*?)(<br>|$)/g, "<h3>$1</h3>");

    // Convert ## headings
    text = text.replace(/## (.*?)(<br>|$)/g, "<h2>$1</h2>");

    // Convert # headings
    text = text.replace(/# (.*?)(<br>|$)/g, "<h1>$1</h1>");

    return text;
}
