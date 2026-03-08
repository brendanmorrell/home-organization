import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Text,
  Html,
  PerspectiveCamera,
} from "@react-three/drei";
import * as THREE from "three";
import type { RoomWithFrames, SearchResult } from "~/lib/supabase";

// ---- Camera Controller (handles fly-to animations) ----

interface CameraTarget {
  position: [number, number, number];
  lookAt: [number, number, number];
}

function CameraController({
  target,
  onArrived,
}: {
  target: CameraTarget | null;
  onArrived?: () => void;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const progressRef = useRef(0);
  const startPos = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());
  const arrivedRef = useRef(false);

  useEffect(() => {
    if (target) {
      startPos.current.copy(camera.position);
      if (controlsRef.current) {
        startTarget.current.copy(controlsRef.current.target);
      }
      progressRef.current = 0;
      arrivedRef.current = false;
    }
  }, [target, camera]);

  useFrame((_, delta) => {
    if (!target || arrivedRef.current) return;

    progressRef.current = Math.min(progressRef.current + delta * 1.2, 1);
    const t = easeInOutCubic(progressRef.current);

    const targetPos = new THREE.Vector3(...target.position);
    const targetLookAt = new THREE.Vector3(...target.lookAt);

    camera.position.lerpVectors(startPos.current, targetPos, t);

    if (controlsRef.current) {
      controlsRef.current.target.lerpVectors(
        startTarget.current,
        targetLookAt,
        t
      );
      controlsRef.current.update();
    }

    if (progressRef.current >= 1 && !arrivedRef.current) {
      arrivedRef.current = true;
      onArrived?.();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.1}
      minDistance={2}
      maxDistance={40}
      maxPolarAngle={Math.PI / 1.5}
    />
  );
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---- Room Box ----

function RoomBox({
  room,
  isHighlighted,
  isActive,
  onClick,
}: {
  room: RoomWithFrames;
  isHighlighted: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const color = useMemo(() => {
    if (isHighlighted) return "#ffb74d";
    if (isActive) return "#6c8cff";
    if (hovered) return "#4a5a8a";
    return room.color;
  }, [isHighlighted, isActive, hovered, room.color]);

  const itemCount = room.frames.reduce(
    (sum, f) => sum + f.items.length,
    0
  );

  return (
    <group position={[room.pos_x, room.pos_y, room.pos_z]}>
      {/* Room walls (wireframe box) */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <boxGeometry args={[room.width, room.height, room.depth]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={isHighlighted ? 0.4 : isActive ? 0.3 : 0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Wireframe edges */}
      <lineSegments>
        <edgesGeometry
          args={[new THREE.BoxGeometry(room.width, room.height, room.depth)]}
        />
        <lineBasicMaterial color={color} transparent opacity={0.6} />
      </lineSegments>

      {/* Floor */}
      <mesh
        position={[0, -room.height / 2 + 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[room.width, room.depth]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Room label */}
      <Text
        position={[0, room.height / 2 + 0.3, 0]}
        fontSize={0.4}
        color={isHighlighted ? "#ffb74d" : "#e4e6f0"}
        anchorX="center"
        anchorY="bottom"
        font={undefined}
      >
        {room.name}
      </Text>
      <Text
        position={[0, room.height / 2 + 0.05, 0]}
        fontSize={0.2}
        color="#8b8fa3"
        anchorX="center"
        anchorY="bottom"
        font={undefined}
      >
        {itemCount} items
      </Text>

      {/* Item pins inside the room */}
      {room.frames.map((frame) =>
        frame.items.map((item, i) => {
          // Distribute items along the walls
          const angle =
            (i / Math.max(frame.items.length, 1)) * Math.PI * 2;
          const radius = Math.min(room.width, room.depth) * 0.35;
          const px = item.pin_x ?? Math.cos(angle) * radius;
          const py = item.pin_y ?? -room.height / 2 + 0.5 + (i % 3) * 0.6;
          const pz = item.pin_z ?? Math.sin(angle) * radius;

          return (
            <ItemPin
              key={item.id}
              position={[px, py, pz]}
              name={item.name}
              location={item.location}
              isHighlighted={isHighlighted}
            />
          );
        })
      )}
    </group>
  );
}

// ---- Item Pin ----

function ItemPin({
  position,
  name,
  location,
  isHighlighted,
}: {
  position: [number, number, number];
  name: string;
  location: string;
  isHighlighted: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current && isHighlighted) {
      meshRef.current.rotation.y += delta * 2;
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        scale={isHighlighted ? 1.5 : hovered ? 1.2 : 1}
      >
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color={isHighlighted ? "#ffb74d" : "#6c8cff"}
          emissive={isHighlighted ? "#ffb74d" : "#6c8cff"}
          emissiveIntensity={isHighlighted ? 0.8 : 0.3}
        />
      </mesh>

      {/* Pin stem */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.2, 8]} />
        <meshStandardMaterial color="#8b8fa3" />
      </mesh>

      {/* Tooltip on hover */}
      {hovered && (
        <Html
          position={[0, 0.3, 0]}
          center
          style={{
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          <div
            style={{
              background: "rgba(26, 29, 39, 0.95)",
              border: "1px solid #2e3345",
              borderRadius: "6px",
              padding: "6px 10px",
              fontSize: "11px",
              color: "#e4e6f0",
              backdropFilter: "blur(8px)",
            }}
          >
            <div style={{ fontWeight: 600 }}>{name}</div>
            <div style={{ color: "#8b8fa3", marginTop: 2 }}>
              {location}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ---- Ground plane ----

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial color="#0a0c12" />
    </mesh>
  );
}

// ---- Main Scene Component ----

export interface HouseSceneProps {
  rooms: RoomWithFrames[];
  searchResults?: SearchResult[];
  activeRoomId?: string | null;
  onRoomClick?: (roomId: string) => void;
  flyToRoom?: string | null;
  onFlyComplete?: () => void;
}

export default function HouseScene({
  rooms,
  searchResults = [],
  activeRoomId,
  onRoomClick,
  flyToRoom,
  onFlyComplete,
}: HouseSceneProps) {
  const highlightedRoomIds = useMemo(
    () => new Set(searchResults.map((r) => r.room_id)),
    [searchResults]
  );

  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null);

  // Fly to room when flyToRoom changes
  useEffect(() => {
    if (!flyToRoom) return;
    const room = rooms.find((r) => r.id === flyToRoom);
    if (!room) return;

    setCameraTarget({
      position: [
        room.pos_x + room.width * 1.5,
        room.pos_y + room.height * 2,
        room.pos_z + room.depth * 1.5,
      ],
      lookAt: [room.pos_x, room.pos_y, room.pos_z],
    });
  }, [flyToRoom, rooms]);

  const handleRoomClick = useCallback(
    (roomId: string) => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return;

      // Fly camera to the room
      setCameraTarget({
        position: [
          room.pos_x + room.width * 1.2,
          room.pos_y + room.height * 1.5,
          room.pos_z + room.depth * 1.2,
        ],
        lookAt: [room.pos_x, room.pos_y, room.pos_z],
      });

      onRoomClick?.(roomId);
    },
    [rooms, onRoomClick]
  );

  return (
    <Canvas>
      <PerspectiveCamera
        makeDefault
        position={[12, 10, 12]}
        fov={50}
      />
      <CameraController
        target={cameraTarget}
        onArrived={onFlyComplete}
      />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 15, 10]} intensity={0.6} />
      <pointLight position={[-5, 8, -5]} intensity={0.3} color="#6c8cff" />

      {/* Ground */}
      <Ground />

      {/* Room boxes */}
      {rooms.map((room) => (
        <RoomBox
          key={room.id}
          room={room}
          isHighlighted={highlightedRoomIds.has(room.id)}
          isActive={activeRoomId === room.id}
          onClick={() => handleRoomClick(room.id)}
        />
      ))}
    </Canvas>
  );
}
