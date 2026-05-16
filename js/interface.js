const Interface = (function() {
    'use strict';

    const DOM = {};

    function cacheElements() {
        DOM.chatContainer = document.getElementById('chat-container');
        DOM.userInput = document.getElementById('user-input');
        DOM.sendBtn = document.getElementById('btn-send');
        DOM.typingIndicator = document.getElementById('typing-indicator');
        DOM.welcomeMessage = DOM.chatContainer?.querySelector('.welcome-message');
    }

    function addMessage(role, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const name = role === 'user' ? 'Вы' : 'Лира';
        messageDiv.innerHTML = `<span class="message-meta">${name} • ${time}</span><div class="message-content">${escapeHtml(text)}</div>`;
        if (DOM.welcomeMessage) DOM.welcomeMessage.style.display = 'none';
        if (DOM.typingIndicator?.parentNode) {
            DOM.typingIndicator.parentNode.insertBefore(messageDiv, DOM.typingIndicator);
        } else if (DOM.chatContainer) {
            DOM.chatContainer.appendChild(messageDiv);
        }
        scrollToBottom();
    }

    function showTyping(show) {
        if (DOM.typingIndicator) DOM.typingIndicator.classList.toggle('active', show);
        scrollToBottom();
    }

    function scrollToBottom() {
        if (DOM.chatContainer) DOM.chatContainer.scrollTop = DOM.chatContainer.scrollHeight;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async function handleSend() {
        const input = DOM.userInput?.value.trim();
        if (!input) return;
        if (typeof Core === 'undefined' || !Core.respond) {
            addMessage('ai', '❌ Ошибка: Core не загружен');
            return;
        }
        addMessage('user', input);
        DOM.userInput.value = '';
        showTyping(true);
        try {
            const response = await Core.respond(input);
            showTyping(false);
            addMessage('ai', response.text || '...');
        } catch(e) {
            showTyping(false);
            addMessage('ai', '⚠️ Ошибка генерации');
        }
    }

    function bindEvents() {
        DOM.sendBtn?.addEventListener('click', handleSend);
        DOM.userInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });
    }

    function init() {
        cacheElements();
        bindEvents();
        console.log('[Interface] Ready (simplified)');
    }

    return { init };
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Interface.init());
} else {
    Interface.init();
}
