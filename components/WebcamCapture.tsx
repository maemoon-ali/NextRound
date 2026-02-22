"use client";

import { forwardRef, useRef, useEffect, useState } from "react";
import { WebcamWithSegmentBlur } from "./WebcamWithSegmentBlur";

type BackgroundMode = "normal" | "blur" | "professional";

interface WebcamCaptureProps {
  stream?: MediaStream | null;
  backgroundMode?: BackgroundMode;
  brightness?: number;
  contrast?: number;
  className?: string;
}

export const WebcamCapture = forwardRef<HTMLVideoElement | null, WebcamCaptureProps>(
  function WebcamCapture(
    {
      stream: propStream,
      backgroundMode = "normal",
      brightness = 1,
      contrast = 1,
      className,
    },
    ref
  ) {
    const [error, setError] = useState<string | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamToUse = propStream ?? stream;

    useEffect(() => {
      if (propStream) {
        setStream(propStream);
        setError(null);
        return () => {};
      }
      let s: MediaStream | null = null;
      async function start() {
        try {
          s = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: "user" },
            audio: true,
          });
          setStream(s);
          setError(null);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Could not access camera/microphone"
          );
        }
      }
      start();
      return () => {
        if (!propStream) s?.getTracks().forEach((t) => t.stop());
      };
    }, [propStream]);

    useEffect(() => {
      const video = videoRef.current;
      if (video && streamToUse) video.srcObject = streamToUse;
    }, [streamToUse]);

    const setRefs = (el: HTMLVideoElement | null) => {
      (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    };

    const filterParts = [
      `brightness(${brightness})`,
      `contrast(${contrast})`,
    ].filter(Boolean);
    const videoFilter = filterParts.join(" ");

    const baseClass = "relative overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800";
    const sizeClass = className ? "" : "aspect-video";

    if (error) {
      return (
        <div className={`${baseClass} ${sizeClass} flex items-center justify-center text-amber-400 ${className ?? ""}`.trim()}>
          {error}. Allow camera and microphone to run the interview.
        </div>
      );
    }

    if (backgroundMode === "blur" && streamToUse) {
      return (
        <div className={`${baseClass} ${sizeClass} ${className ?? ""}`.trim()}>
          <WebcamWithSegmentBlur
            ref={ref}
            stream={streamToUse}
            brightness={brightness}
            contrast={contrast}
          />
          {!streamToUse && (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
              Starting camera…
            </div>
          )}
        </div>
      );
    }

    return (
      <div className={`${baseClass} ${sizeClass} ${className ?? ""}`.trim()}>
        {backgroundMode === "professional" && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: "linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)",
            }}
            aria-hidden
          />
        )}
        <video
          ref={setRefs}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{
            transform: "scaleX(-1)",
            filter: videoFilter,
            WebkitFilter: videoFilter,
          }}
        />
        {!streamToUse && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
            Starting camera…
          </div>
        )}
      </div>
    );
  }
);
