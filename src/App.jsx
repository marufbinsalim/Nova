import {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import { Physics, useBox, useCylinder, usePlane } from "@react-three/cannon";
import * as THREE from "three";

// Camera constants
export const CAMERA_CONSTANTS = {
  INITIAL_DISTANCE: 5,
  MIN_DISTANCE: 2,
  MAX_DISTANCE: 50,
  ZOOM_SPEED: 0.5,
  MOUSE_SENSITIVITY: 0.002,
  LERP_FACTOR: 0.1,
  MAX_PITCH: Math.PI / 2 - 0.1,
  MIN_PITCH: 0.1,
};

// -------------------- Camera Controller --------------------
function CameraController({ target }) {
  const { camera, gl } = useThree();
  const yawRef = useRef(Math.PI);
  const pitchRef = useRef(0.8);
  const distanceRef = useRef(CAMERA_CONSTANTS.INITIAL_DISTANCE);

  useEffect(() => {
    const canvas = gl.domElement;

    const onMouseDown = (e) => {
      if (e.button === 0 || e.button === 1) canvas.requestPointerLock();
    };
    const onMiddleMouseClick = (e) => {
      if (e.button !== 1) return;
      document.pointerLockElement === canvas
        ? document.exitPointerLock()
        : canvas.requestPointerLock();
    };
    const onMouseMove = (e) => {
      if (document.pointerLockElement !== canvas) return;
      yawRef.current -= e.movementX * CAMERA_CONSTANTS.MOUSE_SENSITIVITY;
      pitchRef.current -= e.movementY * CAMERA_CONSTANTS.MOUSE_SENSITIVITY;
      pitchRef.current = Math.max(
        CAMERA_CONSTANTS.MIN_PITCH,
        Math.min(CAMERA_CONSTANTS.MAX_PITCH, pitchRef.current)
      );
    };
    const onWheel = (e) => {
      e.preventDefault();
      distanceRef.current = Math.min(
        CAMERA_CONSTANTS.MAX_DISTANCE,
        Math.max(
          CAMERA_CONSTANTS.MIN_DISTANCE,
          distanceRef.current + e.deltaY * 0.01 * CAMERA_CONSTANTS.ZOOM_SPEED
        )
      );
    };

    canvas.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousedown", onMiddleMouseClick);
    document.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousedown", onMiddleMouseClick);
      document.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [gl]);

  useFrame(() => {
    if (!target || !target.length) return;

    const yaw = yawRef.current;
    const pitch = pitchRef.current;
    const distance = distanceRef.current;

    const x = target[0] + distance * Math.sin(pitch) * Math.sin(yaw);
    const y = target[1] + distance * Math.cos(pitch);
    const z = target[2] + distance * Math.sin(pitch) * Math.cos(yaw);

    camera.position.lerp(
      new THREE.Vector3(x, y, z),
      CAMERA_CONSTANTS.LERP_FACTOR
    );
    camera.lookAt(new THREE.Vector3(...target));
  });

  return null;
}

// -------------------- Player --------------------
const Player = forwardRef(({ position, onPositionChange }, ref) => {
  const { camera, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const velocity = useRef([0, 0, 0]);
  const [isGrounded, setIsGrounded] = useState(false);
  const raysRef = useRef([]); // Store debug lines

  const [boxRef, api] = useBox(() => ({
    mass: 1,
    position,
    rotation: [0, 0, 0],
    fixedRotation: true,
    args: [1, 1, 1],
  }));

  useImperativeHandle(ref, () => boxRef.current);

  useEffect(() => {
    // Sync velocity and position
    const unsubVelocity = api.velocity.subscribe((v) => (velocity.current = v));
    const unsubPosition = api.position.subscribe((p) => onPositionChange(p));

    return () => {
      unsubVelocity();
      unsubPosition();
    };
  }, [api, onPositionChange]);

  const checkGrounded = () => {
    if (!boxRef.current) return false;

    const origin = new THREE.Vector3();
    boxRef.current.getWorldPosition(origin);

    // Points around the base (center + 4 corners)
    const offsets = [
      new THREE.Vector3(0.5, 0, 0.5),
      new THREE.Vector3(-0.5, 0, 0.5),
      new THREE.Vector3(0.5, 0, -0.5),
      new THREE.Vector3(-0.5, 0, -0.5),
    ];

    // Clear old rays
    raysRef.current.forEach((line) => scene.remove(line));
    raysRef.current = [];

    let grounded = false;
    for (const offset of offsets) {
      const start = origin.clone().add(offset);
      const dir = new THREE.Vector3(0, -1, 0);
      raycaster.current.set(start, dir);

      const intersects = raycaster.current.intersectObjects(
        scene.children,
        true
      );

      // Visualize ray (1 unit length)
      const points = [start, start.clone().add(dir.clone().multiplyScalar(1))];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: "yellow" });
      const line = new THREE.Line(geometry, material);
      scene.add(line);
      raysRef.current.push(line);

      if (intersects.some((hit) => hit.distance <= 0.55)) {
        grounded = true;
      }
    }

    setIsGrounded(grounded);
  };

  useFrame((_, delta) => {
    checkGrounded();
    const speed = 20;
    const airControl = 0.2;
    const jumpStrength = 20;
    const gravity = -20;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    let [vx, vy, vz] = velocity.current;

    const moveDir = new THREE.Vector3();
    if (window.keys?.w) moveDir.add(forward);
    if (window.keys?.s) moveDir.sub(forward);
    if (window.keys?.d) moveDir.add(right);
    if (window.keys?.a) moveDir.sub(right);
    moveDir.normalize();

    if (isGrounded) {
      vx = moveDir.x * speed;
      vz = moveDir.z * speed;
      vy = window.keys?.[" "] ? jumpStrength : 0;
    } else {
      vx = THREE.MathUtils.lerp(vx, moveDir.x * speed, airControl * delta * 10);
      vz = THREE.MathUtils.lerp(vz, moveDir.z * speed, airControl * delta * 10);
      vy += gravity * delta;
    }

    api.velocity.set(vx, vy, vz);
  });

  return (
    <mesh ref={boxRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={isGrounded ? "green" : "red"} />
    </mesh>
  );
});

function Ground() {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
  }));

  return (
    <>
      {/* Physics plane (invisible) */}
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} name="Ground">
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial visible={false} />
      </mesh>

      {/* Visual grid */}
      <gridHelper args={[100, 100, "red", "red"]} position={[0, 0.01, 0]} />

      {/* Optional axes helper */}
      <axesHelper args={[3]} />
    </>
  );
}
// -------------------- Cube --------------------
function Cube({ position }) {
  const [ref] = useBox(() => ({
    mass: 0,
    args: [1, 1, 1], // match boxGeometry
    position,
  }));
  return (
    <mesh ref={ref} position={position}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="blue" />
    </mesh>
  );
}

// -------------------- Keyboard Input --------------------
window.keys = {};
window.addEventListener(
  "keydown",
  (e) => (window.keys[e.key.toLowerCase()] = true)
);
window.addEventListener(
  "keyup",
  (e) => (window.keys[e.key.toLowerCase()] = false)
);

// -------------------- Main App --------------------
export default function App() {
  const playerRef = useRef();
  const [playerPosition, setPlayerPosition] = useState([0, 20, 0]);

  return (
    <Canvas camera={{ position: [0, 5, 10], fov: 50 }}>
      <ambientLight />
      <Physics>
        <Cube position={[3, 0.5, 0]} />
        <Player
          ref={playerRef}
          position={playerPosition}
          onPositionChange={(pos) => setPlayerPosition(pos)}
        />
        <CameraController target={playerPosition} />
        <Ground />
      </Physics>
    </Canvas>
  );
}
