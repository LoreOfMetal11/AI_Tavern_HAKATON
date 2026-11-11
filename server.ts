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
const LLM_TIMEOUT_MS = 120_000;

app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'API ключ не настроен. Укажите ключ в настройках или в переменных окружения.' });
    }
    const { systemInstruction, contents, model = 'gemini-3.8-flash', temperature = 0.85, maxOutputTokens = 1024 } = req.body;
    const ai = new GoogleGenAI({ apiKey });
    const formattedContents = Array.isArray(contents)
      ? contents.map((c: { role: string; content: string }) => ({
          role: c.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: c.content }],
        }))
      : [{ role: 'user', parts: [{ text: String(contents) }] }];
    const generatePromise = ai.models.generateContent({
      model, contents: formattedContents,
      config: {
        systemInstruction: systemInstruction || undefined,
        temperature: Number(temperature), maxOutputTokens: Number(maxOutputTokens),
      },
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Превышено время ожидания ответа от Gemini API (10 сек)')), 10_000);
    });
    const response = await Promise.race([generatePromise, timeoutPromise]);
    return res.json({ text: response.text || '' });
  } catch (error: unknown) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка генерации через Gemini API' });
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
});

app.post('/api/proxy/llm', async (req: Request, res: Response) => {
  const { targetUrl, headers = {}, body } = req.body || {};
  let target: URL;
  try {
    if (typeof targetUrl !== 'string' || !targetUrl.trim()) {
      return res.status(400).json({ error: 'Укажите адрес сервера модели.' });
    }
    target = new URL(targetUrl);
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      return res.status(400).json({ error: 'Адрес сервера модели должен использовать HTTP или HTTPS.' });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Некорректное тело запроса к модели.' });
    }
    if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
      return res.status(400).json({ error: 'Некорректные заголовки запроса к модели.' });
    }
  } catch {
    return res.status(400).json({ error: 'Некорректный URL сервера модели.' });
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, LLM_TIMEOUT_MS);
  const handleDisconnect = () => {
    if (!res.writableEnded) controller.abort();
  };
  res.on('close', handleDisconnect);

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await upstream.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      if (res.destroyed) return;
      return res.status(502).json({
        error: `Сервер модели вернул ответ не в формате JSON (HTTP ${upstream.status}). Проверьте адрес API: обычно он заканчивается на /v1/chat/completions.`,
      });
    }
    if (res.destroyed) return;
    return res.status(upstream.status).json(data);
  } catch (error: unknown) {
    if (res.destroyed) return;
    console.error('LLM Proxy Error:', error instanceof Error ? error.message : 'Unknown error');
    if (timedOut) {
      return res.status(504).json({ error: 'Модель не ответила за 120 секунд. Проверьте, загружена ли модель, и уменьшите длину ответа или контекст.' });
    }
    return res.status(502).json({ error: 'Не удалось связаться с сервером модели. Проверьте, запущен ли он, адрес API и доступность порта.' });
  } finally {
    clearTimeout(timer);
    res.off('close', handleDisconnect);
  }
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
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
