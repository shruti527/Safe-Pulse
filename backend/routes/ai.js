const express = require('express');
const router = express.Router();
const { getRiskAssessment, chatAssistant } = require('../utils/gemini');

router.post('/risk-assessment', async (req, res) => {
    try {
        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
            return res.json({
                riskScore: 85,
                riskLevel: "Optimal",
                reasoning: "AI service is inactive. Returning default secure status.",
                recommendation: "Please set up Gemini API key in the backend.",
                isMocked: true
            });
        }
        const assessment = await getRiskAssessment(req.body);
        res.json(assessment);
    } catch (error) {
        console.error('Risk assessment error:', error);
        res.status(500).json({ error: 'Failed to generate risk assessment' });
    }
});

router.post('/chat', async (req, res) => {
    try {
        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
            return res.json({ reply: "Please add your Gemini API key to use the Chat Assistant." });
        }
        const { messages, context } = req.body;
        const reply = await chatAssistant(messages || [], context || {});
        res.json({ reply });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to get chat response' });
    }
});

module.exports = router;
