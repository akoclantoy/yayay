import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { WASTE_TYPE_LABELS } from "@/lib/constants";
import {
  GEMINI_VISION_MODEL,
  dataUrlAsInlineData,
  fetchImageAsInlineData,
  getGeminiClient,
  isGeminiConfigured,
} from "@/lib/gemini";
import type { WasteType } from "@/generated/prisma/enums";
import { z } from "zod";

const CLASSIFY_PROMPT = `You are a waste classification expert for a Philippine community recycling program. Classify the item into exactly one of: ${Object.keys(WASTE_TYPE_LABELS).join(", ")}. Return ONLY a JSON object with exactly these fields: type (enum), material (short string), disposal (specific disposal instruction), estimatedPointsPerKg (number), confidence (number from 0 to 1), and tips (short practical tip). Do not include markdown or additional fields.`;

const classificationSchema = z.object({
  type: z.enum(["PLASTIC", "PAPER", "GLASS", "METAL", "ELECTRONICS", "ORGANIC", "TEXTILE", "HAZARDOUS", "OTHER"]),
  material: z.string().min(1).max(120),
  disposal: z.string().min(1).max(500),
  estimatedPointsPerKg: z.number().nonnegative(),
  confidence: z.number().min(0).max(1),
  tips: z.string().min(1).max(500),
});

function parseClassification(content: string) {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Gemini returned an invalid classification response");
  const parsed = classificationSchema.parse(JSON.parse(jsonMatch[0]));
  return {
    ...parsed,
    typeLabel: WASTE_TYPE_LABELS[parsed.type as WasteType],
  };
}

export async function POST(request: Request) {
  const authResult = await requireSession();
  if ("error" in authResult) return authResult.error;

  try {
    const { imageUrl, imageData, description } = await request.json();

    if (!imageUrl && !imageData && !description) {
      return NextResponse.json(
        { error: "Image or description required" },
        { status: 400 }
      );
    }

    if (isGeminiConfigured() && (imageUrl || imageData)) {
      const genAI = getGeminiClient()!;
      const model = genAI.getGenerativeModel({
        model: GEMINI_VISION_MODEL,
        generationConfig: {
          maxOutputTokens: 400,
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      });

      const imagePart = imageData
        ? dataUrlAsInlineData(imageData)
        : await fetchImageAsInlineData(imageUrl);
      const result = await model.generateContent([
        { text: CLASSIFY_PROMPT },
        {
          text:
            description ?? "Classify this waste item for recycling.",
        },
        imagePart,
      ]);

      return NextResponse.json(parseClassification(result.response.text()));
    }

    if (isGeminiConfigured() && description && !imageUrl) {
      const genAI = getGeminiClient()!;
      const model = genAI.getGenerativeModel({
        model: GEMINI_VISION_MODEL,
        generationConfig: {
          maxOutputTokens: 400,
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      });

      const result = await model.generateContent([
        { text: CLASSIFY_PROMPT },
        { text: description },
      ]);

      return NextResponse.json(parseClassification(result.response.text()));
    }

    if (!isGeminiConfigured() && (imageUrl || imageData)) {
      return NextResponse.json(
        { error: "AI identification is not configured. Add GEMINI_API_KEY to the server environment." },
        { status: 503 }
      );
    }

    const fallback = classifyFromText(description ?? "");
    return NextResponse.json(fallback);
  } catch (error) {
    console.error("[ai/classify]", error);
    return NextResponse.json({ error: "Classification failed" }, { status: 500 });
  }
}

function classifyFromText(text: string) {
  const q = text.toLowerCase();
  let type: WasteType = "OTHER";

  if (/plastic|bottle|pet|container/.test(q)) type = "PLASTIC";
  else if (/paper|cardboard|newspaper/.test(q)) type = "PAPER";
  else if (/glass|jar|bottle/.test(q)) type = "GLASS";
  else if (/metal|can|aluminum|tin/.test(q)) type = "METAL";
  else if (/electronic|battery|phone|e-waste/.test(q)) type = "ELECTRONICS";
  else if (/organic|food|compost|vegetable/.test(q)) type = "ORGANIC";
  else if (/textile|cloth|fabric|clothing/.test(q)) type = "TEXTILE";
  else if (/hazardous|chemical|paint|medicine/.test(q)) type = "HAZARDOUS";

  const pointsMap: Record<WasteType, number> = {
    PLASTIC: 10,
    PAPER: 8,
    GLASS: 12,
    METAL: 15,
    ELECTRONICS: 25,
    ORGANIC: 5,
    TEXTILE: 7,
    HAZARDOUS: 20,
    OTHER: 3,
  };

  return {
    type,
    typeLabel: WASTE_TYPE_LABELS[type],
    disposal: getDisposalTip(type),
    estimatedPointsPerKg: pointsMap[type],
    confidence: 0.65,
    tips: "Configure GEMINI_API_KEY for image-based classification.",
  };
}

function getDisposalTip(type: WasteType): string {
  const tips: Record<WasteType, string> = {
    PLASTIC:
      "Rinse and dry plastic containers. Remove caps if required by your center.",
    PAPER: "Keep paper dry and flat. Remove plastic coatings when possible.",
    GLASS: "Rinse glass jars and bottles. Separate by color if required.",
    METAL: "Crush cans when safe. Remove non-metal parts.",
    ELECTRONICS:
      "Bring to designated e-waste collection. Never mix with regular waste.",
    ORGANIC: "Compost at home or use barangay organic collection bins.",
    TEXTILE:
      "Donate wearable items or bring clean textiles to collection centers.",
    HAZARDOUS:
      "Handle with care. Use special hazardous waste drop-off points only.",
    OTHER: "Check with your barangay staff for proper disposal guidance.",
  };
  return tips[type];
}
