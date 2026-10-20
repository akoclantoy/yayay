"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type FriendTogetherProfile = {
  id: string;
  name: string | null;
  image: string | null;
};

function CelebrationAvatar({ resident }: { resident: FriendTogetherProfile }) {
  const name = resident.name?.trim() || "EcoRewards resident";
  return (
    <Avatar className="h-16 w-16 border-2 border-white/80 shadow-sm sm:h-20 sm:w-20">
      <AvatarImage src={resident.image ?? undefined} alt={name} />
      <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

export function FriendTogetherCelebration({
  resident,
  friend,
}: {
  resident: FriendTogetherProfile;
  friend: FriendTogetherProfile | null;
}) {
  return (
    <AnimatePresence>
      {friend && (
        <motion.div
          key={friend.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-slate-950/55 p-5 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.88, rotateX: 8 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 250, damping: 22 }}
            className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/70 bg-white px-6 py-8 text-center shadow-[0_32px_100px_rgba(5,30,21,0.35)] sm:px-10 sm:py-10"
            style={{ perspective: 1000 }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(52,168,112,0.18),transparent_58%)]" />
            <motion.div
              aria-hidden="true"
              animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.12, 1] }}
              transition={{ duration: 1.2, repeat: 2, ease: "easeInOut" }}
              className="relative mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner"
            >
              <Sparkles className="h-7 w-7" />
            </motion.div>
            <div className="relative mx-auto flex w-fit items-center gap-3 sm:gap-5" style={{ perspective: 800 }}>
              <motion.div
                initial={{ x: -28, rotateY: -24, rotateZ: -6 }}
                animate={{ x: 0, rotateY: 0, rotateZ: 0, y: [0, -5, 0] }}
                transition={{ type: "spring", stiffness: 220, damping: 16, y: { duration: 1.1, repeat: 2 } }}
                className="rounded-3xl border border-white bg-white p-2 shadow-[0_12px_30px_rgba(23,67,47,0.18)]"
              >
                <CelebrationAvatar resident={resident} />
              </motion.div>
              <motion.div
                aria-hidden="true"
                animate={{ scale: [0.85, 1.15, 0.85], rotate: [0, -8, 0] }}
                transition={{ duration: 1.1, repeat: 2, ease: "easeInOut" }}
                className="z-10 -mx-3 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-primary text-white shadow-lg"
              >
                <Users className="h-4 w-4" />
              </motion.div>
              <motion.div
                initial={{ x: 28, rotateY: 24, rotateZ: 6 }}
                animate={{ x: 0, rotateY: 0, rotateZ: 0, y: [0, -5, 0] }}
                transition={{ type: "spring", stiffness: 220, damping: 16, y: { duration: 1.1, repeat: 2 } }}
                className="rounded-3xl border border-white bg-white p-2 shadow-[0_12px_30px_rgba(23,67,47,0.18)]"
              >
                <CelebrationAvatar resident={friend} />
              </motion.div>
            </div>
            <div className="relative mt-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">A new EcoRewards connection</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Your Friend Together</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                You and <span className="font-semibold text-slate-900">{friend.name?.trim() || "your new friend"}</span> are friends now. Start a conversation and keep making a difference together.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
