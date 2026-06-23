const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
// Initialize with dummy if undefined to avoid crash on startup, but will fail on actual call.
const genAI = new GoogleGenerativeAI(apiKey || 'dummy');

async function getRiskAssessment(data) {
  const { latitude, longitude, locationName, timeOfDay, speed, motionStatus } = data;
  
  const prompt = `
    You are an AI Safety Guardian. Analyze the following user context and assess the safety risk.
    Location: ${locationName} (${latitude}, ${longitude})
    Time of Day: ${timeOfDay}
    Movement Speed: ${speed}
    Motion Status: ${motionStatus}
    
    Return ONLY a valid JSON object with the following fields:
    {
      "riskScore": number between 0 and 100 (100 is safest),
      "riskLevel": string ("Optimal", "Caution", or "Warning" - matching frontend status enum),
      "reasoning": string explaining the assessment in 1-2 sentences,
      "recommendation": string providing a personalized safety tip
    }
  `;
  
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  // Strip markdown ```json if exists
  const cleanJson = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
  return JSON.parse(cleanJson);
}

async function chatAssistant(messages, context) {
    const systemInstruction = `You are a helpful personal safety assistant named AI Guardian. Provide concise, contextual safety advice.
Current user context: 
Location: ${context.locationName || 'Unknown'} 
Time: ${context.timeOfDay || 'Unknown'}
Motion Status: ${context.motionStatus || 'Unknown'}`;

    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: systemInstruction 
    });
    
    const history = messages.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
    }));
    
    const latestMessage = messages[messages.length - 1].content;
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(latestMessage);
    
    return result.response.text();
}

module.exports = { getRiskAssessment, chatAssistant };
