import { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Komponen partikel mengambang — berputar sangat pelan sebagai aksen latar.
 * Jumlah partikel sengaja dibuat sedikit agar tidak memberatkan mobile.
 */
function FloatingParticles({ count = 90 }) {
  const pointsRef = useRef()

  // Buat posisi & warna partikel sekali saja (useMemo)
  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      // Sebar partikel dalam ruang 3D
      pos[i * 3]     = (Math.random() - 0.5) * 12
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6

      // Warna indigo pucat (r,g,b dalam skala 0–1)
      col[i * 3]     = 0.45 + Math.random() * 0.15  // R
      col[i * 3 + 1] = 0.47 + Math.random() * 0.15  // G
      col[i * 3 + 2] = 0.92 + Math.random() * 0.08  // B
    }
    return [pos, col]
  }, [count])

  // Rotasi partikel — sangat lambat agar terasa ambient
  useFrame(({ clock }) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = clock.elapsedTime * 0.015
      pointsRef.current.rotation.x = clock.elapsedTime * 0.008
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        vertexColors
        transparent
        opacity={0.55}
        sizeAttenuation
      />
    </points>
  )
}

/**
 * Icosahedron wireframe — elemen 3D utama di sisi kanan hero.
 * Berputar sangat pelan agar terasa elegan, bukan ramai.
 */
function RotatingIcosahedron() {
  const meshRef = useRef()

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = clock.elapsedTime * 0.12
      meshRef.current.rotation.y = clock.elapsedTime * 0.08
    }
  })

  return (
    <mesh ref={meshRef} position={[3, 0, -1]}>
      <icosahedronGeometry args={[1.8, 1]} />
      <meshStandardMaterial
        color="#6366f1"
        wireframe
        transparent
        opacity={0.25}
      />
    </mesh>
  )
}

/**
 * ThreeCanvas — Canvas utama yang dibungkus posisi absolute.
 * pointer-events: none agar tidak memblok klik user ke elemen HTML di bawahnya.
 */
export default function ThreeCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 55 }}
      gl={{ antialias: true, alpha: true }}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={1.2} color="#6366f1" />
      <pointLight position={[-5, -3, 3]} intensity={0.3} color="#818cf8" />

      <Suspense fallback={null}>
        <FloatingParticles count={90} />
        <RotatingIcosahedron />
      </Suspense>
    </Canvas>
  )
}
