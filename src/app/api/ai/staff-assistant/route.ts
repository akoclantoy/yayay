import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { GEMINI_CHAT_MODEL, dataUrlAsInlineData, getGeminiClient, isGeminiConfigured } from "@/lib/gemini";

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

    const model = client.getGenerativeModel({
      model: GEMINI_CHAT_MODEL,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        maxOutputTokens: 1200,
        temperature: 0.35,
        responseMimeType: "application/json",
      },
    });

    const contents = messages.map((message, index) => ({
      role: message.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [
        { text: message.content },
        ...(index === messages.length - 1 && imagePart ? [imagePart] : []),
      ],
    }));
    const result = await model.generateContent({ contents });
    const text = result.response.text();
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) throw new Error("Gemini returned an invalid assistant response");

    const response = responseSchema.safeParse(JSON.parse(json));
    if (!response.success) {
      throw new Error("Gemini returned an invalid assistant response");
    }

    return NextResponse.json(response.data);
  } catch (error) {
    console.error("[ai/staff-assistant]", error);
    return NextResponse.json(
      { error: "Gemini could not complete the request. Please try again." },
      { status: 502 }
    );
  }
}
