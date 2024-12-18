document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');
    const sendButton = document.getElementById('send-button');
    const typingIndicator = document.getElementById('typing-indicator');
    const clearChatButton = document.getElementById('clear-chat');
    const themeToggle = document.getElementById('theme-toggle');
    const errorToast = document.getElementById('error-toast');

    let darkMode = localStorage.getItem('darkMode') === 'enabled';
    updateTheme();

    // Display welcome message
    addMessage('bot', config.WELCOME_MESSAGE);

    chatForm.addEventListener('submit', handleSubmit);
    clearChatButton.addEventListener('click', clearChat);
    themeToggle.addEventListener('click', toggleDarkMode);
    userInput.addEventListener('input', autoResize);

    function autoResize() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const message = userInput.value.trim();
        if (message) {
            addMessage('user', message);
            userInput.value = '';
            userInput.style.height = 'auto';
            sendButton.disabled = true;
            typingIndicator.classList.remove('hidden');
            try {
                const response = await sendMessageToBot(message);
                addMessage('bot', response);
            } catch (error) {
                console.error('Error:', error);
                showErrorToast();
            }
            sendButton.disabled = false;
            typingIndicator.classList.add('hidden');
            userInput.focus();
        }
    }

    function addMessage(sender, content) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        messageElement.textContent = content;
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
            throw new Error('Failed to fetch from Cohere API');
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
        chatMessages.innerHTML = '';
        localStorage.removeItem('chatHistory');
        addMessage('bot', config.WELCOME_MESSAGE);
    }

    function toggleDarkMode() {
        darkMode = !darkMode;
        updateTheme();
        localStorage.setItem('darkMode', darkMode ? 'enabled' : 'disabled');
    }

    function updateTheme() {
        document.body.classList.toggle('dark-mode', darkMode);
        themeToggle.innerHTML = darkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }

    function showErrorToast() {
        errorToast.classList.remove('hidden');
        setTimeout(() => {
            errorToast.classList.add('hidden');
        }, 3000);
    }

    // Load chat history on page load
    loadChat();
});

