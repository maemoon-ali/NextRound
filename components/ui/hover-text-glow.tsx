"use client";

import * as React from "react";
import { motion } from "motion/react";

export const HoverTextGlow = ({
  text = "Hover Me",
  duration = 0.25,
  className = "",
}: {
  text?: string;
  duration?: number;
  className?: string;
}) => {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [coords, setCoords] = React.useState({ x: 0, y: 0 });
  const [hover,  setHover]  = React.useState(false);
  const [mask,   setMask]   = React.useState({ cx: "50%", cy: "50%" });

  React.useEffect(() => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const cx = ((coords.x - rect.left) / rect.width)  * 100;
    const cy = ((coords.y - rect.top)  / rect.height) * 100;
    setMask({ cx: `${cx}%`, cy: `${cy}%` });
  }, [coords]);

  return (
    <div className={`relative flex w-full items-center justify-center overflow-hidden select-none ${className}`}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox="0 0 300 100"
        xmlns="http://www.w3.org/2000/svg"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onMouseMove={e => setCoords({ x: e.clientX, y: e.clientY })}
      >
        <defs>
          {/* Gradient shown on hover */}
          <linearGradient id="tlTextGradient" gradientUnits="userSpaceOnUse">
            {hover ? (
              <>
                <stop offset="0%"   stopColor="hsl(252, 80%, 82%)" />
                <stop offset="33%"  stopColor="hsl(280, 78%, 84%)" />
                <stop offset="66%"  stopColor="hsl(310, 74%, 84%)" />
                <stop offset="100%" stopColor="hsl(340, 80%, 84%)" />
              </>
            ) : (
              <stop offset="0%" stopColor="white" />
            )}
          </linearGradient>

          {/* Radial mask that follows the cursor */}
          <motion.radialGradient
            id="tlRevealMask"
            gradientUnits="userSpaceOnUse"
            r="25%"
            animate={mask}
            transition={{ duration, ease: "easeOut" }}
          >
            <stop offset="0%"   stopColor="white" />
            <stop offset="100%" stopColor="black" />
          </motion.radialGradient>

          <mask id="tlTextMask">
            <rect width="100%" height="100%" fill="url(#tlRevealMask)" />
          </mask>
        </defs>

        {/* Outline text — draws itself on mount */}
        <motion.text
          x="50%"
          y="52%"
          textAnchor="middle"
          dominantBaseline="middle"
          strokeWidth="1.2"
          className="fill-transparent font-bold"
          style={{ fontFamily: "Helvetica, Arial, sans-serif", fontSize: "4rem", fontWeight: 800, stroke: "rgba(255,255,255,0.55)" }}
          initial={{ strokeDashoffset: 1000, strokeDasharray: 1000 }}
          animate={{ strokeDashoffset: 0,    strokeDasharray: 1000 }}
          transition={{ duration: 3, ease: "easeInOut" }}
        >
          {text}
        </motion.text>

        {/* Gradient reveal text — masked to cursor position */}
        <text
          x="50%"
          y="52%"
          textAnchor="middle"
          dominantBaseline="middle"
          stroke="url(#tlTextGradient)"
          strokeWidth="1.2"
          mask="url(#tlTextMask)"
          className="fill-transparent font-bold"
          style={{
            fontFamily: "Helvetica, Arial, sans-serif",
            fontSize: "4rem",
            fontWeight: 800,
            opacity: hover ? 1 : 0.75,
            transition: "opacity 0.3s ease",
          }}
        >
          {text}
        </text>
      </svg>
    </div>
  );
};

export default HoverTextGlow;
