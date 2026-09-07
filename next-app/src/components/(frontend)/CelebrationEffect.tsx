"use client";

import React, { useEffect, useState } from "react";
import Confetti from "react-confetti";

interface CelebrationEffectProps {
  duration?: number;
  onComplete?: () => void;
}

export default function CelebrationEffect({ duration = 6000, onComplete }: CelebrationEffectProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    const updateSize = () => {
      setDimensions({
        width: typeof window !== "undefined" ? window.innerWidth : 1200,
        height: typeof window !== "undefined" ? window.innerHeight : 800,
      });
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    const timer = setTimeout(() => {
      setIsActive(false);
      if (onComplete) onComplete();
    }, duration);

    return () => {
      window.removeEventListener("resize", updateSize);
      clearTimeout(timer);
    };
  }, [duration, onComplete]);

  if (!isActive || dimensions.width === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[999999]">
      <Confetti
        width={dimensions.width}
        height={dimensions.height}
        numberOfPieces={450}
        gravity={0.22}
        recycle={true}
        run={isActive}
        colors={["#007FFF", "#ff9903", "#10B981", "#EC4899", "#8B5CF6", "#F59E0B", "#3B82F6"]}
      />
    </div>
  );
}
