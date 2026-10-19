"use client";

import { useEffect } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { formatPoints } from "@/lib/utils";

export function AnimatedPoints({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const points = useMotionValue(value);
  const prefersReducedMotion = useReducedMotion();
  const formattedPoints = useTransform(points, (current) =>
    formatPoints(Math.round(current))
  );

  useEffect(() => {
    const animation = animate(points, value, {
      duration: prefersReducedMotion ? 0 : 0.9,
      ease: [0.22, 1, 0.36, 1],
    });
    return animation.stop;
  }, [points, prefersReducedMotion, value]);

  return (
    <>
      <motion.span className={className} aria-hidden="true">
        {formattedPoints}
      </motion.span>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {formatPoints(value)} points
      </span>
    </>
  );
}
