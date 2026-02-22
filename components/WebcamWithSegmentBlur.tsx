"use client";

import { forwardRef, useRef, useEffect, useState } from "react";

const SEGMENTER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.task";

interface WebcamWithSegmentBlurProps {
  stream: MediaStream | null;
  brightness: number;
  contrast: number;
}

export const WebcamWithSegmentBlur = forwardRef<HTMLVideoElement | null, WebcamWithSegmentBlurProps>(
  function WebcamWithSegmentBlur({ stream, brightness, contrast }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const segmenterRef = useRef<{
      segmentForVideo: (image: HTMLVideoElement, timestamp: number) => { confidenceMasks?: { getAsFloat32Array: () => Float32Array }[] };
    } | null>(null);
    const [segmenterReady, setSegmenterReady] = useState(false);
    const rafRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);

    useEffect(() => {
      if (!stream) return;
      const v = videoRef.current;
      if (v) v.srcObject = stream;
    }, [stream]);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
          const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
          );
          if (cancelled) return;
          const segmenter = await ImageSegmenter.createFromOptions(vision, {
            baseOptions: { modelAssetPath: SEGMENTER_MODEL },
            runningMode: "VIDEO",
            outputConfidenceMasks: true,
          });
          if (cancelled) return;
          segmenterRef.current = segmenter as unknown as typeof segmenterRef.current;
          setSegmenterReady(true);
        } catch {
          setSegmenterReady(true);
        }
      })();
      return () => {
        cancelled = true;
        segmenterRef.current = null;
      };
    }, []);

    useEffect(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !stream || !segmenterReady) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let w = video.videoWidth;
      let h = video.videoHeight;
      if (w === 0 || h === 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      let offscreenRaw: HTMLCanvasElement | null = null;
      let offscreenBlur: HTMLCanvasElement | null = null;
      let maskCanvas: HTMLCanvasElement | null = null;

      function tick() {
        if (!ctx || !video || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        if (!segmenterRef.current) {
          ctx.save();
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, w, h);
          ctx.restore();
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        const now = performance.now();
        const videoTime = video.currentTime * 1000;
        if (videoTime === lastTimeRef.current) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        lastTimeRef.current = videoTime;

        try {
          const result = segmenterRef.current.segmentForVideo(video, videoTime);
          const masks = result.confidenceMasks;
          if (!masks || masks.length === 0) {
            ctx.save();
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0);
            ctx.restore();
            rafRef.current = requestAnimationFrame(tick);
            return;
          }
          // Selfie segmenter: use person mask (last category) so we blur only background and keep person sharp
          const personMask = masks[masks.length - 1].getAsFloat32Array();
          const mask = personMask;
          const maskW = Math.sqrt(mask.length) | 0;
          const maskH = mask.length / maskW;
          if (!offscreenRaw) {
            offscreenRaw = document.createElement("canvas");
            offscreenRaw.width = w;
            offscreenRaw.height = h;
            offscreenBlur = document.createElement("canvas");
            offscreenBlur.width = w;
            offscreenBlur.height = h;
            maskCanvas = document.createElement("canvas");
            maskCanvas.width = w;
            maskCanvas.height = h;
          }
          const rawCtx = offscreenRaw!.getContext("2d")!;
          const blurCtx = offscreenBlur!.getContext("2d")!;
          const maskCtx = maskCanvas!.getContext("2d")!;
          const maskImageData = maskCtx.createImageData(w, h);

          rawCtx.save();
          rawCtx.translate(w, 0);
          rawCtx.scale(-1, 1);
          rawCtx.drawImage(video, 0, 0);
          rawCtx.restore();
          blurCtx.save();
          blurCtx.filter = "blur(14px)";
          blurCtx.drawImage(offscreenRaw!, 0, 0);
          blurCtx.restore();

          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const mx = Math.floor((x / w) * maskW) % maskW;
              const my = Math.floor((y / h) * maskH) % maskH;
              const personConfidence = mask[my * maskW + mx];
              const a = personConfidence > 0.5 ? 255 : 0; // white = person (keep sharp), black = background (blur)
              const i = (y * w + x) * 4;
              maskImageData.data[i] = 255;
              maskImageData.data[i + 1] = 255;
              maskImageData.data[i + 2] = 255;
              maskImageData.data[i + 3] = a;
            }
          }
          maskCtx.putImageData(maskImageData, 0, 0);

          ctx.save();
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(offscreenBlur!, 0, 0, w, h);
          ctx.globalCompositeOperation = "destination-out";
          ctx.drawImage(maskCanvas!, 0, 0, w, h);
          ctx.globalCompositeOperation = "source-over";
          ctx.drawImage(maskCanvas!, 0, 0, w, h);
          ctx.globalCompositeOperation = "source-in";
          ctx.drawImage(video, 0, 0, w, h);
          ctx.restore();
        } catch (_) {
          ctx.save();
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0);
          ctx.restore();
        }

        rafRef.current = requestAnimationFrame(tick);
      }

      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    }, [stream, segmenterReady]);

    const setRefs = (el: HTMLVideoElement | null) => {
      (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    };

    const filter = `brightness(${brightness}) contrast(${contrast})`;

    return (
      <div className="relative aspect-video overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 w-full h-full">
        <video
          ref={setRefs}
          autoPlay
          playsInline
          muted
          className="absolute w-full h-full object-cover pointer-events-none"
          style={{ transform: "scaleX(-1)", visibility: "hidden" }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: "scaleX(-1)", filter, WebkitFilter: filter }}
        />
      </div>
    );
  }
);
