"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
} from "lucide-react";

type CallKind = "AUDIO" | "VIDEO";
type CallStatus = "RINGING" | "ACCEPTED" | "DECLINED" | "MISSED" | "ENDED";
type ResidentCall = {
  id: string;
  conversationId: string;
  callerId: string;
  calleeId: string;
  kind: CallKind;
  status: CallStatus;
  createdAt: string;
  peer: { id: string; name: string | null; image: string | null };
};
type CallSignal = {
  id: string;
  senderId: string;
  kind: "OFFER" | "ANSWER" | "ICE";
  payload: Record<string, unknown>;
};
type IceServerList = RTCIceServer[];
type CallSignalInput =
  | { kind: "OFFER"; payload: { type: "offer"; sdp: string } }
  | { kind: "ANSWER"; payload: { type: "answer"; sdp: string } }
  | { kind: "ICE"; payload: RTCIceCandidateInit };

async function callRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
  });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "The call request could not be completed.");
  return result;
}

function displayName(name: string | null) {
  return name?.trim() || "EcoRewards resident";
}

function peerConnectionError() {
  return new Error(
    "Your browser could not establish the call. Check your connection and try again. If this keeps happening, the service may need TURN relay configuration.",
  );
}

export function useResidentCalling(residentId: string) {
  const [call, setCallState] = useState<ResidentCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [callPhase, setCallPhase] = useState("Connecting");
  const [muted, setMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [startingCall, setStartingCall] = useState(false);
  const callRef = useRef<ResidentCall | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const iceServersRef = useRef<IceServerList>([]);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const handledSignalsRef = useRef(new Set<string>());
  const syncingRef = useRef(false);
  const endTimerRef = useRef<number | null>(null);

  const setCall = useCallback((next: ResidentCall | null) => {
    callRef.current = next;
    setCallState(next);
  }, []);

  const cleanupMedia = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    pendingCandidatesRef.current = [];
    handledSignalsRef.current.clear();
    setMuted(false);
    setCameraEnabled(true);
  }, []);

  const handleFinishedCall = useCallback((finished: ResidentCall) => {
    cleanupMedia();
    setCallPhase(
      finished.status === "DECLINED"
        ? "Call declined"
        : finished.status === "MISSED"
          ? "No answer"
          : "Call ended",
    );
    if (endTimerRef.current !== null) window.clearTimeout(endTimerRef.current);
    endTimerRef.current = window.setTimeout(() => {
      if (callRef.current?.id === finished.id) setCall(null);
      endTimerRef.current = null;
    }, 2200);
  }, [cleanupMedia, setCall]);

  const postSignal = useCallback(async (callId: string, signal: CallSignalInput) => {
    await callRequest("/api/resident/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signal", callId, signal }),
    });
  }, []);

  const createPeer = useCallback((callId: string, stream: MediaStream) => {
    peerRef.current?.close();
    const peer = new RTCPeerConnection({ iceServers: iceServersRef.current });
    peerRef.current = peer;
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.ontrack = (event) => {
      let incomingStream = remoteStreamRef.current;
      if (!incomingStream) {
        incomingStream = new MediaStream();
        remoteStreamRef.current = incomingStream;
      }
      if (!incomingStream.getTracks().some((track) => track.id === event.track.id)) {
        incomingStream.addTrack(event.track);
      }
      setRemoteStream(incomingStream);
    };
    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      void postSignal(callId, { kind: "ICE", payload: event.candidate.toJSON() })
        .catch((error: unknown) => {
          console.error("[resident-calls] Unable to send network candidate:", error);
        });
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") setCallPhase("Connected");
      else if (peer.connectionState === "connecting") setCallPhase("Connecting");
      else if (peer.connectionState === "disconnected") setCallPhase("Reconnecting");
      else if (peer.connectionState === "failed") {
        setCallPhase("Connection failed");
        setCallError(peerConnectionError().message);
      }
    };
    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === "failed") {
        setCallPhase("Connection failed");
        setCallError(peerConnectionError().message);
      }
    };
    return peer;
  }, [postSignal]);

  const applySignal = useCallback(async (callId: string, signal: CallSignal) => {
    if (handledSignalsRef.current.has(signal.id)) return;
    const peer = peerRef.current;
    if (!peer) return;
    handledSignalsRef.current.add(signal.id);

    try {
      if (signal.kind === "OFFER" && signal.payload.type === "offer" && typeof signal.payload.sdp === "string") {
        await peer.setRemoteDescription({ type: "offer", sdp: signal.payload.sdp });
        for (const candidate of pendingCandidatesRef.current.splice(0)) {
          await peer.addIceCandidate(candidate);
        }
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        if (!peer.localDescription?.sdp) throw new Error("Could not prepare the call answer.");
        await postSignal(callId, {
          kind: "ANSWER",
          payload: { type: "answer", sdp: peer.localDescription.sdp },
        });
      } else if (
        signal.kind === "ANSWER" &&
        signal.payload.type === "answer" &&
        typeof signal.payload.sdp === "string" &&
        !peer.remoteDescription
      ) {
        await peer.setRemoteDescription({ type: "answer", sdp: signal.payload.sdp });
        for (const candidate of pendingCandidatesRef.current.splice(0)) {
          await peer.addIceCandidate(candidate);
        }
      } else if (signal.kind === "ICE" && typeof signal.payload.candidate === "string") {
        const candidate: RTCIceCandidateInit = {
          candidate: signal.payload.candidate,
          ...(typeof signal.payload.sdpMid === "string" || signal.payload.sdpMid === null
            ? { sdpMid: signal.payload.sdpMid }
            : {}),
          ...(typeof signal.payload.sdpMLineIndex === "number" || signal.payload.sdpMLineIndex === null
            ? { sdpMLineIndex: signal.payload.sdpMLineIndex }
            : {}),
          ...(typeof signal.payload.usernameFragment === "string" || signal.payload.usernameFragment === null
            ? { usernameFragment: signal.payload.usernameFragment }
            : {}),
        };
        if (peer.remoteDescription) await peer.addIceCandidate(candidate);
        else pendingCandidatesRef.current.push(candidate);
      }
    } catch (error) {
      handledSignalsRef.current.delete(signal.id);
      console.error("[resident-calls] Unable to apply call signaling:", error);
      setCallError(peerConnectionError().message);
    }
  }, [postSignal]);

  const syncCall = useCallback(async (callId: string) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const result = await callRequest<{
        call: ResidentCall;
        signals: CallSignal[];
        iceServers: IceServerList;
      }>(`/api/resident/calls?callId=${encodeURIComponent(callId)}`);
      iceServersRef.current = result.iceServers;
      if (result.call.status === "DECLINED" || result.call.status === "MISSED" || result.call.status === "ENDED") {
        setCall(result.call);
        handleFinishedCall(result.call);
        return;
      }
      setCall(result.call);
      for (const signal of result.signals) {
        await applySignal(callId, signal);
      }
    } catch (error) {
      if (error instanceof Error && error.message === "Call not found.") {
        const current = callRef.current;
        if (current?.id === callId) handleFinishedCall({ ...current, status: "ENDED" });
      } else {
        console.error("[resident-calls] Unable to refresh call:", error);
      }
    } finally {
      syncingRef.current = false;
    }
  }, [applySignal, handleFinishedCall, setCall]);

  const acquireMedia = useCallback(async (kind: CallKind) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Voice and video calls require a secure browser connection and a supported browser.");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === "VIDEO",
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        throw new Error("Allow microphone and camera access in your browser to place this call.");
      }
      if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        throw new Error("A microphone or camera required for this call could not be found.");
      }
      throw new Error("Unable to start your microphone or camera. Check your browser permissions and try again.");
    }
  }, []);

  const startCall = useCallback(async (conversationId: string, kind: CallKind) => {
    if (startingCall) return;
    setStartingCall(true);
    setCallError(null);
    try {
      const stream = await acquireMedia(kind);
      const result = await callRequest<{ call: ResidentCall; iceServers: IceServerList }>("/api/resident/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", conversationId, kind }),
      });
      iceServersRef.current = result.iceServers;
      setCall(result.call);
      setCallPhase("Calling");
      const peer = createPeer(result.call.id, stream);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (!peer.localDescription?.sdp) throw new Error("Could not prepare the call offer.");
      await postSignal(result.call.id, {
        kind: "OFFER",
        payload: { type: "offer", sdp: peer.localDescription.sdp },
      });
    } catch (error) {
      const activeCall = callRef.current;
      if (activeCall?.callerId === residentId && activeCall.status === "RINGING") {
        await callRequest("/api/resident/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "end", callId: activeCall.id }),
        }).catch((endError: unknown) => {
          console.error("[resident-calls] Could not end failed call:", endError);
        });
      }
      cleanupMedia();
      setCall(null);
      setCallError(error instanceof Error ? error.message : "Unable to start the call.");
    } finally {
      setStartingCall(false);
    }
  }, [acquireMedia, cleanupMedia, createPeer, postSignal, residentId, setCall, startingCall]);

  const acceptCall = useCallback(async () => {
    const incoming = callRef.current;
    if (!incoming || incoming.calleeId !== residentId) return;
    setCallError(null);
    setStartingCall(true);
    try {
      const stream = await acquireMedia(incoming.kind);
      const result = await callRequest<{ call: ResidentCall; iceServers: IceServerList }>("/api/resident/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", callId: incoming.id }),
      });
      iceServersRef.current = result.iceServers;
      setCall(result.call);
      setCallPhase("Connecting");
      createPeer(incoming.id, stream);
      await syncCall(incoming.id);
    } catch (error) {
      await callRequest("/api/resident/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", callId: incoming.id }),
      }).catch((endError: unknown) => {
        console.error("[resident-calls] Could not close call after accept failed:", endError);
      });
      cleanupMedia();
      setCall(null);
      setCallError(error instanceof Error ? error.message : "Unable to answer the call.");
    } finally {
      setStartingCall(false);
    }
  }, [acquireMedia, cleanupMedia, createPeer, residentId, setCall, syncCall]);

  const closeCall = useCallback(async (action: "decline" | "end") => {
    const active = callRef.current;
    if (!active) return;
    setCallError(null);
    try {
      await callRequest("/api/resident/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, callId: active.id }),
      });
      const finished = {
        ...active,
        status: action === "decline" ? "DECLINED" as const : "ENDED" as const,
      };
      setCall(finished);
      handleFinishedCall(finished);
    } catch (error) {
      setCallError(error instanceof Error ? error.message : "Unable to end the call.");
    }
  }, [handleFinishedCall, setCall]);

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const result = await callRequest<{ calls: ResidentCall[]; iceServers: IceServerList }>("/api/resident/calls");
        if (!mounted) return;
        iceServersRef.current = result.iceServers;
        const current = callRef.current;
        const found = result.calls.find((item) => item.id === current?.id) ??
          (current ? null : result.calls[0] ?? null);
        if (!found) return;
        setCall(found);
        if (found.callerId !== residentId && found.status === "RINGING") {
          setCallPhase("Incoming call");
        }
      } catch (error) {
        if (mounted) console.error("[resident-calls] Unable to check for calls:", error);
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 1800);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [residentId, setCall]);

  useEffect(() => {
    if (!call?.id || call.status === "DECLINED" || call.status === "MISSED" || call.status === "ENDED") return;
    const interval = window.setInterval(() => void syncCall(call.id), 900);
    return () => window.clearInterval(interval);
  }, [call?.id, call?.status, syncCall]);

  useEffect(() => () => {
    if (endTimerRef.current !== null) window.clearTimeout(endTimerRef.current);
    peerRef.current?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const toggleMicrophone = useCallback(() => {
    const nextMuted = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !nextMuted; });
    setMuted(nextMuted);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const nextEnabled = !cameraEnabled;
    localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = nextEnabled; });
    setCameraEnabled(nextEnabled);
  }, [cameraEnabled]);

  return {
    call,
    localStream,
    remoteStream,
    callError,
    callPhase,
    muted,
    cameraEnabled,
    startingCall,
    startCall,
    acceptCall,
    declineCall: () => closeCall("decline"),
    endCall: () => closeCall("end"),
    toggleMicrophone,
    toggleCamera,
    clearCallError: () => setCallError(null),
  };
}

export function ResidentCallOverlay({
  call,
  localStream,
  remoteStream,
  callError,
  callPhase,
  muted,
  cameraEnabled,
  startingCall,
  onAccept,
  onDecline,
  onEnd,
  onToggleMicrophone,
  onToggleCamera,
  onClearError,
}: {
  call: ResidentCall | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callError: string | null;
  callPhase: string;
  muted: boolean;
  cameraEnabled: boolean;
  startingCall: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMicrophone: () => void;
  onToggleCamera: () => void;
  onClearError: () => void;
}) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [seconds, setSeconds] = useState(0);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const incoming = call?.status === "RINGING" && !localStream;
  const active = call?.status === "ACCEPTED";
  const finished = call && ["DECLINED", "MISSED", "ENDED"].includes(call.status);
  const showVideo = call?.kind === "VIDEO" && active;

  useEffect(() => {
    const audioElement = remoteAudioRef.current;
    const videoElement = remoteVideoRef.current;
    if (audioElement) {
      audioElement.srcObject = remoteStream;
      if (remoteStream && active) {
        void audioElement.play()
          .then(() => setAudioPlaybackBlocked(false))
          .catch(() => setAudioPlaybackBlocked(true));
      }
    }
    if (videoElement) {
      videoElement.srcObject = showVideo ? remoteStream : null;
    }
  }, [active, remoteStream, showVideo]);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream, showVideo]);

  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const interval = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(interval);
  }, [active, call?.id]);

  if (!call) {
    return callError ? (
      <div className="fixed left-1/2 top-5 z-[90] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 shadow-xl" role="alert">
        <span>{callError}</span>
        <button type="button" onClick={onClearError} aria-label="Dismiss call error" className="shrink-0 font-semibold">Close</button>
      </div>
    ) : null;
  }

  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  const enableCallAudio = async () => {
    const audioElement = remoteAudioRef.current;
    if (!audioElement) return;
    try {
      await audioElement.play();
      setAudioPlaybackBlocked(false);
    } catch {
      setAudioPlaybackBlocked(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-label={`${call.kind === "VIDEO" ? "Video" : "Audio"} call with ${displayName(call.peer.name)}`}>
      <div className={cn("relative flex w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#10141d] text-white shadow-2xl", showVideo ? "h-[min(780px,92dvh)]" : "min-h-[420px] max-w-lg")}>
        {showVideo ? (
          <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[#090c12]">
            {remoteStream ? (
              <video ref={remoteVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" aria-label={`${displayName(call.peer.name)} video`} />
            ) : (
              <div className="flex flex-col items-center gap-4 text-center">
                <span className="flex h-28 w-28 items-center justify-center rounded-full bg-white/10 text-3xl font-semibold text-white/80">
                  {displayName(call.peer.name).slice(0, 1).toUpperCase()}
                </span>
                <span className="text-sm text-white/65">{callPhase}</span>
              </div>
            )}
            <video ref={localVideoRef} autoPlay muted playsInline className="absolute bottom-5 right-5 aspect-video w-28 rounded-2xl border border-white/20 bg-black object-cover shadow-xl sm:w-44" aria-label="Your camera preview" />
            <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
            <div className="absolute left-5 top-5 rounded-full bg-black/40 px-4 py-2 text-sm font-medium backdrop-blur">{displayName(call.peer.name)} <span className="ml-2 text-white/70">{active ? `${minutes}:${remainder}` : callPhase}</span></div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-7 text-center">
            <span className={cn("mb-5 rounded-full p-1", incoming ? "animate-pulse bg-blue-400/20" : "bg-white/10")}>
              <Avatar className="h-28 w-28 border-4 border-white/10">
                <AvatarImage src={call.peer.image ?? undefined} alt={displayName(call.peer.name)} />
                <AvatarFallback className="bg-slate-700 text-3xl text-white">{displayName(call.peer.name).slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
            </span>
            <h2 className="text-2xl font-semibold tracking-tight">{displayName(call.peer.name)}</h2>
            <p className="mt-2 flex items-center gap-2 text-sm text-white/60">
              {call.kind === "VIDEO" ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
              {finished ? callPhase : active ? `${callPhase} · ${minutes}:${remainder}` : callPhase}
            </p>
            {call.kind === "VIDEO" && active && localStream && (
              <video ref={localVideoRef} autoPlay muted playsInline className="mt-5 aspect-video w-full max-w-xs rounded-2xl bg-black object-cover" aria-label="Your camera preview" />
            )}
            <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
            <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
          </div>
        )}

        {active && audioPlaybackBlocked && (
          <div className="mx-5 mb-2 flex items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2.5 text-left text-xs leading-5 text-amber-100" role="status">
            <span>Tap to enable call audio on this device.</span>
            <button type="button" onClick={() => void enableCallAudio()} className="shrink-0 font-semibold text-white underline underline-offset-2">Enable audio</button>
          </div>
        )}

        {callError && (
          <div className="mx-5 mb-2 flex items-start justify-between gap-3 rounded-xl border border-rose-300/20 bg-rose-500/10 px-3 py-2.5 text-left text-xs leading-5 text-rose-100" role="alert">
            <span>{callError}</span>
            <button type="button" onClick={onClearError} className="shrink-0 font-semibold text-white underline underline-offset-2">Dismiss</button>
          </div>
        )}

        <div className="flex items-center justify-center gap-4 border-t border-white/10 bg-[#171c27] px-5 py-5">
          {!incoming && !finished && (
            <>
              <button type="button" onClick={onToggleMicrophone} aria-label={muted ? "Unmute microphone" : "Mute microphone"} title={muted ? "Unmute microphone" : "Mute microphone"} className={cn("flex h-12 w-12 items-center justify-center rounded-full transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400", muted ? "bg-white text-slate-900" : "bg-white/10 text-white")}>
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              {call.kind === "VIDEO" && (
                <button type="button" onClick={onToggleCamera} aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"} title={cameraEnabled ? "Turn camera off" : "Turn camera on"} className={cn("flex h-12 w-12 items-center justify-center rounded-full transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400", cameraEnabled ? "bg-white/10 text-white" : "bg-white text-slate-900")}>
                  {cameraEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
                </button>
              )}
            </>
          )}

          {incoming && (
            <>
              <Button type="button" onClick={onDecline} disabled={startingCall} aria-label="Decline call" className="h-12 w-12 rounded-full bg-rose-600 p-0 text-white hover:bg-rose-500">
                <PhoneOff className="h-5 w-5" />
              </Button>
              <Button type="button" onClick={onAccept} disabled={startingCall} aria-label={`Answer ${call.kind.toLowerCase()} call`} className="h-12 w-12 rounded-full bg-emerald-500 p-0 text-white hover:bg-emerald-400">
                {call.kind === "VIDEO" ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
              </Button>
            </>
          )}

          {!incoming && !finished && (
            <Button type="button" onClick={onEnd} aria-label="End call" className="h-12 w-12 rounded-full bg-rose-600 p-0 text-white hover:bg-rose-500">
              <PhoneOff className="h-5 w-5" />
            </Button>
          )}
          {finished && <span className="text-sm font-medium text-white/70">{callPhase}</span>}
        </div>
      </div>
    </div>
  );
}
