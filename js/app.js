document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');
    const sendButton = document.getElementById('send-button');
    const typingIndicator = document.getElementById('typing-indicator');
    const clearChatButton = document.getElementById('clear-chat');
    const themeToggle = document.getElementById('theme-toggle');
    const charCounter = document.getElementById('char-counter');
    const toastContainer = document.getElementById('toast-container');

    // State
    let darkMode = document.documentElement.classList.contains('dark');
    let retryCount = 0;

    // Event Listeners
    chatForm.addEventListener('submit', handleSubmit);
    clearChatButton.addEventListener('click', clearChat);
    themeToggle.addEventListener('click', toggleTheme);
    userInput.addEventListener('input', handleInput);
    userInput.addEventListener('keydown', handleKeydown);
    document.addEventListener('keydown', handleHotkeys);

    // Initialize
    loadChat();
    updateThemeButton();
    userInput.focus();

    function handleInput(e) {
        const length = e.target.value.length;
        charCounter.textContent = `${length}/${config.MAX_CHARS}`;
        autoResize();
    }

    function autoResize() {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
    }

    function handleKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.requestSubmit();
        }
    }

    function handleHotkeys(e) {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case '/':
                    e.preventDefault();
                    userInput.focus();
                    break;
                case 'l':
                    e.preventDefault();
                    clearChat();
                    break;
            }
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const message = userInput.value.trim();
        if (message) {
            addMessage('user', message);
            userInput.value = '';
            userInput.style.height = 'auto';
            charCounter.textContent = `0/${config.MAX_CHARS}`;
            disableInput(true);
            showTypingIndicator();

            try {
                const response = await sendMessageWithRetry(message);
                addMessage('bot', response);
                showToast('Message sent successfully!', 'success');
            } catch (error) {
                console.error('Error:', error);
                showToast('Failed to send message. Please try again.', 'error');
            }

            disableInput(false);
            hideTypingIndicator();
            userInput.focus();
        }
    }

    async function sendMessageWithRetry(message, attempt = 1) {
        try {
            return await sendMessageToBot(message);
        } catch (error) {
            if (attempt < config.MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, config.RETRY_DELAY * attempt));
                return sendMessageWithRetry(message, attempt + 1);
            }
            throw error;
        }
    }

    async function sendMessageToBot(message) {
        const response = await fetch(config.COHERE_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `BEARER ${config.COHERE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'command-nightly',
                prompt: `Human: ${message}\n${config.BOT_NAME}:`,
                max_tokens: 150,
                temperature: 0.7,
                k: 20,
                stop_sequences: ["Human:", "\n"],
                return_likelihoods: 'NONE',
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch from Cohere API');
        }

        const data = await response.json();
        return data.generations[0].text.trim();
    }

    function addMessage(sender, content) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        messageElement.textContent = content;
        
        // Add for screen readers
        messageElement.setAttribute('role', 'log');
        messageElement.setAttribute('aria-label', `${sender} message: ${content}`);
        
        chatMessages.appendChild(messageElement);
        messageElement.scrollIntoView({ behavior: 'smooth' });
        saveChat();
    }

    function showTypingIndicator() {
        typingIndicator.classList.remove('hidden');
        typingIndicator.scrollIntoView({ behavior: 'smooth' });
    }

    function hideTypingIndicator() {
        typingIndicator.classList.add('hidden');
    }

    function disableInput(disabled) {
        userInput.disabled = disabled;
        sendButton.disabled = disabled;
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.classList.add('toast', type);
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function saveChat() {
        const messages = Array.from(chatMessages.children)
            .filter(el => el.classList.contains('message'))
            .map(msg => ({
                sender: msg.classList.contains('user-message') ? 'user' : 'bot',
                content: msg.textContent
            }));
        localStorage.setItem('chatHistory', JSON.stringify(messages));
    }

    function loadChat() {
        const savedChat = localStorage.getItem('chatHistory');
        if (savedChat) {
            const messages = JSON.parse(savedChat);
            chatMessages.innerHTML = '';
            messages.forEach(msg => addMessage(msg.sender, msg.content));
        }
    }

    function clearChat() {
        chatMessages.innerHTML = '';
        localStorage.removeItem('chatHistory');
        addMessage('bot', config.WELCOME_MESSAGE);
        showToast('Chat cleared', 'success');
    }

    function toggleTheme() {
        darkMode = !darkMode;
        document.documentElement.classList.toggle('dark', darkMode);
        localStorage.setItem('theme', darkMode ? 'dark' : 'light');
        updateThemeButton();
        showToast(`${darkMode ? 'Dark' : 'Light'} mode activated`, 'success');
    }

    function updateThemeButton() {
        themeToggle.innerHTML = `<i class="fas fa-${darkMode ? 'sun' : 'moon'}"></i>`;
    }
});

