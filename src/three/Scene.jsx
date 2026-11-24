import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { RobotArm, SmartCity, Atm } from './Models.jsx'
import { createArm } from './armController.js'

const PRESETS = {
  robot: { Model: RobotArm, camera: [3.4, 2.5, 4.1], target: [0, 0.95, 0.2], minD: 2.8, maxD: 8 },
  city: { Model: SmartCity, camera: [6.1, 5.2, 6.7], target: [0, 0.3, 0], minD: 3, maxD: 13 },
  atm: { Model: Atm, camera: [-2.3, 1.7, 3.3], target: [0, 0.9, 0], minD: 2, maxD: 6 },
}

// label anchor points (three.js coordinates of the model)
const HOTSPOTS = {
  city: [
    { k: 'line', p: [1.95, 0.78, 1.55] },
    { k: 'servo', p: [2.25, 0.3, 2.31] },
    { k: 'sensor', p: [1.7, 0.33, 2.15] },
    { k: 'water', p: [-1.95, 1.0, 2.07] },
    { k: 'energy', p: [2.7, 1.3, -2.7] },
    { k: 'hub', p: [0, 1.55, 0] },
  ],
  atm: [
    { k: 'camera', p: [0, 1.56, 0.49] },
    { k: 'screen', p: [0.12, 1.36, 0.39] },
    { k: 'card', p: [-0.22, 1.15, 0.5] },
    { k: 'keypad', p: [0.17, 0.97, 0.56] },
    { k: 'cash', p: [0.1, 0.78, 0.39] },
    { k: 'safe', p: [0.2, 0.42, 0.37] },
  ],
}

/** Pulls the camera back on narrow (portrait) canvases so the model always fits. */
function FitCamera({ base, target }) {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const k = aspect < 1.1 ? Math.min(1.9, 1.05 / aspect + 0.02) : 1
    camera.position.set(
      target[0] + (base[0] - target[0]) * k,
      target[1] + (base[1] - target[1]) * k,
      target[2] + (base[2] - target[2]) * k,
    )
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height, base, target])
  return null
}

const _v = new THREE.Vector3()

/** Projects label anchors to screen space each frame and moves the DOM labels (outside the canvas). */
function LabelProjector({ list, els }) {
  useFrame(({ camera, size }) => {
    list.forEach((h, i) => {
      const el = els.current[i]
      if (!el) return
      _v.set(h.p[0], h.p[1], h.p[2]).project(camera)
      const x = ((_v.x + 1) / 2) * size.width
      const y = ((1 - _v.y) / 2) * size.height
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      el.style.opacity = _v.z < 1 ? '1' : '0'
    })
  })
  return null
}

export default function Scene({ model = 'robot', arm, labels, autoRotate = true, zoom = true }) {
  const p = PRESETS[model]
  const { Model } = p
  const fallbackArm = useMemo(() => (model === 'robot' && !arm ? createArm({ auto: true }) : null), [model, arm])
  const list = labels ? (HOTSPOTS[model] || []).filter((h) => labels[h.k]) : []
  const els = useRef([])

  return (
    <>
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: p.camera, fov: 38, near: 0.1, far: 100 }} gl={{ antialias: true, alpha: true }}>
      <FitCamera base={p.camera} target={p.target} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[4, 7, 3]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
      />
      <pointLight position={[-3, 2, -2]} intensity={8} color="#ffffff" />
      <pointLight position={[3, 1.5, 2]} intensity={5} color="#ff8a45" />
      <Suspense fallback={null}>
        {model === 'robot' ? <Model arm={arm || fallbackArm} /> : <Model />}
        <LabelProjector list={list} els={els} />
        <Environment resolution={128}>
          <Lightformer form="rect" intensity={2} position={[0, 5, -5]} scale={[10, 3, 1]} />
          <Lightformer form="rect" intensity={1.0} color="#ffffff" position={[-5, 2, 0]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
          <Lightformer form="rect" intensity={1.2} color="#ff6a13" position={[5, 2, 0]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
          <Lightformer form="ring" intensity={1.5} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={4} />
        </Environment>
      </Suspense>
      <ContactShadows position={[0, -0.001, 0]} opacity={0.55} scale={model === 'city' ? 10 : 5} blur={2.4} far={3} />
      <OrbitControls
        target={p.target}
        enablePan={false}
        enableZoom={zoom}
        minDistance={p.minD}
        maxDistance={p.maxD * 1.9}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.05}
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
        enableDamping
      />
    </Canvas>
    {list.length > 0 && (
      <div className="labels" aria-hidden="true">
        {list.map((h, i) => (
          <div key={h.k} className="hs" ref={(el) => (els.current[i] = el)}>
            <div className="hotspot">
              <span className="hs-dot" />
              <span className="hs-text">{labels[h.k]}</span>
            </div>
          </div>
        ))}
      </div>
    )}
    </>
  )
}
