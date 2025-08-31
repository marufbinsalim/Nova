import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Physics, RigidBody } from "@react-three/rapier";

export default function App() {
  return (
    <Canvas camera={{ position: [6, 6, 6], fov: 50 }}>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />

      {/* Controls */}
      <OrbitControls />

      {/* Physics world */}
      <Physics gravity={[0, -9.81, 0]}>
        {/* Falling cube */}
        <RigidBody>
          <mesh position={[0, 5, 0]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="royalblue" />
          </mesh>
        </RigidBody>

        {/* Ground plane */}
        <RigidBody type="fixed" colliders="cuboid">
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color="lightgreen" />
          </mesh>
        </RigidBody>
      </Physics>
    </Canvas>
  );
}
