"use client";

// ─────────────────────────────────────────────────────────────────
// WebGL animated background — a subtle multi-color gradient blob
// rendered on a fullscreen quad via a fragment shader. Runs in an
// absolutely-positioned canvas behind the hero.
//
// Design goals:
//   • Read as "premium, calm, moving" — not "flashy, distracting"
//   • ~1-3ms per frame budget so it doesn't tank scrolling FPS
//   • Respect prefers-reduced-motion (fall back to static gradient)
//   • Auto-pause when out of view (via IntersectionObserver on the
//     containing DOM node) so we don't burn GPU on the whole page
//   • Match the brand's warm/accent palette (#c14a2a base)
//
// Uses @react-three/fiber to avoid hand-writing WebGL init boilerplate.
// The shader itself is standard smoothstep-based blob field with UV-
// scrolled noise for the "living" motion.
// ─────────────────────────────────────────────────────────────────

import { useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

  // Cheap 2D hash for a small amount of noise.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(41.13, 289.7))) * 45758.5453);
  }

  // Value noise built on the hash — smooth interpolation between corners.
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // fBM — layered noise for organic blob motion.
  float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += amp * noise(p);
      p *= 2.02;
      amp *= 0.5;
    }
    return sum;
  }

  void main() {
    vec2 uv = vUv;
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 p = (uv - 0.5) * aspect;

    // Two blob centers drift slowly around the frame.
    vec2 c1 = vec2(sin(uTime * 0.12) * 0.35, cos(uTime * 0.09) * 0.25);
    vec2 c2 = vec2(cos(uTime * 0.15 + 1.3) * 0.30, sin(uTime * 0.11 + 2.1) * 0.20);

    // Warp the domain with fbm so each blob has organic edges.
    float warp = fbm(p * 2.0 + uTime * 0.05) * 0.35;
    p += warp;

    // Signed-distance-ish falloff for each blob.
    float d1 = 1.0 - smoothstep(0.0, 0.55, length(p - c1));
    float d2 = 1.0 - smoothstep(0.0, 0.55, length(p - c2));

    // Brand palette — warm accent + violet accent blended by blob weights.
    vec3 accentA = vec3(0.756, 0.290, 0.165); // #c14a2a (dmoop accent)
    vec3 accentB = vec3(0.545, 0.361, 0.965); // #8b5cf7 violet
    vec3 base    = vec3(0.988, 0.972, 0.949); // #fcf8f2 warm cream

    vec3 col = base;
    col = mix(col, accentA, d1 * 0.55);
    col = mix(col, accentB, d2 * 0.40);

    // Very subtle vignette so the edges feel soft.
    float vignette = 1.0 - smoothstep(0.6, 1.2, length(p));
    col *= vignette * 0.4 + 0.7;

    // Grain — tiny bit to avoid banding on gradients.
    float grain = (hash(vUv * 800.0 + uTime) - 0.5) * 0.02;
    col += grain;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

function ShaderPlane({ paused }: { paused: boolean }) {
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  useFrame((state) => {
    if (paused || !materialRef.current) return;
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uResolution.value.set(
      state.size.width,
      state.size.height
    );
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        fragmentShader={FRAG}
        vertexShader={VERT}
        uniforms={{
          uTime: { value: 0 },
          uResolution: { value: new THREE.Vector2(1, 1) },
        }}
      />
    </mesh>
  );
}

export function WebGLBackground({ className = "" }: { className?: string }) {
  const [enabled, setEnabled] = useState(true);
  const [inView, setInView] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Respect prefers-reduced-motion.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setEnabled(!mq.matches);
    const handler = (e: MediaQueryListEvent) => setEnabled(!e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Auto-pause the shader when the container is off-screen.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => setInView(entries[0]?.isIntersecting ?? false),
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!enabled) {
    // Static fallback so users with reduced-motion still get atmosphere.
    return (
      <div
        className={"absolute inset-0 pointer-events-none " + className}
        style={{
          background:
            "radial-gradient(ellipse at 30% 30%, rgba(193,74,42,0.20) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(139,92,247,0.15) 0%, transparent 60%), var(--dmoop-bg-app)",
        }}
      />
    );
  }

  return (
    <div ref={containerRef} className={"absolute inset-0 pointer-events-none " + className}>
      <Canvas
        gl={{ antialias: false, alpha: false, powerPreference: "low-power" }}
        dpr={[1, 1.5]}
        frameloop={inView ? "always" : "never"}
      >
        <ShaderPlane paused={!inView} />
      </Canvas>
    </div>
  );
}
