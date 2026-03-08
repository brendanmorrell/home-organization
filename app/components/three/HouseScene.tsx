import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Text,
  Billboard,
  Html,
  PerspectiveCamera,
  Grid,
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

// ---- Wall placement helpers ----

type WallSide = "north" | "south" | "east" | "west";

function getWallPosition(
  wallSide: WallSide,
  index: number,
  total: number,
  roomWidth: number,
  roomDepth: number,
  roomHeight: number
): [number, number, number] {
  const spacing = 0.8;
  const yBase = -roomHeight / 2 + 0.4;
  const row = Math.floor(index / 4);
  const col = index % 4;
  const y = yBase + row * spacing;

  switch (wallSide) {
    case "north":
      return [
        -roomWidth / 2 + 0.5 + col * (roomWidth - 1) / Math.max(3, total - 1),
        y,
        -roomDepth / 2 + 0.15,
      ];
    case "south":
      return [
        -roomWidth / 2 + 0.5 + col * (roomWidth - 1) / Math.max(3, total - 1),
        y,
        roomDepth / 2 - 0.15,
      ];
    case "east":
      return [
        roomWidth / 2 - 0.15,
        y,
        -roomDepth / 2 + 0.5 + col * (roomDepth - 1) / Math.max(3, total - 1),
      ];
    case "west":
      return [
        -roomWidth / 2 + 0.15,
        y,
        -roomDepth / 2 + 0.5 + col * (roomDepth - 1) / Math.max(3, total - 1),
      ];
  }
}

const WALLS: WallSide[] = ["north", "east", "south", "west"];

// ---- Room Box ----

function RoomBox({
  room,
  isHighlighted,
  highlightedItemIds,
  isActive,
  onClick,
}: {
  room: RoomWithFrames;
  isHighlighted: boolean;
  highlightedItemIds: Set<string>;
  isActive: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const color = useMemo(() => {
    if (isHighlighted) return "#ffb74d";
    if (isActive) return "#6c8cff";
    if (hovered) return "#4a5a8a";
    return room.color;
  }, [isHighlighted, isActive, hovered, room.color]);

  const itemCount = room.frames.reduce((sum, f) => sum + f.items.length, 0);

  // Pulsing glow on highlighted rooms
  useFrame(({ clock }) => {
    if (glowRef.current) {
      if (isHighlighted) {
        const pulse = Math.sin(clock.getElapsedTime() * 3) * 0.15 + 0.35;
        (glowRef.current.material as THREE.MeshStandardMaterial).opacity = pulse;
        glowRef.current.visible = true;
      } else {
        glowRef.current.visible = false;
      }
    }
  });

  // Flatten all items across frames, preserving frame context
  const allItems = useMemo(() => {
    const items: { item: typeof room.frames[0]["items"][0]; frameIndex: number }[] = [];
    room.frames.forEach((frame, fi) => {
      frame.items.forEach((item) => {
        items.push({ item, frameIndex: fi });
      });
    });
    return items;
  }, [room.frames]);

  return (
    <group position={[room.pos_x, room.pos_y, room.pos_z]}>
      {/* Room walls — transparent box */}
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
          opacity={isHighlighted ? 0.25 : isActive ? 0.2 : 0.08}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Outer glow for highlighted rooms */}
      <mesh ref={glowRef} visible={false}>
        <boxGeometry
          args={[room.width + 0.3, room.height + 0.3, room.depth + 0.3]}
        />
        <meshStandardMaterial
          color="#ffb74d"
          transparent
          opacity={0.3}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Wireframe edges */}
      <lineSegments>
        <edgesGeometry
          args={[new THREE.BoxGeometry(room.width, room.height, room.depth)]}
        />
        <lineBasicMaterial
          color={color}
          transparent
          opacity={isHighlighted ? 0.9 : isActive ? 0.7 : 0.4}
        />
      </lineSegments>

      {/* Floor with subtle pattern */}
      <mesh
        position={[0, -room.height / 2 + 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[room.width - 0.1, room.depth - 0.1]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Billboard label — always faces camera */}
      <Billboard position={[0, room.height / 2 + 0.5, 0]}>
        <Text
          fontSize={0.4}
          color={isHighlighted ? "#ffb74d" : "#e4e6f0"}
          anchorX="center"
          anchorY="bottom"
          font={undefined}
          outlineWidth={0.02}
          outlineColor="#0f1117"
        >
          {room.name}
        </Text>
        <Text
          position={[0, -0.15, 0]}
          fontSize={0.2}
          color="#8b8fa3"
          anchorX="center"
          anchorY="top"
          font={undefined}
        >
          {itemCount} items
        </Text>
      </Billboard>

      {/* Item pins distributed along walls */}
      {allItems.map(({ item, frameIndex }, i) => {
        const wall = WALLS[i % WALLS.length];
        const wallItems = allItems.filter(
          (_, idx) => idx % WALLS.length === i % WALLS.length
        );
        const indexOnWall = wallItems.indexOf(allItems[i]);

        const pos =
          item.pin_x != null && item.pin_y != null && item.pin_z != null
            ? ([item.pin_x, item.pin_y, item.pin_z] as [number, number, number])
            : getWallPosition(
                wall,
                indexOnWall,
                wallItems.length,
                room.width,
                room.depth,
                room.height
              );

        return (
          <ItemPin
            key={item.id}
            position={pos}
            name={item.name}
            location={item.location}
            isHighlighted={highlightedItemIds.has(item.id)}
            isRoomHighlighted={isHighlighted}
          />
        );
      })}
    </group>
  );
}

// ---- Item Pin ----

function ItemPin({
  position,
  name,
  location,
  isHighlighted,
  isRoomHighlighted,
}: {
  position: [number, number, number];
  name: string;
  location: string;
  isHighlighted: boolean;
  isRoomHighlighted: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      if (isHighlighted) {
        // Bounce animation for matched items
        const bounce = Math.abs(Math.sin(clock.getElapsedTime() * 4)) * 0.15;
        meshRef.current.position.y = bounce;
        meshRef.current.scale.setScalar(1.8);
      } else {
        meshRef.current.position.y = 0;
        meshRef.current.scale.setScalar(hovered ? 1.3 : 1);
      }
    }
    if (glowRef.current) {
      glowRef.current.intensity = isHighlighted
        ? 0.5 + Math.sin(clock.getElapsedTime() * 5) * 0.3
        : 0;
    }
  });

  const pinColor = isHighlighted
    ? "#ff9800"
    : isRoomHighlighted
    ? "#ffb74d"
    : "#6c8cff";

  return (
    <group position={position}>
      {/* Glow light for highlighted pins */}
      <pointLight
        ref={glowRef}
        color="#ff9800"
        intensity={0}
        distance={1.5}
      />

      {/* Pin head */}
      <mesh
        ref={meshRef}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial
          color={pinColor}
          emissive={pinColor}
          emissiveIntensity={isHighlighted ? 1 : 0.3}
        />
      </mesh>

      {/* Pin stem */}
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.16, 8]} />
        <meshStandardMaterial color="#8b8fa3" transparent opacity={0.6} />
      </mesh>

      {/* Tooltip on hover or when highlighted */}
      {(hovered || isHighlighted) && (
        <Html
          position={[0, 0.25, 0]}
          center
          style={{ pointerEvents: "none", whiteSpace: "nowrap" }}
          zIndexRange={[100, 0]}
        >
          <div
            style={{
              background: isHighlighted
                ? "rgba(255, 152, 0, 0.95)"
                : "rgba(26, 29, 39, 0.95)",
              border: `1px solid ${isHighlighted ? "#ff9800" : "#2e3345"}`,
              borderRadius: "6px",
              padding: "5px 9px",
              fontSize: "11px",
              color: isHighlighted ? "#fff" : "#e4e6f0",
              backdropFilter: "blur(8px)",
              boxShadow: isHighlighted
                ? "0 0 12px rgba(255, 152, 0, 0.4)"
                : "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ fontWeight: 600 }}>{name}</div>
            <div
              style={{
                color: isHighlighted ? "rgba(255,255,255,0.8)" : "#8b8fa3",
                marginTop: 1,
                fontSize: 10,
              }}
            >
              {location}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ---- Connection lines between rooms ----

function RoomConnections({ rooms }: { rooms: RoomWithFrames[] }) {
  if (rooms.length < 2) return null;

  const points = useMemo(() => {
    const lines: THREE.Vector3[][] = [];
    for (let i = 0; i < rooms.length - 1; i++) {
      const a = rooms[i];
      const b = rooms[i + 1];
      lines.push([
        new THREE.Vector3(a.pos_x, -1.4, a.pos_z),
        new THREE.Vector3(b.pos_x, -1.4, b.pos_z),
      ]);
    }
    return lines;
  }, [rooms]);

  return (
    <>
      {points.map((pair, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array([
                  pair[0].x, pair[0].y, pair[0].z,
                  pair[1].x, pair[1].y, pair[1].z,
                ]),
                3,
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#2e3345" transparent opacity={0.4} />
        </line>
      ))}
    </>
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

  const highlightedItemIds = useMemo(
    () => new Set(searchResults.map((r) => r.item_id)),
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
        room.height * 1.8,
        room.pos_z + room.depth * 1.5,
      ],
      lookAt: [room.pos_x, 0, room.pos_z],
    });
  }, [flyToRoom, rooms]);

  const handleRoomClick = useCallback(
    (roomId: string) => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return;

      setCameraTarget({
        position: [
          room.pos_x + room.width * 1.2,
          room.height * 1.5,
          room.pos_z + room.depth * 1.2,
        ],
        lookAt: [room.pos_x, 0, room.pos_z],
      });

      onRoomClick?.(roomId);
    },
    [rooms, onRoomClick]
  );

  return (
    <Canvas shadows>
      <PerspectiveCamera makeDefault position={[15, 12, 15]} fov={45} />
      <CameraController target={cameraTarget} onArrived={onFlyComplete} />

      {/* Atmosphere */}
      <fog attach="fog" args={["#0f1117", 25, 55]} />
      <color attach="background" args={["#0f1117"]} />

      {/* Lighting */}
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={0.5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[-8, 10, -8]} intensity={0.2} color="#6c8cff" />
      <pointLight position={[8, 6, -4]} intensity={0.15} color="#4a5a8a" />

      {/* Ground grid */}
      <Grid
        position={[0, -1.5, 0]}
        args={[60, 60]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1a1d27"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#2e3345"
        fadeDistance={40}
        fadeStrength={1}
        infiniteGrid
      />

      {/* Room connection lines */}
      <RoomConnections rooms={rooms} />

      {/* Room boxes */}
      {rooms.map((room) => (
        <RoomBox
          key={room.id}
          room={room}
          isHighlighted={highlightedRoomIds.has(room.id)}
          highlightedItemIds={highlightedItemIds}
          isActive={activeRoomId === room.id}
          onClick={() => handleRoomClick(room.id)}
        />
      ))}
    </Canvas>
  );
}
