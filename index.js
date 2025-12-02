require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = 3000;

if (!process.env.GEMINI_API_KEY) {
  console.error('❌ ERROR: GEMINI_API_KEY not found in .env file');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// CORS Middleware - ALLOWS WEBPAGE TO CONNECT
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

app.post('/summarize', async (req, res) => {
  try {
    const { text, role = 'developer' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log(`📝 Processing request for role: ${role}`);
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const rolePrompts = {
      developer: 'Extract technical insights, APIs, code patterns, and implementation details',
      recruiter: 'Extract skills, experience, qualifications, and candidate strengths',
      analyst: 'Extract patterns, risks, trends, and data-driven insights',
      student: 'Explain in simple terms with learning points'
    };

    const prompt = `You are an expert ${role}. ${rolePrompts[role]}.

Analyze this document and provide:
1) Key Insights (bullet points)
2) Important Entities (names, technologies, concepts)
3) Executive Summary (3-4 sentences)
4) Action Items (if applicable)

Document:
${text}`;

    console.log('🤖 Calling Gemini API...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();
    
    console.log('✅ Success!');

    res.json({
      success: true,
      role: role,
      analysis: summary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    res.status(500).json({ 
      error: error.message,
      details: 'Check server terminal for full error details'
    });
  }
});

app.get('/', (req, res) => {
  res.send('🚀 UltraMind API is Running! POST to /summarize with {text, role}');
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:3000`);
  console.log(`✅ CORS enabled - webpage can connect!`);
});
