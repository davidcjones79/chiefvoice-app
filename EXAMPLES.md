# Chief Phase 1 - Usage Examples

## 🎯 Voice/Text Toggle Examples

### **Switching Input Modes**

```typescript
// User clicks the input toggle button
<InputToggle 
  mode={inputMode}           // Current: 'voice' or 'text'
  onToggle={handleInputModeChange}
  disabled={isInCall || isTextStreaming}
/>

// What happens when switching:
// Voice → Text: Ends any active voice call
// Text → Voice: Cancels text streaming, clears text input
```

### **Conversation Mode Examples**

#### **Casual Mode** 💬
```
User: "How do I fix this bug?"
Assistant: "Oh, that's a tricky one! Let me help you figure this out. First, can you tell me what error you're seeing? We'll get this sorted out together!"
```

#### **Professional Mode** 👔  
```
User: "How do I fix this bug?"
Assistant: "I'd be happy to assist you with troubleshooting this issue. To provide the most effective solution, could you please describe the specific error message or behavior you're encountering?"
```

#### **Technical Mode** 🔧
```
User: "How do I fix this bug?"
Assistant: "To diagnose this issue effectively, I'll need several pieces of information:

1. **Error Details**: Exact error message and stack trace
2. **Environment**: Operating system, runtime version, framework details
3. **Reproduction Steps**: Minimal code example that triggers the bug
4. **Expected vs Actual Behavior**: What should happen vs what's happening

Here's a systematic debugging approach:

```javascript
// Enable debug logging
console.log('Debug info:', {
  timestamp: new Date().toISOString(),
  userAgent: navigator.userAgent,
  errorContext: error.stack
});
```
```

#### **Quick Mode** ⚡
```
User: "How do I fix this bug?"  
Assistant: "Need error details and code. Check console logs first."
```

## 🎤 Voice Input Examples

### **Starting Voice Session**
1. Select "🎤 Voice" mode
2. Choose conversation mode (e.g., "🔧 Technical")
3. Tap phone button to start call
4. Hold microphone button to speak
5. Release to send - gets technical-style response

### **Voice + Mode Integration**
```
Voice Input: "Send an email to john@example.com about the project update"

Casual Response: "I'd love to help you send that email! I'll need to get approval first since this involves sending external messages. I've sent you a Telegram message to approve that."

Professional Response: "I can assist you with sending that email. Per security protocols, I'll require approval for external communications. I've submitted a request via Telegram for your authorization."

Quick Response: "Email requires approval. Check Telegram."
```

## ⌨️ Text Input Examples

### **Text Chat Flow**
```typescript
// User types in text input
"Create a Todoist task to review the quarterly reports by Friday"

// API call
POST /api/text/chat
{
  "message": "Create a Todoist task to review the quarterly reports by Friday",
  "callId": "text_1706910234567",
  "mode": "professional"
}

// Streamed response (professional mode)
"I'll create that Todoist task for you. This requires approval since it involves external system access. [NEEDS_APPROVAL: {"type": "create_task", "description": "Create Todoist task for quarterly report review", "params": {"title": "Review quarterly reports", "due": "Friday"}}]"

// Final transcript shows:
// User: Create a Todoist task to review the quarterly reports by Friday  
// Assistant: I'll create that Todoist task for you. I've sent you a Telegram message to approve that.
```

### **Text Streaming Visual**
```
User types: "Explain how React hooks work"
[Sends with Enter key]

// Streaming response appears word by word:
"React hooks are a powerful feature..." [delta]
"...that allow you to use state and other..." [delta]  
"...React features in functional components..." [delta]
[Complete]
```

## 🔄 Mode Switching Examples

### **Mid-Conversation Mode Changes**
```
// Start in Casual mode
User: "What's the weather like?"
Assistant: "Hey! I'd love to help you check the weather, but I don't have access to real-time weather data right now. You might want to check your phone's weather app or ask Siri/Google!"

// User switches to Professional mode
User: "What about the stock market?"
Assistant: "I don't currently have access to real-time financial market data. For accurate stock market information, I recommend consulting financial news websites, trading platforms, or professional financial services."

// User switches to Quick mode  
User: "Any productivity tips?"
Assistant: "Time-block calendar. Single-task focus. Regular breaks."
```

## 🔗 API Integration Examples

### **Text Chat API Usage**
```bash
curl -X POST http://localhost:3000/api/text/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Help me write a professional email",
    "mode": "professional",
    "callId": "test_call_123"
  }'

# Returns SSE stream:
data: {"type":"delta","content":"I'd be pleased to assist","mode":"professional","timestamp":1706910234567}
data: {"type":"delta","content":" you with composing","mode":"professional","timestamp":1706910234568}
data: {"type":"complete","content":"","fullResponse":"I'd be pleased to assist you with composing a professional email. Could you please provide me with the following details:\n\n1. **Recipient**: Who will be receiving this email?\n2. **Purpose**: What is the main objective of this communication?\n3. **Key Points**: What specific information needs to be conveyed?\n4. **Tone**: Are there any particular considerations for the relationship or context?\n\nWith these details, I can help you craft an effective and appropriately professional message.","timestamp":1706910234570}
data: [DONE]
```

### **Mode Prompt Processing**
```typescript
// API processes mode-specific context
const textContext = `[TEXT_INPUT] User sent a text message. For privileged actions (sending emails, messages, running commands), include an approval marker in your response:
[NEEDS_APPROVAL: {"type": "send_email|send_message|run_command", "description": "brief description", "params": {...}}]

Mode: professional - Use formal, business-appropriate language. Be polite, structured, and professional.

User message: Send a follow-up email to the client about their proposal`;

// Results in professional, structured response with approval marker
```

## 🎯 Real-World Usage Scenarios

### **Scenario 1: Developer Troubleshooting**
```
Mode: Technical 🔧
Input: Text

User: "My React component is re-rendering infinitely"

Response: "Infinite re-rendering typically occurs due to several common patterns:

1. **Dependency Array Issues**: useEffect without proper dependencies
2. **State Updates in Render**: Modifying state during render phase  
3. **Object/Array Dependencies**: New references on every render

Here's a diagnostic approach:

```javascript
// Add this to identify render frequency
useEffect(() => {
  console.log('Component rendered:', new Date().toISOString());
});

// Check for missing dependencies
useEffect(() => {
  // Your effect code
}, []); // ← Empty array might be missing dependencies
```

Most common fix - wrap handlers in useCallback:
```javascript
const handleClick = useCallback(() => {
  // handler code
}, [dependency1, dependency2]);
```
"
```

### **Scenario 2: Business Communication**
```
Mode: Professional 👔  
Input: Voice (push-to-talk)

Voice: "Draft an email declining the vendor proposal but keeping the relationship positive"

Response: "I can help you compose a diplomatic vendor response email. This will require approval for external communication. I've sent you a Telegram message for authorization. 

Once approved, I'll draft something that:
- Politely declines the current proposal
- Appreciates their effort and interest  
- Suggests future collaboration possibilities
- Maintains professional relationship integrity"
```

### **Scenario 3: Quick Task Management**
```
Mode: Quick ⚡
Input: Text  

User: "Add a meeting reminder for tomorrow at 2pm"
Response: "Creating calendar reminder for 2pm tomorrow. Telegram approval sent."

User: "What's my schedule for today?"  
Response: "Calendar access needs approval. Check Telegram."

User: "Thanks"
Response: "Welcome."
```

---

## 🚀 Testing the Implementation

```bash
# Start the development server
cd ~/projects/chiefvoice-app
npm run dev

# Open http://localhost:3000
# 1. Toggle between Voice/Text modes in header
# 2. Change conversation modes and see response differences  
# 3. Test text input with different modes
# 4. Test voice input with mode effects
# 5. Switch modes mid-conversation
# 6. Test approval workflows for both input types
```