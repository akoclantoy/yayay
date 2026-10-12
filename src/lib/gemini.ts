import { GoogleGenAI } from "@google/genai";

export const GEMINI_CHAT_FALLBACK_MODEL = "gemini-3.1-flash-lite";

function readFirstEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export const GEMINI_CHAT_MODEL =
  readFirstEnv("GEMINI_CHAT_MODEL") ?? GEMINI_CHAT_FALLBACK_MODEL;

export const GEMINI_VISION_MODEL =
  readFirstEnv("GEMINI_VISION_MODEL") ?? "gemini-2.5-flash";

export function getGeminiApiKey() {
  return readFirstEnv("GEMINI_API_KEY", "GOOGLE_API_KEY", "Gemini_api_key");
}

export function isGeminiConfigured() {
  return Boolean(getGeminiApiKey());
}

export function getGeminiClient() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

export async function generateWithChatModelFallback<T>(
  generate: (model: string) => Promise<T>
) {
  const models = [...new Set([GEMINI_CHAT_MODEL, GEMINI_CHAT_FALLBACK_MODEL])];

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    try {
      return await generate(model);
    } catch (error) {
      const status =
        error && typeof error === "object" && "status" in error &&
        typeof error.status === "number"
          ? error.status
          : undefined;
      if (status !== 404 || index === models.length - 1) throw error;

      console.warn("[gemini] Configured model was not found; retrying with fallback", {
        model,
        fallbackModel: models[index + 1],
      });
    }
  }

  throw new Error("No Gemini chat model is configured.");
}

export async function fetchImageAsInlineData(imageUrl: string) {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${res.status}`);
  }

  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";

  return {
    inlineData: {
      data: base64,
      mimeType,
    },
  };
}

export function dataUrlAsInlineData(imageData: string) {
  const match = imageData.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image data");
  }

  return {
    inlineData: {
      data: match[2],
      mimeType: match[1],
    },
  };
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export function toGeminiContents(messages: ChatMessage[]) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: message.content }],
  }));
}
