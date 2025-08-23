// Global variables to store our settings and data
let responses = null;
let currentMode = 'tv';
let currentGeneration = 'millennial';
let conversationHistory = [];
let conversationContext = {
    topics: [],
    emotionalPattern: [],
    timeOfDay: null,
    lastActivity: null,
    peopleInvolved: [],
    intensityLevel: 'normal'
};

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
        intensity: 'normal',
        hasPersonReference: false,
        keywords: [],
        activities: [],
        timeReferences: [],
        emotionalWords: [],
        isOffTopic: false,
        hasMixedEmotions: false,
        contextClues: []
    };
    
    if (!responses) return analysis;
    
    // Enhanced sentiment analysis with intensity
    const positiveWords = responses.keywords?.positive || [];
    const negativeWords = responses.keywords?.negative || [];
    const neutralWords = responses.keywords?.neutral || [];
    const intenseEmotions = responses.keywords?.emotions_intense || {};
    
    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;
    
    // Check for positive keywords
    positiveWords.forEach(word => {
        if (lower.includes(word)) {
            analysis.keywords.push(word);
            analysis.emotionalWords.push(word);
            positiveCount++;
        }
    });
    
    // Check for negative keywords
    negativeWords.forEach(word => {
        if (lower.includes(word)) {
            analysis.keywords.push(word);
            analysis.emotionalWords.push(word);
            negativeCount++;
        }
    });
    
    // Check for neutral keywords
    neutralWords.forEach(word => {
        if (lower.includes(word)) {
            analysis.keywords.push(word);
            analysis.emotionalWords.push(word);
            neutralCount++;
        }
    });
    
    // Check for intense emotions
    Object.entries(intenseEmotions).forEach(([emotion, words]) => {
        words.forEach(word => {
            if (lower.includes(word)) {
                analysis.keywords.push(word);
                analysis.emotionalWords.push(word);
                analysis.intensity = 'intense';
                if (emotion === 'joy') positiveCount += 2;
                else if (['anger', 'sadness', 'fear'].includes(emotion)) negativeCount += 2;
            }
        });
    });
    
    // Determine sentiment and mixed emotions
    if (positiveCount > 0 && negativeCount > 0) {
        analysis.hasMixedEmotions = true;
        analysis.sentiment = positiveCount > negativeCount ? 'positive' : 'negative';
    } else if (positiveCount > negativeCount) {
        analysis.sentiment = 'positive';
    } else if (negativeCount > positiveCount) {
        analysis.sentiment = 'negative';
    } else if (neutralCount > 0) {
        analysis.sentiment = 'neutral';
    }
    
    // Activity detection
    const activities = responses.keywords?.activities || {};
    Object.entries(activities).forEach(([activity, words]) => {
        words.forEach(word => {
            if (lower.includes(word)) {
                analysis.activities.push(activity);
                analysis.contextClues.push(`${activity}: ${word}`);
            }
        });
    });
    
    // Time reference detection
    const timeRefs = responses.keywords?.time_references || {};
    Object.entries(timeRefs).forEach(([timeType, words]) => {
        words.forEach(word => {
            if (lower.includes(word)) {
                analysis.timeReferences.push(timeType);
                conversationContext.timeOfDay = timeType;
                analysis.contextClues.push(`time: ${timeType}`);
            }
        });
    });
    
    // Enhanced people reference detection
    const relationships = responses.keywords?.relationships || {};
    let foundPeople = false;
    Object.entries(relationships).forEach(([relType, words]) => {
        words.forEach(word => {
            if (lower.includes(word)) {
                analysis.hasPersonReference = true;
                foundPeople = true;
                conversationContext.peopleInvolved.push(relType);
                analysis.contextClues.push(`people: ${relType}`);
            }
        });
    });
    
    // Weather and mood detection
    const weatherWords = responses.keywords?.weather || [];
    weatherWords.forEach(word => {
        if (lower.includes(word)) {
            analysis.contextClues.push(`weather: ${word}`);
        }
    });
    
    // Food mood detection
    const foodMoodWords = responses.keywords?.food_mood || [];
    foodMoodWords.forEach(word => {
        if (lower.includes(word)) {
            analysis.contextClues.push(`food_mood: ${word}`);
        }
    });
    
    // Energy level detection
    const energyWords = responses.keywords?.energy_levels || [];
    energyWords.forEach(word => {
        if (lower.includes(word)) {
            analysis.contextClues.push(`energy: ${word}`);
            if (['exhausted', 'drained', 'burned out', 'wiped out'].includes(word)) {
                analysis.intensity = 'high';
            }
        }
    });
    
    // Check if off-topic (improved detection)
    const dayWords = ['day', 'today', 'morning', 'afternoon', 'evening', 'work', 'lunch', 
                      'tired', 'stress', 'happy', 'sad', 'went', 'did', 'was', 'been', 'feel', 'feeling'];
    const offTopicWords = ['weather', 'news', 'politics', 'theory', 'general', 'abstract'];
    
    const dayScore = dayWords.filter(word => lower.includes(word)).length;
    const offScore = offTopicWords.filter(word => lower.includes(word)).length;
    
    analysis.isOffTopic = offScore > dayScore && !lower.includes('my day') && !lower.includes('i ') && analysis.contextClues.length === 0;
    
    // Update conversation context
    conversationContext.emotionalPattern.push(analysis.sentiment);
    if (conversationContext.emotionalPattern.length > 10) {
        conversationContext.emotionalPattern = conversationContext.emotionalPattern.slice(-10);
    }
    
    if (analysis.activities.length > 0) {
        conversationContext.lastActivity = analysis.activities[0];
    }
    
    conversationContext.intensityLevel = analysis.intensity;
    
    return analysis;
}

// Function to get a response based on the analysis
function getResponse(message, analysis) {
    // If off-topic, redirect gently
    if (analysis.isOffTopic && conversationHistory.length > 0) {
        const redirects = responses.redirect || ["Let's get back to your day - how's it been?"];
        return redirects[Math.floor(Math.random() * redirects.length)];
    }
    
    // Handle mixed emotions specially
    if (analysis.hasMixedEmotions && responses.specialized_responses?.mixed_emotions) {
        const mixedResponses = responses.specialized_responses.mixed_emotions;
        return mixedResponses[Math.floor(Math.random() * mixedResponses.length)];
    }
    
    // Handle intense emotions specially
    if (analysis.intensity === 'intense' && responses.specialized_responses?.intense_emotions) {
        const intenseResponses = responses.specialized_responses.intense_emotions;
        return intenseResponses[Math.floor(Math.random() * intenseResponses.length)];
    }
    
    // Handle time-specific responses
    if (analysis.timeReferences.length > 0 && responses.specialized_responses?.time_specific) {
        const timeType = analysis.timeReferences[0];
        const timeResponses = responses.specialized_responses.time_specific[timeType];
        if (timeResponses && Math.random() > 0.6) { // 40% chance to use time-specific
            return timeResponses[Math.floor(Math.random() * timeResponses.length)];
        }
    }
    
    // Handle activity-specific responses
    if (analysis.activities.length > 0 && responses.activities) {
        const activity = analysis.activities[0];
        const activityResponses = responses.activities[activity];
        if (activityResponses && Math.random() > 0.5) { // 50% chance to use activity-specific
            return activityResponses[Math.floor(Math.random() * activityResponses.length)];
        }
    }
    
    // Enhanced fallback with better detection
    if ((analysis.keywords.length === 0 && !analysis.hasPersonReference && analysis.contextClues.length === 0) || 
        (analysis.sentiment === 'neutral' && analysis.keywords.length < 2)) {
        const fallbacks = responses.fallback || ["Tell me more about your day!"];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
    
    // Get response based on sentiment, generation, and mode
    let responsePool = [];
    
    try {
        // First try to get specific responses with new personality modes
        if (analysis.sentiment && responses.responses[analysis.sentiment]) {
            const sentimentResponses = responses.responses[analysis.sentiment][currentGeneration];
            if (sentimentResponses && sentimentResponses[currentMode]) {
                responsePool = [...sentimentResponses[currentMode]];
            }
        }
        
        // If talking about people, add those responses with more weight
        if (analysis.hasPersonReference && responses.people) {
            const peopleResponses = analysis.sentiment === 'positive' 
                ? responses.people.positive 
                : analysis.sentiment === 'negative' 
                    ? responses.people.negative 
                    : [...responses.people.positive, ...responses.people.negative];
            
            // Give people responses higher weight by adding them multiple times
            responsePool = responsePool.concat(peopleResponses, peopleResponses);
        }
        
        // Pick a random response from the pool
        if (responsePool.length > 0) {
            let selectedResponse = responsePool[Math.floor(Math.random() * responsePool.length)];
            
            // Replace {keyword} with actual keyword from message (prefer emotional words)
            const keywordToUse = analysis.emotionalWords.length > 0 
                ? analysis.emotionalWords[0] 
                : analysis.keywords.length > 0 
                    ? analysis.keywords[0] 
                    : 'interesting';
            
            selectedResponse = selectedResponse.replace(/{keyword}/g, keywordToUse);
            
            return selectedResponse;
        }
    } catch (error) {
        console.error('Error getting response:', error);
    }
    
    // Enhanced default fallback based on what we detected
    if (analysis.contextClues.length > 0) {
        const contextType = analysis.contextClues[0].split(':')[0];
        switch (contextType) {
            case 'work':
                return "Work days can be so varied! What was the energy like at work today?";
            case 'social':
                return "Social interactions really shape our days! How was the company you kept?";
            case 'health':
                return "Taking care of yourself is so important! How are you feeling physically and mentally?";
            case 'family':
                return "Family dynamics can be complex! How was your family time today?";
            case 'time':
                return "The time of day really affects our energy! How has your day been unfolding?";
            default:
                return "I can tell there's something on your mind about today. What's been the main theme?";
        }
    }
    
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
    
    // Update dynamic suggestions after bot responses
    if (!isUser && conversationHistory.length > 1) {
        updateDynamicSuggestions();
    }
}

// Function to update suggestions based on conversation context
function updateDynamicSuggestions() {
    const suggestionsContainer = document.querySelector('.suggestions');
    if (!suggestionsContainer) return;
    
    // Clear existing suggestions
    suggestionsContainer.innerHTML = '';
    
    let suggestions = [];
    
    // Base suggestions for different conversation stages
    if (conversationHistory.length <= 2) {
        // Initial conversation
        suggestions = [
            "It was actually pretty good!",
            "Kind of exhausting honestly", 
            "Just okay I guess",
            "Really stressful"
        ];
    } else {
        // Dynamic suggestions based on context
        const recentEmotions = conversationContext.emotionalPattern.slice(-3);
        const lastActivity = conversationContext.lastActivity;
        const timeOfDay = conversationContext.timeOfDay;
        
        if (recentEmotions.includes('negative')) {
            suggestions = [
                "Yeah, it was really tough",
                "I'm trying to stay positive",
                "It's been overwhelming",
                "I need to talk about it more"
            ];
        } else if (recentEmotions.includes('positive')) {
            suggestions = [
                "There was more good stuff too!",
                "It made me really happy",
                "I want to do it again",
                "It was the highlight of my day"
            ];
        } else {
            // Activity-based suggestions
            if (lastActivity === 'work') {
                suggestions = [
                    "Work was the main thing",
                    "My colleagues were interesting",
                    "The workload was manageable",
                    "I had some meetings"
                ];
            } else if (lastActivity === 'social') {
                suggestions = [
                    "I spent time with friends",
                    "We had great conversations",
                    "The social energy was nice",
                    "It was good to connect"
                ];
            } else if (timeOfDay) {
                if (timeOfDay === 'morning') {
                    suggestions = [
                        "The morning was peaceful",
                        "I started early today",
                        "My morning routine helped",
                        "I felt energized at first"
                    ];
                } else if (timeOfDay === 'evening') {
                    suggestions = [
                        "The evening was relaxing",
                        "I'm winding down now",
                        "It's been a long day",
                        "I'm reflecting on everything"
                    ];
                }
            }
            
            // Default contextual suggestions
            if (suggestions.length === 0) {
                suggestions = [
                    "Let me think about it more",
                    "There were some good moments",
                    "I had mixed feelings",
                    "It was pretty typical"
                ];
            }
        }
    }
    
    // Create suggestion buttons
    suggestions.forEach(suggestion => {
        const button = document.createElement('button');
        button.className = 'suggestion';
        button.textContent = suggestion;
        button.onclick = () => quickReply(suggestion);
        suggestionsContainer.appendChild(button);
    });
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
        
        // Intelligently add follow-up questions based on context
        if (Math.random() > 0.6 && responses?.followup) {
            setTimeout(() => {
                const followups = responses.followup;
                let selectedFollowup;
                
                // Choose follow-up based on analysis
                if (analysis.intensity === 'intense') {
                    const intenseFollowups = [
                        "How are you processing all this?",
                        "That sounds really intense. How are you managing such strong feelings?",
                        "What's helping you cope with this?"
                    ];
                    selectedFollowup = intenseFollowups[Math.floor(Math.random() * intenseFollowups.length)];
                } else if (analysis.hasPersonReference) {
                    const peopleFollowups = [
                        "How did other people respond to that?",
                        "What was your support system like during that?",
                        "How did that affect your relationship with them?"
                    ];
                    selectedFollowup = peopleFollowups[Math.floor(Math.random() * peopleFollowups.length)];
                } else if (analysis.activities.length > 0) {
                    const activityFollowups = [
                        "What was the most challenging part about that?",
                        "How did that change the rest of your day?",
                        "What was most meaningful to you about that?"
                    ];
                    selectedFollowup = activityFollowups[Math.floor(Math.random() * activityFollowups.length)];
                } else {
                    selectedFollowup = followups[Math.floor(Math.random() * followups.length)];
                }
                
                addMessage(selectedFollowup);
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
