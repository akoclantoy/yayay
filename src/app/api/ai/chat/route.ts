import { auth } from "@/auth";
import { APP_NAME } from "@/lib/constants";
import {
  GEMINI_CHAT_MODEL,
  getGeminiClient,
  isGeminiConfigured,
  toGeminiContents,
  type ChatMessage,
} from "@/lib/gemini";

const SYSTEM_PROMPT = `You are the AI recycling assistant for ${APP_NAME}, a community recycling reward platform in the Philippines.

Help residents with:
- How to recycle different waste types (plastic, paper, glass, metal, electronics, organic, textile, hazardous)
- Waste segregation best practices
- Estimated reward points (plastic ~10pts/kg, paper ~8, glass ~12, metal ~15, electronics ~25)
- Environmental impact and carbon savings awareness
- Collection schedules and barangay programs
- Finding collection centers

Be friendly, concise, and practical. Use metric units (kg). If unsure, suggest visiting a collection center or contacting barangay staff.`;

export async function POST(request: Request) {
  await auth();

  try {
    const { messages } = await request.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response("Invalid messages", { status: 400 });
    }

    const chatMessages = messages as ChatMessage[];

    if (!isGeminiConfigured()) {
      const fallback = getFallbackResponse(
        chatMessages[chatMessages.length - 1]?.content ?? ""
      );
      return new Response(fallback, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const genAI = getGeminiClient()!;
    const model = genAI.getGenerativeModel({
      model: GEMINI_CHAT_MODEL,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.7,
      },
    });

    const result = await model.generateContentStream({
      contents: toGeminiContents(chatMessages),
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (streamError) {
          console.error("[ai/chat:stream]", streamError);
          controller.error(streamError);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[ai/chat]", error);
    return new Response("AI service unavailable", { status: 500 });
  }
}

function getFallbackResponse(question: string): string {
  const q = question.toLowerCase();

  if (q.includes("plastic")) {
    return "To recycle plastic: rinse containers, remove caps if required, and sort by type (PET, HDPE). Bring clean plastics to your collection center — you'll earn about 10 points per kg. Avoid mixing with food-contaminated items.";
  }
  if (q.includes("paper")) {
    return "Paper recycling: keep paper dry and flat. Remove plastic coatings from cartons when possible. Earn ~8 points per kg. Shredded paper should be bagged separately.";
  }
  if (q.includes("point") || q.includes("reward")) {
    return "Reward points vary by material: Plastic ~10/kg, Paper ~8/kg, Glass ~12/kg, Metal ~15/kg, Electronics ~25/kg. Points credit automatically when staff scan your QR card at collection.";
  }
  if (q.includes("center") || q.includes("near")) {
    return "Visit the 'Nearby Centers' section in your dashboard to see collection centers on the map with hours and contact info. You can also request a pickup from home.";
  }

  return `Thanks for your question! For ${APP_NAME}, always sort waste before collection, bring your QR card, and visit a collection center during scheduled hours. Configure GEMINI_API_KEY for full AI responses. Common tips: rinse containers, separate hazardous waste, and check your barangay schedule.`;
}
