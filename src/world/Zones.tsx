import { RoundedBox, Text } from '@react-three/drei';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useStore, type Spot } from '../store';
import { crateSkills, projects } from '../data/profile';
import { aboutArea, contactPads, palette, projectPadPositions, warehouse } from './layout';
import { BODY_FONT, DISPLAY_FONT, GroundText, Sensor, Signboard } from './common';
import { ProjectProp } from './Props';
import { woodMap } from './textures';

const sameSpot = (a: Spot | null, b: Spot) => JSON.stringify(a) === JSON.stringify(b);

function useSpotHandlers(spot: Spot) {
  const setSpot = useStore((s) => s.setSpot);
  const clearSpotIf = useStore((s) => s.clearSpotIf);
  const active = useStore((s) => sameSpot(s.spot, spot));
  return {
    active,
    onEnter: () => setSpot(spot),
    onExit: () => clearSpotIf((s) => sameSpot(s, spot)),
  };
}

/** A round pad on the ground: drive onto it to open its card. */
function Pad({ x, z, color, radius = 2.6, active }: { x: number; z: number; color: string; radius?: number; active: boolean }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[radius, radius, 0.06, 48]} />
        <meshStandardMaterial color={active ? color : palette.cream} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.35, radius - 0.12, 48]} />
        <meshStandardMaterial color={active ? palette.cream : color} emissive={color} emissiveIntensity={active ? 0.5 : 0.15} />
      </mesh>
    </group>
  );
}

function ProjectSpot({ index }: { index: number }) {
  const p = projects[index];
  const [x, z] = projectPadPositions[index];
  const { active, onEnter, onExit } = useSpotHandlers({ kind: 'project', id: p.id });
  return (
    <group>
      <Pad x={x} z={z} color={p.color} active={active} />
      <group position={[x, 0, z]}>
        <ProjectProp kind={p.prop} color={p.color} />
      </group>
      <GroundText position={[x, z + 3.5]} size={0.72} color={palette.navy}>{p.name.toUpperCase()}</GroundText>
      <GroundText position={[x, z + 4.35]} size={0.36} color={palette.woodDark} font={BODY_FONT} maxWidth={8}>{p.tagline}</GroundText>
      {p.badge && <GroundText position={[x, z - 3.3]} size={0.36} color={p.color}>{p.badge.toUpperCase()}</GroundText>}
      <Sensor position={[x, 1, z]} size={[4.4, 2, 4.4]} onEnter={onEnter} onExit={onExit} />
    </group>
  );
}

export function ProjectsArea() {
  const cx = 26;
  return (
    <group>
      <GroundText position={[cx, -8.6]} size={1.6} color={palette.navy}>PROJECTS</GroundText>
      <GroundText position={[cx, -7]} size={0.42} color={palette.woodDark} font={BODY_FONT}>Park on a pad to open the project</GroundText>
      {projects.map((_, i) => <ProjectSpot key={i} index={i} />)}
    </group>
  );
}

/** Stack of knockable skill crates, a nod to my day job as a warehouse operator. */
export function Warehouse() {
  const { active, onEnter, onExit } = useSpotHandlers({ kind: 'skills' });
  const size = 1.1;
  const crates = crateSkills.map((label, i) => {
    const layer = Math.floor(i / 8);
    const inLayer = i % 8;
    const col = inLayer % 4;
    const row = Math.floor(inLayer / 4);
    return {
      label,
      pos: [warehouse.x - 1.7 + col * (size + 0.05), size / 2 + 0.16 + layer * (size + 0.02), warehouse.z - 1 + row * (size + 0.05)] as [number, number, number],
      color: [palette.wood, '#D39C66', '#B97D4E'][i % 3],
    };
  });
  return (
    <group>
      {/* concrete floor */}
      <mesh position={[warehouse.x, 0.02, warehouse.z]} receiveShadow>
        <boxGeometry args={[14, 0.04, 12]} />
        <meshStandardMaterial color={active ? '#D6CBB8' : '#E2D8C6'} />
      </mesh>
      {/* pallet */}
      <mesh position={[warehouse.x, 0.08, warehouse.z - 0.45]} receiveShadow castShadow>
        <boxGeometry args={[4.9, 0.14, 2.6]} />
        <meshStandardMaterial color={palette.woodDark} />
      </mesh>
      {/* back shelving */}
      <RigidBody type="fixed" colliders="cuboid" userData={{ material: 'metal' }}>
        <mesh position={[warehouse.x, 1.6, warehouse.z - 5.4]} castShadow receiveShadow>
          <boxGeometry args={[12, 3.2, 0.6]} />
          <meshStandardMaterial color={palette.navy} />
        </mesh>
      </RigidBody>
      {[0.8, 1.9, 2.9].map((y) => (
        <mesh key={y} position={[warehouse.x, y, warehouse.z - 5.05]}>
          <boxGeometry args={[12, 0.08, 0.2]} />
          <meshStandardMaterial color={palette.yellow} />
        </mesh>
      ))}
      <Text position={[warehouse.x, 2.4, warehouse.z - 5.08]} fontSize={0.7} color={palette.cream} font={DISPLAY_FONT} anchorX="center">WAREHOUSE</Text>
      {crates.map((c, i) => (
        <RigidBody key={i} position={c.pos} colliders={false} linearDamping={0.2} angularDamping={0.3} userData={{ material: 'wood' }}>
          <CuboidCollider args={[size / 2, size / 2, size / 2]} mass={0.3} friction={0.7} />
          <mesh castShadow receiveShadow>
            <boxGeometry args={[size, size, size]} />
            <meshStandardMaterial color={c.color} roughness={0.85} map={woodMap()} />
          </mesh>
          <Text position={[0, 0, size / 2 + 0.01]} fontSize={0.17} maxWidth={1} textAlign="center" color={palette.dark} font={DISPLAY_FONT} anchorX="center" anchorY="middle">{c.label}</Text>
          <Text position={[0, size / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.17} maxWidth={1} textAlign="center" color={palette.dark} font={DISPLAY_FONT} anchorX="center" anchorY="middle">{c.label}</Text>
        </RigidBody>
      ))}
      <GroundText position={[warehouse.x, warehouse.z + 7.6]} size={1.3}>SKILLS</GroundText>
      <GroundText position={[warehouse.x, warehouse.z + 8.9]} size={0.4} color={palette.woodDark} font={BODY_FONT} maxWidth={12}>Warehouse operator by day, developer by night. Knock the stack over.</GroundText>
      <Sensor position={[warehouse.x, 1, warehouse.z + 1]} size={[14, 2, 10]} onEnter={onEnter} onExit={onExit} />
    </group>
  );
}

/** Study corner: education and certifications. */
export function AboutArea() {
  const { active, onEnter, onExit } = useSpotHandlers({ kind: 'about' });
  const { x, z } = aboutArea;
  return (
    <group>
      <Pad x={x} z={z} color={palette.teal} radius={4} active={active} />
      <Signboard position={[x, 0, z - 6]} width={6} height={2.2} color={palette.navy}>
        <Text fontSize={0.62} color={palette.cream} font={DISPLAY_FONT} anchorX="center" position={[0, 0.35, 0]}>ABOUT ME</Text>
        <Text fontSize={0.26} color={palette.cream} font={BODY_FONT} anchorX="center" position={[0, -0.35, 0]} maxWidth={5.4} textAlign="center">Information Systems · Universitas Terbuka</Text>
      </Signboard>
      {/* graduation cap */}
      <group position={[x, 1.4, z]}>
        <mesh castShadow><cylinderGeometry args={[0.55, 0.6, 0.45, 20]} /><meshStandardMaterial color={palette.dark} /></mesh>
        <mesh castShadow position={[0, 0.28, 0]} rotation={[0, Math.PI / 4, 0]}><boxGeometry args={[1.7, 0.08, 1.7]} /><meshStandardMaterial color={palette.dark} /></mesh>
        <mesh position={[0.6, 0.05, 0.6]}><boxGeometry args={[0.05, 0.5, 0.05]} /><meshStandardMaterial color={palette.yellow} /></mesh>
      </group>
      {/* stack of books */}
      {[palette.coral, palette.teal, palette.yellow, palette.navy].map((c, i) => (
        <RigidBody key={i} position={[x - 6, 0.2 + i * 0.36, z - 1 + (i % 2) * 0.1]} colliders="cuboid" mass={0.2} userData={{ material: 'wood' }}>
          <mesh castShadow><boxGeometry args={[1.6, 0.34, 1.1]} /><meshStandardMaterial color={c} /></mesh>
        </RigidBody>
      ))}
      <GroundText position={[x, z + 5.4]} size={1.2}>ABOUT</GroundText>
      <GroundText position={[x, z + 6.6]} size={0.4} color={palette.woodDark} font={BODY_FONT}>Bootcamp 97.26 (A+) · AWS & Python certified</GroundText>
      <Sensor position={[x, 1, z]} size={[7, 2, 7]} onEnter={onEnter} onExit={onExit} />
    </group>
  );
}

const contactItems = [
  { id: 'github' as const, label: 'GITHUB', color: palette.dark },
  { id: 'linkedin' as const, label: 'LINKEDIN', color: '#2F6DB5' },
  { id: 'email' as const, label: 'EMAIL', color: palette.coral },
];

function ContactSpot({ index }: { index: number }) {
  const item = contactItems[index];
  const [x, z] = contactPads[index];
  const { active, onEnter, onExit } = useSpotHandlers({ kind: 'contact', id: item.id });
  return (
    <group>
      <Pad x={x} z={z} color={item.color} radius={2.4} active={active} />
      <Signboard position={[x, 0, z - 3.6]} width={3.4} height={1.1} color={item.color}>
        <Text fontSize={0.5} color={palette.cream} font={DISPLAY_FONT} anchorX="center" anchorY="middle">{item.label}</Text>
      </Signboard>
      <Sensor position={[x, 1, z]} size={[4, 2, 4]} onEnter={onEnter} onExit={onExit} />
    </group>
  );
}

export function ContactArea() {
  return (
    <group>
      <GroundText position={[26, 35.6]} size={1.3}>SAY HELLO</GroundText>
      <GroundText position={[26, 36.9]} size={0.4} color={palette.woodDark} font={BODY_FONT}>Open to junior software engineer roles</GroundText>
      {/* mailbox: rounded-top box on a post, with its flag up */}
      <group position={[38.5, 0, 26]}>
        <RigidBody type="fixed" colliders={false} userData={{ material: 'metal' }}>
          <CuboidCollider args={[0.32, 0.8, 0.46]} position={[0, 0.8, 0]} />
        </RigidBody>
        <RoundedBox args={[0.14, 1.2, 0.14]} radius={0.03} smoothness={2} position={[0, 0.6, 0]} castShadow><meshStandardMaterial color={palette.woodDark} map={woodMap()} /></RoundedBox>
        <RoundedBox args={[0.62, 0.34, 0.92]} radius={0.05} smoothness={2} position={[0, 1.3, 0]} castShadow><meshStandardMaterial color={palette.coral} roughness={0.45} metalness={0.2} /></RoundedBox>
        <mesh position={[0, 1.47, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.31, 0.31, 0.92, 20, 1, false, -Math.PI / 2, Math.PI]} />
          <meshStandardMaterial color={palette.coral} roughness={0.45} metalness={0.2} />
        </mesh>
        <mesh position={[0, 1.4, 0.465]}><circleGeometry args={[0.22, 20]} /><meshStandardMaterial color="#D9593F" /></mesh>
        <group position={[0.34, 1.4, 0.2]}>
          <RoundedBox args={[0.04, 0.46, 0.05]} radius={0.015} smoothness={2} position={[0, 0.2, 0]}><meshStandardMaterial color={palette.dark} /></RoundedBox>
          <RoundedBox args={[0.04, 0.14, 0.22]} radius={0.02} smoothness={2} position={[0, 0.37, 0.1]}><meshStandardMaterial color={palette.yellow} /></RoundedBox>
        </group>
      </group>
      {contactItems.map((_, i) => <ContactSpot key={i} index={i} />)}
    </group>
  );
}
