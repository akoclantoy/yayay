"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Camera,
  Check,
  ImagePlus,
  LoaderCircle,
  MessageCircle,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Category = { id: string; name: string; pointsPerKg: number; type: string };
type WasteSuggestion = {
  type: string;
  material: string;
  disposal: string;
  confidence: number;
};
type Message = {
  role: "user" | "assistant";
  content: string;
  imageData?: string;
  suggestion?: WasteSuggestion | null;
};

const STARTER_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hi! I can help identify recyclable materials, suggest the right category, and share safe handling or disposal guidance. Upload an image, take a photo, or ask me a question.",
};

async function imageFileToDataUrl(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file to share with the assistant.");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("Image is too large. Choose an image under 12 MB.");
  }

  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read this image."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new window.Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Unable to open this image."));
    element.src = source;
  });

  const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to prepare this image.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  if (dataUrl.length > 6 * 1024 * 1024) {
    throw new Error("Image is too large to send. Choose a smaller image.");
  }
  return dataUrl;
}

export function RecyclingAssistant({
  categories,
  onCategorySuggested,
}: {
  categories: Category[];
  onCategorySuggested: (type: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([STARTER_MESSAGE]);
  const [draft, setDraft] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {
      toast.error("Camera preview could not start. Check browser camera permission.");
    });
  }, [cameraOpen]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function chooseImage(file?: File) {
    if (!file) return;
    try {
      setImageData(await imageFileToDataUrl(file));
      setCameraOpen(false);
      toast.success("Image attached. Add a question or send it to the assistant.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to attach image.");
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setCameraStarting(false);
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }

    setCameraStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      toast.error("Camera access was unavailable. You can upload or take a photo instead.");
      cameraInputRef.current?.click();
    } finally {
      setCameraStarting(false);
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error("Wait for the camera preview before taking a photo.");
      return;
    }

    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      toast.error("Unable to capture this photo.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setImageData(canvas.toDataURL("image/jpeg", 0.82));
    closeCamera();
    toast.success("Photo captured. Send it to the assistant when you’re ready.");
  }

  async function sendMessage() {
    const content = draft.trim();
    if ((!content && !imageData) || sending) return;

    const userMessage: Message = {
      role: "user",
      content: content || "Please identify this material and suggest the correct waste category.",
      ...(imageData ? { imageData } : {}),
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setImageData(null);
    setSending(true);

    const conversation = nextMessages.slice(1).slice(-16);
    if (conversation[0]?.role === "assistant") conversation.shift();
    const imageForRequest =
      userMessage.imageData ??
      [...conversation]
        .reverse()
        .find((message) => message.role === "user" && message.imageData)?.imageData;

    try {
      const response = await fetch("/api/ai/staff-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversation.map(({ role, content: messageContent }) => ({
            role,
            content: messageContent,
          })),
          imageData: imageForRequest,
        }),
      });
      const data: {
        error?: string;
        answer?: string;
        suggestion?: WasteSuggestion | null;
      } = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Assistant could not respond.");
      const answer = data.answer;
      if (!answer) throw new Error("Assistant returned an empty response.");

      const suggestion = data.suggestion ?? null;
      setMessages((current) => [
        ...current,
        { role: "assistant", content: answer, suggestion },
      ]);

      if (suggestion) {
        const category = categories.find((item) => item.type === suggestion.type);
        if (category) {
          onCategorySuggested(category.type);
          toast.success(`${category.name} suggested and selected in the record form.`);
        }
      }
    } catch (error) {
      setMessages((current) => current.filter((message) => message !== userMessage));
      setDraft(content);
      setImageData(userMessage.imageData ?? null);
      toast.error(error instanceof Error ? error.message : "Assistant could not respond.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="overflow-hidden border-emerald-900/15 shadow-lg shadow-emerald-950/5">
      <CardHeader className="border-b border-border/70 bg-[linear-gradient(115deg,rgba(16,92,67,0.08),rgba(232,184,76,0.1)_58%,rgba(255,255,255,0.5))] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-sm">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                Recycling AI assistant
                <Sparkles className="h-4 w-4 text-amber-500" />
              </CardTitle>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Gemini · waste guidance for collection staff
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="hidden sm:inline-flex">Image + chat</Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div
          className="h-[360px] space-y-4 overflow-y-auto bg-gradient-to-b from-muted/20 to-background p-4 sm:h-[400px] sm:p-5"
          aria-live="polite"
          aria-label="Recycling assistant conversation"
        >
          {messages.map((message, index) => (
            <div
              key={`${index}-${message.role}`}
              className={`flex gap-2.5 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-800/10 text-emerald-800">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={`max-w-[88%] space-y-2 ${
                  message.role === "user"
                    ? "rounded-2xl rounded-br-md bg-emerald-800 px-4 py-3 text-white"
                    : "rounded-2xl rounded-bl-md border border-border/70 bg-card px-4 py-3 shadow-sm"
                }`}
              >
                {message.imageData && (
                  <img
                    src={message.imageData}
                    alt="Image shared with the recycling assistant"
                    className="max-h-44 w-full rounded-xl object-cover"
                  />
                )}
                <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                {message.suggestion && (
                  <div className="space-y-2 rounded-xl border border-emerald-700/20 bg-emerald-700/5 p-3 text-foreground">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="success">{message.suggestion.type.replaceAll("_", " ")}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(message.suggestion.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p className="text-xs">
                      <span className="font-semibold">Material:</span> {message.suggestion.material}
                    </p>
                    <p className="text-xs leading-5">
                      <span className="font-semibold">Handling:</span> {message.suggestion.disposal}
                    </p>
                    {categories.some((item) => item.type === message.suggestion?.type) && (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-800">
                        <Check className="h-3.5 w-3.5" />
                        Suggested category selected in the record form
                      </p>
                    )}
                  </div>
                )}
              </div>
              {message.role === "user" && (
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UserRound className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-800/10 text-emerald-800">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Reviewing your message and image…
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {cameraOpen && (
          <div className="space-y-3 border-t border-border/70 bg-black p-3">
            <video
              ref={videoRef}
              muted
              playsInline
              className="max-h-64 w-full rounded-xl object-contain"
            />
            <div className="flex gap-2">
              <Button type="button" className="flex-1" onClick={() => void capturePhoto()}>
                <Camera className="h-4 w-4" /> Take photo
              </Button>
              <Button type="button" variant="secondary" onClick={closeCamera}>
                <X className="h-4 w-4" /> Close
              </Button>
            </div>
          </div>
        )}

        <div className="border-t border-border/70 bg-card p-3 sm:p-4">
          {imageData && (
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-2.5">
              <img
                src={imageData}
                alt="Image ready to send"
                className="h-16 w-16 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Image ready to send</p>
                <p className="text-xs text-muted-foreground">
                  Add a question or send it for material identification.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove attached image"
                onClick={() => setImageData(null)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-end gap-2">
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Upload an image"
                  title="Upload an image"
                  disabled={sending || cameraOpen}
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Take a picture"
                  title="Take a picture"
                  disabled={sending || cameraStarting || cameraOpen}
                  onClick={() => void openCamera()}
                >
                  {cameraStarting ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask about this material…"
                aria-label="Message the recycling assistant"
                maxLength={4000}
                disabled={sending}
                className="min-w-0 flex-1"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                aria-label="Send message"
                disabled={sending || (!draft.trim() && !imageData)}
                onClick={() => void sendMessage()}
              >
                {sending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                void chooseImage(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
              tabIndex={-1}
              aria-hidden="true"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                void chooseImage(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
          <p className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
            <MessageCircle className="h-3 w-3" />
            AI suggestions should be checked by staff before recording.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
