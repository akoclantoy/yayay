import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import {
  GEMINI_CHAT_MODEL,
  dataUrlAsInlineData,
  generateWithChatModelFallback,
  getGeminiClient,
  isGeminiConfigured,
} from "@/lib/gemini";

const wasteTypes = [
  "PLASTIC",
  "PAPER",
  "GLASS",
  "METAL",
  "ELECTRONICS",
  "ORGANIC",
  "TEXTILE",
  "HAZARDOUS",
  "OTHER",
] as const;

const requestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().trim().min(1).max(4000),
    })
  ).min(1).max(16),
  imageData: z.string().max(6_000_000).optional(),
});

const responseSchema = z.object({
  answer: z.string().trim().min(1).max(6000),
  suggestion: z.object({
    type: z.enum(wasteTypes),
    material: z.string().trim().min(1).max(160),
    disposal: z.string().trim().min(1).max(700),
    confidence: z.number().min(0).max(1),
  }).nullable(),
});

const SYSTEM_PROMPT = `You are EcoRewards' recycling assistant for collection staff in the Philippines.
Help staff identify waste from images and answer practical questions about segregation, recyclable materials, safe handling, local collection guidance, and recording materials.
When an image is present, inspect it and provide a cautious best-effort identification. If it clearly depicts one primary waste material, return a suggestion with exactly one waste type from PLASTIC, PAPER, GLASS, METAL, ELECTRONICS, ORGANIC, TEXTILE, HAZARDOUS, OTHER. If uncertain, unsafe to classify, or there is no image, set suggestion to null. Never invent collection schedules, center policies, or reward rates.
If hazardous or electronic material may be present, explicitly recommend careful handling and following local approved disposal procedures.
Return only valid JSON with exactly these keys: answer (concise helpful response), suggestion (null or an object containing type, material, disposal, confidence from 0 to 1).`;

function getGeminiFailure(
  model: string,
  status: number | undefined,
  error: unknown,
  receivedResponse: boolean
) {
  if (status === 400) {
    return "Gemini rejected the request. Check that GEMINI_CHAT_MODEL in Render is a supported model for your API key.";
  }
  if (status === 401 || status === 403) {
    return "Gemini rejected the API key or its permissions. Check the GEMINI_API_KEY value and API restrictions in Render and Google AI Studio.";
  }
  if (status === 404) {
    return `Gemini model "${model}" was not found. Check that this model is available to the API key configured in Render.`;
  }
  if (status === 429) {
    return "Gemini quota or rate limit reached. Check the API key's billing and quota in Google AI Studio, then try again.";
  }
  if (status !== undefined && status >= 500) {
    return "Gemini is temporarily unavailable. Please try again shortly.";
  }
  if (
    receivedResponse ||
    (error instanceof Error && error.message === "INVALID_GEMINI_RESPONSE")
  ) {
    return "Gemini responded, but its answer could not be read. Please try again.";
  }
  if (status !== undefined) {
    return `Gemini request failed with HTTP ${status}. Check the Gemini API settings and try again.`;
  }
  return "Render could not reach Gemini. Check the service logs and outbound network, then try again.";
}

export async function POST(request: Request) {
  const authResult = await requireRole(["COLLECTION_STAFF", "ADMIN"]);
  if ("error" in authResult) return authResult.error;

  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: "Gemini is not configured. Add GEMINI_API_KEY to the server environment." },
      { status: 503 }
    );
  }

  let body: unknown;
  let receivedResponse = false;
  let activeModel = GEMINI_CHAT_MODEL;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsedRequest = requestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: "Send a message (up to 4,000 characters) and a supported image if needed." },
      { status: 400 }
    );
  }

  try {
    const { messages, imageData } = parsedRequest.data;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "user") {
      return NextResponse.json({ error: "The latest chat message must be from staff." }, { status: 400 });
    }

    let imagePart: ReturnType<typeof dataUrlAsInlineData> | undefined;
    if (imageData) {
      if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(imageData)) {
        return NextResponse.json(
          { error: "Use a JPEG, PNG, or WebP image." },
          { status: 400 }
        );
      }
      imagePart = dataUrlAsInlineData(imageData);
    }

    const client = getGeminiClient();
    if (!client) {
      return NextResponse.json({ error: "Gemini is not configured." }, { status: 503 });
    }

    const contents = messages.map((message, index) => ({
      role: message.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [
        { text: message.content },
        ...(index === messages.length - 1 && imagePart ? [imagePart] : []),
      ],
    }));
    const result = await generateWithChatModelFallback((candidate) => {
      activeModel = candidate;
      return client.models.generateContent({
        model: candidate,
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          maxOutputTokens: 1200,
          temperature: 0.35,
          responseMimeType: "application/json",
        },
      });
    });
    receivedResponse = true;
    const text = result.text ?? "";
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) throw new Error("INVALID_GEMINI_RESPONSE");

    let resultBody: unknown;
    try {
      resultBody = JSON.parse(json);
    } catch {
      throw new Error("INVALID_GEMINI_RESPONSE");
    }
    const response = responseSchema.safeParse(resultBody);
    if (!response.success) {
      throw new Error("INVALID_GEMINI_RESPONSE");
    }

    return NextResponse.json(response.data);
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error &&
      typeof error.status === "number"
        ? error.status
        : undefined;
    console.error("[ai/staff-assistant] Gemini request failed", {
      model: activeModel,
      status,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: getGeminiFailure(activeModel, status, error, receivedResponse) },
      { status: 502 }
    );
  }
}
