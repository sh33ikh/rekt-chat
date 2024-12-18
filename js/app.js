document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');
    const sendButton = document.getElementById('send-button');
    const typingIndicator = document.getElementById('typing-indicator');
    const clearChatButton = document.getElementById('clear-chat');
    const themeToggle = document.getElementById('theme-toggle');
    const charCount = document.querySelector('.char-count');
    const errorToast = document.getElementById('error-toast');

    // State
    let darkMode = localStorage.getItem('darkMode') === 'true';
    let retryCount = 0;

    // Initialize
    updateTheme();
    addMessage('bot', config.WELCOME_MESSAGE);

    // Event Listeners
    chatForm.addEventListener('submit', handleSubmit);
    clearChatButton.addEventListener('click', clearChat);
    themeToggle.addEventListener('click', toggleTheme);
    userInput.addEventListener('input', handleInput);
    document.addEventListener('keydown', handleKeyPress);

    function handleKeyPress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.requestSubmit();
        }
    }

    function handleInput(e) {
        const length = e.target.value.length;
        charCount.textContent = `${length}/${config.MAX_MESSAGE_LENGTH}`;

        // Auto-resize textarea
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;

        // Enable/disable send button
        sendButton.disabled = length === 0;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const message = userInput.value.trim();

        if (message) {
            // Disable input and show loading state
            setFormState(true);
            addMessage('user', message);
            userInput.value = '';
            userInput.style.height = 'auto';

            try {
                const response = await sendMessageToBot(message);
                await simulateTyping(response);
                addMessage('bot', response);
                retryCount = 0;
            } catch (error) {
                console.error('Error:', error);
                showToast('Failed to get response. Please try again.', 'error');

                if (retryCount < config.MAX_RETRIES) {
                    retryCount++;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    chatForm.requestSubmit();
                } else {
                    showToast('Maximum retry attempts reached. Please try again later.', 'error');
                    retryCount = 0;
                }
            } finally {
                setFormState(false);
            }
        }
    }

    function setFormState(loading) {
        userInput.disabled = loading;
        sendButton.disabled = loading;
        typingIndicator.classList.toggle('hidden', !loading);
    }

    async function simulateTyping(text) {
        typingIndicator.classList.remove('hidden');
        await new Promise(resolve => setTimeout(resolve, Math.min(text.length * config.TYPING_SPEED, 2000)));
        typingIndicator.classList.add('hidden');
    }

    function addMessage(sender, content) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        messageElement.textContent = content;

        // Add ARIA labels for accessibility
        messageElement.setAttribute('role', 'log');
        messageElement.setAttribute('aria-label', `${sender} message: ${content}`);

        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        saveChat();
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
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        return data.generations[0].text.trim();
    }

    function saveChat() {
        const messages = Array.from(chatMessages.children).map(msg => ({
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
        showToast('Chat history cleared');
        chatMessages.innerHTML = '';
        localStorage.removeItem('chatHistory');
        addMessage('bot', config.WELCOME_MESSAGE);
    }

    function toggleTheme() {
        darkMode = !darkMode;
        updateTheme();
        localStorage.setItem('darkMode', darkMode);
    }

    function updateTheme() {
        document.body.classList.toggle('dark-theme', darkMode);
        themeToggle.innerHTML = darkMode ? 
            '<i class="fas fa-sun"></i>' : 
            '<i class="fas fa-moon"></i>';
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.classList.add('toast');
        if (type === 'error') toast.classList.add('error');
        toast.textContent = message;

        const toastContainer = document.getElementById('toast-container');
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, config.TOAST_DURATION);
    }

    // Load chat history on page load
    loadChat();
});

