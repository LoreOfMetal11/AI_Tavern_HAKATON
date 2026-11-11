import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Health endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// Server-side Gemini API proxy using @google/genai and environment GEMINI_API_KEY
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  try {
    const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'API ключ не настроен. Укажите ключ в настройках или в переменных окружения.',
      });
    }

    const {
      systemInstruction,
      contents,
      model = 'gemini-3.8-flash',
      temperature = 0.85,
      maxOutputTokens = 1024,
    } = req.body;

    const ai = new GoogleGenAI({ apiKey });

    // Format contents into Gemini API format
    const formattedContents = Array.isArray(contents)
      ? contents.map((c: { role: string; content: string }) => ({
          role: c.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: c.content }],
        }))
      : [{ role: 'user', parts: [{ text: String(contents) }] }];

    // 10 second timeout safety
    const generatePromise = ai.models.generateContent({
      model: model,
      contents: formattedContents,
      config: {
        systemInstruction: systemInstruction || undefined,
        temperature: Number(temperature),
        maxOutputTokens: Number(maxOutputTokens),
      },
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Превышено время ожидания ответа от Gemini API (10 сек)')), 10000)
    );

    const response: any = await Promise.race([generatePromise, timeoutPromise]);

    const replyText = response.text || '';
    return res.json({ text: replyText });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({
      error: error?.message || 'Ошибка генерации через Gemini API',
    });
  }
});

// Proxy endpoint for local LLMs (LM Studio, Ollama, etc.) to bypass browser CORS
app.post('/api/proxy/llm', async (req: Request, res: Response) => {
  try {
    const { targetUrl, headers = {}, body } = req.body;
    if (!targetUrl) {
      return res.status(400).json({ error: 'targetUrl is required' });
    }

    const fetchResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });

    const data = await fetchResponse.json();
    return res.status(fetchResponse.status).json(data);
  } catch (error: any) {
    console.error('LLM Proxy Error:', error);
    return res.status(502).json({
      error: `Не удалось связаться с локальным сервером (${req.body.targetUrl}): ${error?.message || 'Ошибка соединения'}`,
    });
  }
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Mount Vite dev server in middleware mode
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static files
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`MythicTavern server running on http://localhost:${PORT}`);
  });
}

startServer();
