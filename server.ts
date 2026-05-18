import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  app.post("/api/models", async (req, res) => {
    const apiKey = req.body.apiKey || process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: "API Key is required" });
    }
    
    try {
      const response = await fetch("https://integrate.api.nvidia.com/v1/models", {
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });
      if (!response.ok) {
        throw new Error("Failed to fetch models");
      }
      const data = await response.json();
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch models" });
    }
  });

  app.post("/api/generate-title", async (req, res) => {
    const { message, apiKey: clientApiKey, model: clientModel } = req.body;
    const apiKey = clientApiKey || process.env.NVIDIA_API_KEY;
    if (!apiKey) return res.status(401).json({ error: "API Key is required" });

    const client = new OpenAI({
      baseURL: "https://integrate.api.nvidia.com/v1",
      apiKey: apiKey,
    });

    try {
      const completion = await client.chat.completions.create({
        model: clientModel || "deepseek-ai/deepseek-r1",
        messages: [{ role: "user", content: `Generate a title for a chat consisting of this message. Return ONLY a concise title (max 5 words). Do not include quotes or any other text.\n\nMessage: "${message}"` }],
        temperature: 0.7,
        max_tokens: 20,
      });

      res.json({ title: completion.choices[0].message.content?.trim() });
    } catch (e) {
      console.error("Title generation error:", e);
      res.json({ title: "New Chat" });
    }
  });

  // API route
  app.post("/api/chat", async (req, res) => {
    const { messages, thinkingEnabled, apiKey: clientApiKey, model: clientModel } = req.body;
    
    const apiKey = clientApiKey || process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: "API Key is required" });
    }

    const client = new OpenAI({
      baseURL: "https://integrate.api.nvidia.com/v1",
      apiKey: apiKey,
    });

    const model = clientModel || "deepseek-ai/deepseek-r1";

    try {
      const extra_body = thinkingEnabled 
        ? { chat_template_kwargs: { thinking: true, reasoning_effort: "low" } }
        : undefined;

      const completion = await client.chat.completions.create({
        model: model,
        messages: messages,
        temperature: 1,
        top_p: 0.95,
        max_tokens: 16384,
        extra_body,
        stream: true,
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of completion) {
        if (!chunk.choices || chunk.choices.length === 0) continue;
        
        const delta = chunk.choices[0].delta;
        if (!delta) continue;
        
        const reasoning = (delta as any).reasoning || (delta as any).reasoning_content || "";
        const content = delta.content || "";
        if (reasoning || content) {
          res.write(JSON.stringify({ reasoning, content }) + "\n");
        }
      }
      res.end();
    } catch (error) {
      console.error("Streaming error:", error);
      // If headers already sent, we can't send a JSON error. Just end the stream.
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to fetch response" });
      } else {
        res.end();
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
