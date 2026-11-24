import { useEffect, useState } from 'react'
import { Hand, HandGrab, Play, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { JOINTS, toDeg } from '../three/armController.js'

/** Polls the arm controller so React can show live joint values. */
export function useArmReadout(arm, ms = 90) {
  const read = () => ({
    mode: arm.mode,
    holding: arm.holding,
    cur: { ...arm.current },
    tgt: { ...arm.target },
  })
  const [s, setS] = useState(read)
  useEffect(() => {
    const id = setInterval(() => setS(read()), ms)
    const off = arm.subscribe(() => setS(read()))
    return () => {
      clearInterval(id)
      off()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arm, ms])
  return s
}

/** Small technical readout over the hero canvas: the 6 servos of the arm. */
export function RobotHud({ arm, label }) {
  const s = useArmReadout(arm, 120)
  return (
    <div className="hud-panel mono" aria-hidden="true">
      <div className="hud-title"><span className="live-dot" /> {label}</div>
      {JOINTS.map((j, i) => (
        <div key={j.key} className="hud-row">
          <span>S{i + 1}</span>
          <span>{String(toDeg(s.cur[j.key])).padStart(4, ' ')}°</span>
        </div>
      ))}
      <div className="hud-row">
        <span>S6</span>
        <span className={s.holding ? 'ok' : ''}>{s.holding ? 'LOAD' : s.cur.grip > 0.5 ? 'OPEN' : 'CLOSE'}</span>
      </div>
    </div>
  )
}

/** Interactive control panel: 5 joint servos + 1 gripper servo. */
export function RobotPanel({ arm, t }) {
  const s = useArmReadout(arm)
  const manual = s.mode === 'manual'
  const src = manual ? s.tgt : s.cur
  const closed = manual ? s.tgt.grip < 0.5 : s.cur.grip < 0.5

  return (
    <div className="robot-panel">
      <div className="rp-head">
        <span className="rp-title">
          <SlidersHorizontal size={16} /> {t.title}
          <span className="rp-badge mono">6 SERVO</span>
        </span>
        <div className="seg">
          <button className={!manual ? 'on' : ''} onClick={() => arm.startAuto()}>
            <Play size={14} /> {t.auto}
          </button>
          <button className={manual ? 'on' : ''} onClick={() => arm.toManual()}>
            <Hand size={14} /> {t.manual}
          </button>
        </div>
      </div>

      <div className="rp-sliders">
        {JOINTS.map((j, i) => {
          const val = toDeg(src[j.key])
          return (
            <label key={j.key} className="rp-slider">
              <span className="rp-label">
                <span><b className="mono">S{i + 1}</b> {t.joints[j.key]}</span>
                <span className="mono">{val}°</span>
              </span>
              <input
                type="range"
                min={j.min}
                max={j.max}
                step={1}
                value={Math.max(j.min, Math.min(j.max, val))}
                onChange={(e) => arm.setJoint(j.key, Number(e.target.value))}
                style={{ '--p': `${((val - j.min) / (j.max - j.min)) * 100}%` }}
              />
            </label>
          )
        })}
        <div className="rp-slider rp-grip">
          <span className="rp-label">
            <span><b className="mono">S6</b> {t.joints.grip}</span>
            <span className={`mono ${s.holding ? 'ok' : ''}`}>{s.holding ? t.holding : closed ? t.closed : t.open}</span>
          </span>
          <button className={`btn grip ${closed ? 'closed' : ''}`} onClick={() => arm.toggleGrip()}>
            {closed ? <Hand size={17} /> : <HandGrab size={17} />} {closed ? t.release : t.grip}
          </button>
        </div>
      </div>

      <div className="rp-foot">
        <p className="rp-hint">{t.hint}</p>
        <button className="btn ghost sm" onClick={() => arm.reset()}>
          <RotateCcw size={16} /> {t.reset}
        </button>
      </div>
    </div>
  )
}
