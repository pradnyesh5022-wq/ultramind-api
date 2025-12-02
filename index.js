require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');

// FIXED: pdf-parse import so pdfParse is a real function
const pdfParseModule = require('pdf-parse');
const pdfParse = pdfParseModule.default || pdfParseModule;

const app = express();
const PORT = 3000;

// File upload (PDF) setup – keep files in memory
const upload = multer({ storage: multer.memoryStorage() });

// Check API key
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ ERROR: GEMINI_API_KEY not found in .env file');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// CORS Middleware - allows webpage to connect
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

// Shared role prompts
const ROLE_PROMPTS = {
  developer:
    'Extract technical insights, APIs, code patterns, and implementation details',
  recruiter:
    'Extract skills, experience, qualifications, and candidate strengths',
  analyst:
    'Extract patterns, risks, trends, and data-driven insights',
  student:
    'Explain in simple terms with learning points'
};

// Helper to call Gemini with given text + role
async function runGeminiAnalysis(text, role) {
  const safeRole = ROLE_PROMPTS[role] ? role : 'developer';
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are an expert ${safeRole}. ${ROLE_PROMPTS[safeRole]}.

Analyze this document and provide:
1) Key Insights (bullet points)
2) Important Entities (names, technologies, concepts)
3) Executive Summary (3-4 sentences)
4) Action Items (if applicable)

Document:
${text}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

// Existing JSON summarize endpoint
app.post('/summarize', async (req, res) => {
  try {
    const { text, role = 'developer' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log(`📝 Processing /summarize request for role: ${role}`);
    console.log('🤖 Calling Gemini API...');

    const summary = await runGeminiAnalysis(text, role);

    console.log('✅ Success!');

    res.json({
      success: true,
      role,
      analysis: summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ ERROR in /summarize:', error);
    res.status(500).json({
      error: error.message,
      details: 'Check server terminal for full error details'
    });
  }
});

// NEW: PDF summarize endpoint
app.post('/summarize-pdf', upload.single('file'), async (req, res) => {
  try {
    const role = req.body.role || 'developer';

    if (!req.file) {
      return res.status(400).json({
        error: 'PDF file is required (field name: file)'
      });
    }

    console.log(`📄 Received PDF for /summarize-pdf (role: ${role})`);

    // Extract text from PDF buffer
    const pdfData = await pdfParse(req.file.buffer);
    const text = (pdfData.text || '').trim();

    if (!text) {
      return res.status(400).json({
        error:
          'Could not extract text from PDF. Check that the file is a readable text PDF.'
      });
    }

    console.log('🤖 Calling Gemini API for PDF...');
    const summary = await runGeminiAnalysis(text, role);

    console.log('✅ PDF analysis success!');

    res.json({
      success: true,
      role,
      analysis: summary,
      source: 'pdf',
      pages: pdfData.numpages || undefined,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ ERROR in /summarize-pdf:', error);
    res.status(500).json({
      error: error.message,
      details: 'Check server terminal for full error details'
    });
  }
});

// Health/root
app.get('/', (req, res) => {
  res.send(
    '🚀 UltraMind API is Running! POST to /summarize with {text, role} or POST PDF to /summarize-pdf'
  );
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log('✅ CORS enabled - webpage can connect!');
});
