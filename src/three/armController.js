// Kinematics + state for the interactive robot arm.
// Geometry matches blender/build_models.py (three.js units, y up).
const SHOULDER_Y = 0.94 // J1 (0.44) + J2 offset (0.5)
const L1 = 1.05 // J2 -> J3
const L2 = 0.82 // J3 -> J4
const L3 = 0.4 // J4 -> grip point between the fingers
export const GRIP_LOCAL_Y = 0.21 // grip point in J5's local frame
export const CUBE = 0.12
export const PAD_A = [0.86, 0, 0.86]
export const PAD_B = [-0.86, 0, 0.86]

export const JOINTS = [
  { key: 'j1', min: -180, max: 180 },
  { key: 'j2', min: -20, max: 85 },
  { key: 'j3', min: 0, max: 140 },
  { key: 'j4', min: -30, max: 125 },
  { key: 'j5', min: -180, max: 180 },
]
const KEYS = ['j1', 'j2', 'j3', 'j4', 'j5']

const D2R = Math.PI / 180
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** Inverse kinematics: gripper pointing straight down with its grip point at (x, y, z). */
export function ik(x, y, z) {
  const yaw = Math.atan2(x, z)
  const r = Math.hypot(x, z)
  const wy = y + L3 - SHOULDER_Y
  const D = Math.min(Math.hypot(r, wy), L1 + L2 - 1e-3)
  const t3 = Math.acos(clamp((D * D - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1))
  const a1 = Math.atan2(r, wy) - Math.atan2(L2 * Math.sin(t3), L1 + L2 * Math.cos(t3))
  return { j1: yaw, j2: a1, j3: t3, j4: Math.PI - a1 - t3, j5: 0 }
}

const HOME = { j1: 0, j2: 0.25, j3: 1.0, j4: 1.2, j5: 0, grip: 1 }

function pickPlace(from, to) {
  const g = CUBE / 2
  const at = (p, h, twist = 0) => ({ ...ik(p[0], h, p[2]), j5: twist })
  return [
    { pose: at(from, 0.55), grip: 1, dur: 1.2 },
    { pose: at(from, g), dur: 0.9 },
    { grip: 0, dur: 0.55 },
    { pose: at(from, 0.6), dur: 0.9 },
    { pose: at(to, 0.6, Math.PI / 2), dur: 1.4 },
    { pose: at(to, g + 0.005, Math.PI / 2), dur: 0.9 },
    { grip: 1, dur: 0.5 },
    { pose: at(to, 0.55, Math.PI / 2), dur: 0.8 },
  ]
}

export function createArm({ auto = true } = {}) {
  const arm = {
    current: { ...HOME },
    target: { ...HOME },
    mode: auto ? 'auto' : 'manual',
    holding: false,
    cubeHome: PAD_A,
    // commands consumed by the 3D component
    resetCube: false,
    _steps: [],
    _i: 0,
    _t: 0,
    _from: null,
    _dir: true,
    listeners: new Set(),

    subscribe(fn) {
      arm.listeners.add(fn)
      return () => arm.listeners.delete(fn)
    },
    emit() {
      arm.listeners.forEach((f) => f())
    },

    /** Manual joint control (values in degrees). */
    setJoint(key, deg) {
      if (arm.mode !== 'manual') arm.toManual()
      arm.target[key] = deg * D2R
      arm.emit()
    },
    toggleGrip() {
      if (arm.mode !== 'manual') arm.toManual()
      arm.target.grip = arm.target.grip > 0.5 ? 0 : 1
      arm.emit()
    },
    toManual() {
      arm.mode = 'manual'
      arm.target = { ...arm.current, grip: arm.current.grip > 0.5 ? 1 : 0 }
      arm.emit()
    },
    startAuto() {
      arm.mode = 'auto'
      arm.resetCube = true
      arm._dir = true
      arm._load()
      arm.emit()
    },
    reset() {
      arm.mode = 'manual'
      arm.target = { ...HOME }
      arm.resetCube = true
      arm.emit()
    },
    _load() {
      arm._steps = arm._dir ? pickPlace(PAD_A, PAD_B) : pickPlace(PAD_B, PAD_A)
      arm._i = 0
      arm._t = 0
      arm._from = { ...arm.current }
    },

    /** Advance joint values. Called every frame. */
    update(dt) {
      const c = arm.current
      if (arm.mode === 'auto') {
        if (!arm._steps.length) arm._load()
        const step = arm._steps[arm._i]
        arm._t += dt
        const k = ease(clamp(arm._t / step.dur, 0, 1))
        if (step.pose) for (const j of KEYS) c[j] = arm._from[j] + (step.pose[j] - arm._from[j]) * k
        if (step.grip !== undefined) c.grip = arm._from.grip + (step.grip - arm._from.grip) * k
        if (arm._t >= step.dur) {
          arm._i++
          arm._t = 0
          arm._from = { ...c }
          if (arm._i >= arm._steps.length) {
            arm._dir = !arm._dir
            arm._load()
          }
        }
      } else {
        const f = 1 - Math.exp(-dt * 5)
        for (const j of [...KEYS, 'grip']) c[j] += (arm.target[j] - c[j]) * f
      }
    },
  }
  return arm
}

export const toDeg = (r) => Math.round(r / D2R)
