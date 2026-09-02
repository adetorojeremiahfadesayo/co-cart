import { Float, RoundedBox, Torus } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";

type Palette = { green: string; deep: string; dark: string; paper: string; line: string };

function readPalette(): Palette {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string) => styles.getPropertyValue(name).trim();
  return {
    green: token("--canvas-green"), deep: token("--canvas-green-deep"), dark: token("--canvas-green-dark"),
    paper: token("--canvas-paper"), line: token("--canvas-line"),
  };
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function BagBody({ palette }: { palette: Palette }) {
  return <group>
    <RoundedBox args={[2.2, 2.6, 1.2]} radius={0.18} smoothness={8} position={[0, -0.4, 0]}><meshStandardMaterial color={palette.deep} roughness={0.35} metalness={0.05} /></RoundedBox>
    <RoundedBox args={[2, 0.35, 1]} radius={0.12} smoothness={8} position={[0, 0.95, 0]}><meshStandardMaterial color={palette.dark} roughness={0.5} /></RoundedBox>
    <Torus args={[0.75, 0.09, 16, 64, Math.PI]} position={[0, 1.15, 0]}><meshStandardMaterial color={palette.green} roughness={0.3} metalness={0.2} /></Torus>
    <mesh position={[0, -0.4, 0.61]}><circleGeometry args={[0.42, 48]} /><meshStandardMaterial color={palette.paper} roughness={0.6} /></mesh>
    <mesh position={[0, -0.4, 0.62]}><circleGeometry args={[0.24, 48]} /><meshStandardMaterial color={palette.green} roughness={0.4} /></mesh>
  </group>;
}

function OrbitingBits({ palette, reduced }: { palette: Palette; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => { if (!reduced && group.current) group.current.rotation.y = state.clock.elapsedTime * 0.25; });
  const bits: [number, number, number, string, number][] = [
    [2.6, 0.6, 0, palette.green, 0.22], [-2.4, -0.8, 0.6, palette.line, 0.3],
    [1.8, -1.6, -0.8, palette.deep, 0.16], [-2, 1.4, -0.4, palette.dark, 0.14], [0.4, 2.2, 0.8, palette.line, 0.18],
  ];
  return <group ref={group}>{bits.map(([x, y, z, color, radius], index) =>
    <Float key={index} speed={reduced ? 0 : 2.2} rotationIntensity={reduced ? 0 : 0.6} floatIntensity={reduced ? 0 : 1.4}>
      <mesh position={[x, y, z]}><icosahedronGeometry args={[radius, 1]} /><meshStandardMaterial color={color} roughness={0.4} metalness={0.15} /></mesh>
    </Float>)}</group>;
}

function ParallaxRig({ reduced, children }: { reduced: boolean; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (reduced || !ref.current) return;
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, state.pointer.x * 0.35, 0.06);
    ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, -state.pointer.y * 0.2, 0.06);
  });
  return <group ref={ref}>{children}</group>;
}

function StaticBag() { return <div className="hero-bag-fallback" aria-hidden><span>Co</span></div>; }

export default function Hero3D() {
  const reduced = useReducedMotion();
  const palette = readPalette();
  return <div className="hero-3d" aria-hidden="true">
    <Canvas camera={{ position: [0, 0.4, 7], fov: 42 }} dpr={reduced ? 1 : [1, 1.6]} fallback={<StaticBag />} gl={{ antialias: !reduced, powerPreference: "high-performance" }}>
      <ambientLight intensity={0.85} /><directionalLight position={[4, 6, 5]} intensity={1.4} /><pointLight position={[-5, -2, 3]} intensity={12} color={palette.green} />
      <ParallaxRig reduced={reduced}>
        <Float speed={reduced ? 0 : 1.6} rotationIntensity={reduced ? 0 : 0.35} floatIntensity={reduced ? 0 : 0.9}><BagBody palette={palette} /></Float>
        <OrbitingBits palette={palette} reduced={reduced} />
      </ParallaxRig>
    </Canvas>
  </div>;
}
