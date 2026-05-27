"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

type PointerRef = React.RefObject<{ x: number; y: number }>;

const KNOBS: [number, number, number][] = [
  [-120, 44, 112],
  [-88, 44, 122],
  [120, 44, 112],
  [88, 44, 122],
  [132, 44, 44],
  [132, 44, -6],
];

const BASE_OMEGA = (12 * Math.PI * 2) / 60; // 12 rpm, in rad/s
const MAX_TILT = THREE.MathUtils.degToRad(8);

/**
 * Stylized Pioneer-style CDJ built from primitives. Platter spins at 12rpm;
 * the whole unit tilts toward the pointer; when `active`, it scales up, nudges
 * forward, and the platter briefly doubles speed (a "wake up" moment).
 */
export function CDJModel({
  active,
  pointer,
}: {
  active: boolean;
  pointer: PointerRef;
}) {
  const group = useRef<THREE.Group>(null!);
  const platter = useRef<THREE.Mesh>(null!);
  const screenMat = useRef<THREE.MeshStandardMaterial>(null!);
  const wakeUntil = useRef(0);
  const prevActive = useRef(false);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const d = Math.min(delta, 0.05); // clamp on tab refocus

    // Rising edge of `active` triggers a 1.5s wake-up
    if (active && !prevActive.current) wakeUntil.current = t + 1.5;
    prevActive.current = active;
    const waking = t < wakeUntil.current;

    if (platter.current) {
      platter.current.rotation.y += BASE_OMEGA * (waking ? 2 : 1) * d;
    }

    if (group.current) {
      const targetRX = (pointer.current?.y ?? 0) * MAX_TILT;
      const targetRY = (pointer.current?.x ?? 0) * MAX_TILT;
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetRX, 0.05);
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetRY, 0.05);

      const targetScale = active ? 1.05 : 1;
      const s = THREE.MathUtils.lerp(group.current.scale.x, targetScale, 0.08);
      group.current.scale.setScalar(s);

      const targetZ = active ? 0.25 : 0;
      group.current.position.z = THREE.MathUtils.lerp(group.current.position.z, targetZ, 0.06);
    }

    if (screenMat.current) {
      screenMat.current.emissiveIntensity = 0.45 + Math.sin(t * 1.6) * 0.12;
    }
  });

  return (
    <group ref={group}>
      <group scale={0.01}>
        {/* body */}
        <RoundedBox args={[280, 80, 280]} radius={14} smoothness={4}>
          <meshStandardMaterial color="#2a2a2a" metalness={0.55} roughness={0.5} />
        </RoundedBox>

        {/* platter */}
        <mesh ref={platter} position={[0, 44, 0]}>
          <cylinderGeometry args={[100, 100, 8, 72]} />
          <meshStandardMaterial color="#4a4a4a" metalness={0.95} roughness={0.22} />
        </mesh>

        {/* record */}
        <mesh position={[0, 48.6, 0]}>
          <cylinderGeometry args={[96, 96, 1.2, 72]} />
          <meshStandardMaterial color="#0d0d0d" metalness={0.2} roughness={0.75} />
        </mesh>

        {/* record label */}
        <mesh position={[0, 49.4, 0]}>
          <cylinderGeometry args={[28, 28, 0.6, 48]} />
          <meshStandardMaterial
            color="#06281d"
            emissive="#3ddc97"
            emissiveIntensity={0.25}
            metalness={0.1}
            roughness={0.6}
          />
        </mesh>

        {/* spindle */}
        <mesh position={[0, 50, 0]}>
          <cylinderGeometry args={[6, 6, 14, 24]} />
          <meshStandardMaterial
            color="#3ddc97"
            emissive="#3ddc97"
            emissiveIntensity={0.5}
            metalness={0.3}
            roughness={0.4}
          />
        </mesh>

        {/* deck display — bezel, glowing screen, readout bars */}
        <group position={[0, 60, -70]} rotation={[-0.62, 0, 0]}>
          <mesh position={[0, 0, -0.6]}>
            <planeGeometry args={[84, 50]} />
            <meshStandardMaterial
              color="#0a0a0a"
              metalness={0.4}
              roughness={0.6}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh>
            <planeGeometry args={[72, 40]} />
            <meshStandardMaterial
              ref={screenMat}
              color="#04140e"
              emissive="#3ddc97"
              emissiveIntensity={0.45}
              roughness={0.35}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[-12, 9, 0.4]}>
            <planeGeometry args={[40, 3]} />
            <meshStandardMaterial color="#3ddc97" emissive="#3ddc97" emissiveIntensity={1.1} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[-18, 1, 0.4]}>
            <planeGeometry args={[28, 2]} />
            <meshStandardMaterial color="#3ddc97" emissive="#3ddc97" emissiveIntensity={0.7} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[-21, -7, 0.4]}>
            <planeGeometry args={[22, 2]} />
            <meshStandardMaterial color="#3ddc97" emissive="#3ddc97" emissiveIntensity={0.5} side={THREE.DoubleSide} />
          </mesh>
        </group>

        {/* knobs */}
        {KNOBS.map((p, i) => (
          <mesh key={i} position={p}>
            <cylinderGeometry args={[7, 7, 10, 20]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.4} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
