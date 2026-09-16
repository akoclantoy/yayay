import { GoogleGenerativeAI } from "@google/generative-ai";

export const GEMINI_CHAT_MODEL =
  process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash-lite";

export const GEMINI_VISION_MODEL =
  process.env.GEMINI_VISION_MODEL ?? "gemini-2.5-flash";

function readFirstEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return undefined;
}

export function getGeminiApiKey() {
  return readFirstEnv("GEMINI_API_KEY", "GOOGLE_API_KEY", "Gemini_api_key");
}

export function isGeminiConfigured() {
  return Boolean(getGeminiApiKey());
}

export function getGeminiClient() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
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
