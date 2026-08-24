"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function HoverCardPreview({
  src,
  name,
  children,
}: {
  src: string | null;
  name: string;
  children: ReactNode;
}) {
  const marker = useRef<HTMLSpanElement>(null);
  const [preview, setPreview] = useState<{ left: number; top: number } | null>(
    null,
  );

  useEffect(() => {
    const trigger = marker.current;
    if (!trigger || !window.matchMedia("(hover: hover)").matches) return;
    const position = (clientX: number, clientY: number) =>
      setPreview({
        left: Math.max(8, clientX - 208),
        top: Math.min(Math.max(8, clientY - 132), window.innerHeight - 274),
      });
    const move = (event: MouseEvent) => position(event.clientX, event.clientY);
    const enter = (event: MouseEvent) => position(event.clientX, event.clientY);
    const leave = () => setPreview(null);
    const focus = () => {
      const rect = trigger.getBoundingClientRect();
      position(rect.left + 40, rect.top + rect.height / 2);
    };
    trigger.addEventListener("mousemove", move);
    trigger.addEventListener("mouseenter", enter);
    trigger.addEventListener("mouseleave", leave);
    trigger.addEventListener("focus", focus);
    trigger.addEventListener("blur", leave);
    return () => {
      trigger.removeEventListener("mousemove", move);
      trigger.removeEventListener("mouseenter", enter);
      trigger.removeEventListener("mouseleave", leave);
      trigger.removeEventListener("focus", focus);
      trigger.removeEventListener("blur", leave);
    };
  }, []);

  return (
    <>
      <span ref={marker} className="hover-preview-trigger" tabIndex={0}>
        {children}
      </span>
      {preview &&
        createPortal(
          <div
            className="cursor-card-preview"
            style={preview}
            aria-hidden="true"
          >
            {src ? (
              <Image src={src} alt="" width={190} height={266} unoptimized />
            ) : (
              <div className="cursor-card-placeholder">{name.slice(0, 1)}</div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
