import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { CUBE, GRIP_LOCAL_Y, PAD_A, PAD_B } from './armController.js'

const URLS = {
  robot: '/models/robot_arm.glb',
  city: '/models/smart_city.glb',
  atm: '/models/atm.glb',
}

function useModel(url) {
  const { scene } = useGLTF(url)
  const root = useMemo(() => scene.clone(true), [scene])
  useEffect(() => {
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
  }, [root])
  return root
}

/* ------------------------------------------------------------ robot arm */
const _tip = new THREE.Vector3()
const _cube = new THREE.Vector3()

function restHeight(x, z) {
  const r = Math.hypot(x, z)
  if (r < 0.42) return 0.44 + CUBE / 2
  if (r < 0.6) return 0.1 + CUBE / 2
  return CUBE / 2
}

export function RobotArm({ arm, ...props }) {
  const root = useModel(URLS.robot)

  const rig = useMemo(() => {
    const g = (n) => root.getObjectByName(n)
    // workpiece the gripper can pick up (idempotent: StrictMode may run this twice)
    let cube = root.getObjectByName('Workpiece')
    if (!cube) {
      cube = new THREE.Mesh(
        new THREE.BoxGeometry(CUBE, CUBE, CUBE),
        new THREE.MeshStandardMaterial({ color: '#f4f4f5', metalness: 0.3, roughness: 0.3 }),
      )
      cube.name = 'Workpiece'
      cube.castShadow = true
      cube.position.set(PAD_A[0], CUBE / 2, PAD_A[2])
      root.add(cube)
      // target pads on the floor
      const padMat = new THREE.MeshBasicMaterial({ color: '#ff6a13', transparent: true, opacity: 0.7 })
      for (const p of [PAD_A, PAD_B]) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.12, 48), padMat)
        ring.rotation.x = -Math.PI / 2
        ring.position.set(p[0], 0.003, p[2])
        root.add(ring)
      }
    }
    return { j1: g('J1'), j2: g('J2'), j3: g('J3'), j4: g('J4'), j5: g('J5'), fl: g('FingerL'), fr: g('FingerR'), cube, vy: 0 }
  }, [root])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    arm.update(dt)
    const c = arm.current
    const { j1, j2, j3, j4, j5, fl, fr, cube } = rig
    if (!j1) return
    j1.rotation.y = c.j1
    j2.rotation.x = c.j2
    j3.rotation.x = c.j3
    j4.rotation.x = c.j4
    if (j5) j5.rotation.y = c.j5

    if (arm.resetCube) {
      arm.resetCube = false
      if (arm.holding) {
        root.attach(cube)
        arm.holding = false
      }
      cube.position.set(PAD_A[0], CUBE / 2, PAD_A[2])
      cube.rotation.set(0, 0, 0)
      rig.vy = 0
    }

    // grab / release
    _tip.set(0, GRIP_LOCAL_Y, 0)
    j5.localToWorld(_tip)
    cube.getWorldPosition(_cube)
    if (!arm.holding && c.grip < 0.35 && _tip.distanceTo(_cube) < 0.14) {
      j5.attach(cube)
      cube.position.set(0, GRIP_LOCAL_Y, 0)
      cube.rotation.set(0, 0, 0)
      arm.holding = true
      arm.emit()
    } else if (arm.holding && c.grip > 0.5) {
      root.attach(cube)
      const yaw = Math.atan2(cube.position.x, cube.position.z)
      cube.rotation.set(0, yaw, 0)
      rig.vy = 0
      arm.holding = false
      arm.emit()
    }

    // gravity for a released cube
    if (!arm.holding) {
      const floor = restHeight(cube.position.x, cube.position.z)
      if (cube.position.y > floor + 1e-4) {
        rig.vy -= 9.8 * dt
        cube.position.y = Math.max(floor, cube.position.y + rig.vy * dt)
        if (cube.position.y === floor) rig.vy = 0
      } else {
        cube.position.y = floor
      }
    }

    // fingers: 0.07 closed, 0.13 open, stop on the cube faces when holding
    let fx = 0.07 + c.grip * 0.06
    if (arm.holding) fx = Math.max(fx, CUBE / 2 + 0.032)
    fl.position.x = -fx
    fr.position.x = fx
  })

  return <primitive object={root} {...props} />
}

/* ------------------------------------------------------------ smart city */
const CAR_PATHS = [
  { axis: 'x', road: 0.95, dir: 1, speed: 0.55, offset: 0 },
  { axis: 'x', road: -0.95, dir: -1, speed: 0.5, offset: 2.1 },
  { axis: 'z', road: 0.95, dir: 1, speed: 0.6, offset: 1.2 },
  { axis: 'z', road: -0.95, dir: -1, speed: 0.45, offset: 3.4 },
  { axis: 'x', road: -0.95, dir: 1, speed: 0.4, offset: 4.2 },
  { axis: 'z', road: 0.95, dir: -1, speed: 0.52, offset: 0.4 },
]
const LANE = 0.09
const SPAN = 2.85
const BELT = { from: -0.6, to: 0.6 } // conveyor, zone-local x
const PIPE = { from: 0.12, to: -0.48 } // outgoing pipe, zone-local z (Blender y is three -z)

export function SmartCity(props) {
  const root = useModel(URLS.city)
  const parts = useMemo(() => {
    const g = (n) => root.getObjectByName(n)
    const glass = [g('TankGlass0'), g('TankGlass1')].filter(Boolean)
    glass.forEach((m) => {
      m.material = m.material.clone()
      Object.assign(m.material, { transparent: true, opacity: 0.22, depthWrite: false, metalness: 0, roughness: 0.05 })
      m.castShadow = false
      m.renderOrder = 2
    })
    const laser = g('Laser0')
    if (laser) laser.material = laser.material.clone()
    const prox = g('Sensor1Light')
    if (prox) prox.material = prox.material.clone()
    return {
      rotors: [0, 1, 2].map((i) => g(`Rotor${i}`)).filter(Boolean),
      cars: CAR_PATHS.map((_, i) => g(`Car${i}`)),
      beacon: g('Beacon'),
      items: [0, 1, 2, 3].map((i) => g(`Item${i}`)).filter(Boolean),
      servos: [g('ServoArm0'), g('ServoArm1')].filter(Boolean),
      water: [g('Water0'), g('Water1')].filter(Boolean),
      flow: [0, 1, 2, 3].map((i) => g(`Flow${i}`)).filter(Boolean),
      pump: g('PumpRotor'),
      laser,
      prox,
    }
  }, [root])

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime()
    parts.rotors.forEach((r, i) => (r.rotation.z += dt * (2.2 + i * 0.4)))
    if (parts.beacon) {
      parts.beacon.rotation.y = t * 0.9
      parts.beacon.position.y = 1.0 + Math.sin(t * 2) * 0.03
    }
    parts.cars.forEach((car, i) => {
      if (!car) return
      const p = CAR_PATHS[i]
      const d = ((t * p.speed + p.offset) % (SPAN * 2)) - SPAN
      const pos = d * p.dir
      if (p.axis === 'x') {
        car.position.set(pos, 0.02, p.road + LANE * p.dir)
        car.rotation.set(0, p.dir > 0 ? 0 : Math.PI, 0)
      } else {
        car.position.set(p.road - LANE * p.dir, 0.02, pos)
        car.rotation.set(0, p.dir > 0 ? -Math.PI / 2 : Math.PI / 2, 0)
      }
    })

    // production line: parcels ride the belt, sensors react, servos push
    const len = BELT.to - BELT.from
    let beamHit = false
    let proxHit = false
    parts.items.forEach((it, i) => {
      const x = BELT.from + ((t * 0.18 + i * (len / parts.items.length)) % len)
      it.position.x = x
      if (Math.abs(x + 0.25) < 0.05) beamHit = true
      if (Math.abs(x - 0.1) < 0.05) proxHit = true
    })
    if (parts.laser) parts.laser.material.emissiveIntensity = beamHit ? 0.5 : 8
    if (parts.prox) parts.prox.material.emissiveIntensity = proxHit ? 12 : 1.5
    parts.servos.forEach((s, i) => {
      s.rotation.y = Math.sin(t * 2.4 + i * 1.6) * 0.6
    })

    // water: tanks alternately fill and drain, pump spins, flow dots travel
    parts.water.forEach((w, i) => {
      w.scale.set(1, 0.55 + Math.sin(t * 0.5 + i * Math.PI) * 0.35, 1)
    })
    if (parts.pump) parts.pump.rotation.z += dt * 10
    parts.flow.forEach((f, i) => {
      const k = (t * 0.35 + i / parts.flow.length) % 1
      f.position.z = PIPE.from + (PIPE.to - PIPE.from) * k
    })
  })

  return <primitive object={root} {...props} />
}

/* ------------------------------------------------------------ ATM */
export function Atm(props) {
  const root = useModel(URLS.atm)
  const mats = useMemo(() => {
    const pick = (n) => {
      const o = root.getObjectByName(n)
      if (!o || !o.material) return null
      o.material = o.material.clone()
      return o.material
    }
    return { screen: pick('Screen'), cash: pick('CashLight'), card: pick('CardLight') }
  }, [root])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (mats.screen) mats.screen.emissiveIntensity = 0.9 + Math.sin(t * 1.5) * 0.25
    if (mats.card) mats.card.emissiveIntensity = Math.sin(t * 5) > 0 ? 6 : 0.4
    if (mats.cash) mats.cash.emissiveIntensity = 2.5 + Math.sin(t * 3) * 2.5
  })

  return <primitive object={root} {...props} />
}

Object.values(URLS).forEach((u) => useGLTF.preload(u))
