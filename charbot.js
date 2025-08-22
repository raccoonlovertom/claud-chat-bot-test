// Global variables to store our settings and data
let responses = null;
let currentMode = 'tv';
let currentGeneration = 'millennial';
let conversationHistory = [];

// Load responses from JSON file when page loads
async function loadResponses() {
    try {
        const response = await fetch('responses.json');
        responses = await response.json();
        console.log('Responses loaded successfully!');
    } catch (error) {
        console.error('Error loading responses:', error);
        // Fallback responses if file fails to load
        responses = {
            fallback: ["I'm having trouble loading my responses, but I'm still here to listen! How was your day?"]
        };
    }
}

// Function to detect what kind of message this is
function analyzeMessage(message) {
    const lower = message.toLowerCase();
    const analysis = {
        sentiment: 'neutral',
        hasPersonReference: false,
        keywords: [],
        isOffTopic: false
    };
    
    // Check for positive keywords
    const positiveWords = responses?.keywords?.positive || ['good', 'great', 'happy'];
    const negativeWords = responses?.keywords?.negative || ['bad', 'sad', 'tired'];
    const neutralWords = responses?.keywords?.neutral || ['okay', 'fine', 'meh'];
    
    // Find which keywords are in the message
    positiveWords.forEach(word => {
        if (lower.includes(word)) {
            analysis.keywords.push(word);
            analysis.sentiment = 'positive';
        }
    });
    
    negativeWords.forEach(word => {
        if (lower.includes(word)) {
            analysis.keywords.push(word);
            analysis.sentiment = 'negative';
        }
    });
    
    // Neutral overrides if no strong emotion
    if (analysis.keywords.length === 0) {
        neutralWords.forEach(word => {
            if (lower.includes(word)) {
                analysis.keywords.push(word);
                analysis.sentiment = 'neutral';
            }
        });
    }
    
    // Check for people references
    const peopleWords = ['they', 'them', 'he', 'she', 'friend', 'boss', 'coworker', 'colleague', 
                         'manager', 'mom', 'dad', 'parent', 'sibling', 'brother', 'sister'];
    analysis.hasPersonReference = peopleWords.some(word => lower.includes(word));
    
    // Check if off-topic (not about their day)
    const dayWords = ['day', 'today', 'morning', 'afternoon', 'evening', 'work', 'lunch', 
                      'tired', 'stress', 'happy', 'sad', 'went', 'did', 'was', 'been'];
    const offTopicWords = ['weather', 'news', 'politics', 'sports', 'movie', 'theory'];
    
    const dayScore = dayWords.filter(word => lower.includes(word)).length;
    const offScore = offTopicWords.filter(word => lower.includes(word)).length;
    
    analysis.isOffTopic = offScore > dayScore && !lower.includes('my day');
    
    return analysis;
}

// Function to get a response based on the analysis
function getResponse(message, analysis) {
    // If off-topic, redirect gently
    if (analysis.isOffTopic && conversationHistory.length > 0) {
        const redirects = responses.redirect || ["Let's get back to your day - how's it been?"];
        return redirects[Math.floor(Math.random() * redirects.length)];
    }
    
    // If we don't understand, use fallback
    if (analysis.keywords.length === 0 && !analysis.hasPersonReference) {
        const fallbacks = responses.fallback || ["Tell me more about your day!"];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
    
    // Get response based on sentiment, generation, and mode
    let responsePool = [];
    
    try {
        // First try to get specific responses
        if (analysis.sentiment && responses.responses[analysis.sentiment]) {
            responsePool = responses.responses[analysis.sentiment][currentGeneration][currentMode] || [];
        }
        
        // If talking about people, add those responses
        if (analysis.hasPersonReference && responses.responses.people) {
            const peopleResponses = analysis.sentiment === 'positive' 
                ? responses.responses.people.positive 
                : responses.responses.people.negative;
            responsePool = responsePool.concat(peopleResponses || []);
        }
        
        // Pick a random response from the pool
        if (responsePool.length > 0) {
            let selectedResponse = responsePool[Math.floor(Math.random() * responsePool.length)];
            
            // Replace {keyword} with actual keyword from message
            if (analysis.keywords.length > 0) {
                selectedResponse = selectedResponse.replace('{keyword}', analysis.keywords[0]);
            }
            
            return selectedResponse;
        }
    } catch (error) {
        console.error('Error getting response:', error);
    }
    
    // Default fallback
    return "I hear you! Tell me more about what happened today.";
}

// Function to add a message to the chat
function addMessage(text, isUser = false) {
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
    messageDiv.textContent = text;
    messagesDiv.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    // Add to history
    conversationHistory.push({ text, isUser });
}

// Function to show typing animation
function showTyping() {
    const messagesDiv = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
    messagesDiv.appendChild(typingDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Function to remove typing animation
function removeTyping() {
    const typing = document.getElementById('typing-indicator');
    if (typing) typing.remove();
}

// Function to send a message
function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message
    addMessage(message, true);
    input.value = '';
    
    // Show typing
    showTyping();
    
    // Simulate thinking time then respond
    setTimeout(() => {
        removeTyping();
        
        // Analyze the message
        const analysis = analyzeMessage(message);
        
        // Get and send response
        const response = getResponse(message, analysis);
        addMessage(response);
        
        // Sometimes add a follow-up question
        if (Math.random() > 0.7 && responses?.responses?.followup) {
            setTimeout(() => {
                const followups = responses.responses.followup;
                const followup = followups[Math.floor(Math.random() * followups.length)];
                addMessage(followup);
            }, 1500);
        }
    }, 800 + Math.random() * 700);
}

// Function to handle quick suggestions
function quickReply(text) {
    document.getElementById('messageInput').value = text;
    sendMessage();
}

// Function to change mode (books/tv/music)
function setMode(mode) {
    currentMode = mode;
    
    // Update button styles
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
}

// Function to change generation
function setGeneration(gen) {
    currentGeneration = gen;
    
    // Update button styles
    document.querySelectorAll('.gen-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-gen="${gen}"]`).classList.add('active');
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadResponses();
    
    // Set up enter key to send message
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
});
