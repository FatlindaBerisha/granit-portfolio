import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import alFlag from 'flag-icons/flags/4x3/al.svg'
import deFlag from 'flag-icons/flags/4x3/de.svg'

const FLAGS = { al: alFlag, sq: alFlag, de: deFlag }

export function Flag({ code, className = '', title }) {
  return <img src={FLAGS[code]} alt={title || code} title={title} className={`flag ${className}`} width="22" height="16" />
}

const LANGS = [
  { code: 'sq', label: 'SQ', name: 'Shqip' },
  { code: 'de', label: 'DE', name: 'Deutsch' },
]

/** Language dropdown with flags. */
export function LangDropdown({ lang, setLang }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const cur = LANGS.find((l) => l.code === lang)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`lang-dd ${open ? 'open' : ''}`} ref={ref}>
      <button className="lang-dd-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label="Language / Gjuha / Sprache">
        <Flag code={cur.code} title={cur.name} />
        <span className="lang-dd-name">{cur.name}</span>
        <span className="lang-dd-code mono">{cur.label}</span>
        <ChevronDown size={15} className="lang-dd-chev" />
      </button>
      <ul className="lang-dd-menu" role="listbox">
        {LANGS.map((l) => (
          <li key={l.code}>
            <button
              role="option"
              aria-selected={lang === l.code}
              className={lang === l.code ? 'active' : ''}
              onClick={() => {
                setLang(l.code)
                setOpen(false)
              }}
            >
              <Flag code={l.code} title={l.name} />
              <span>{l.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Logo (brand image or lucide icon) for a tool. */
export function ToolLogo({ tool, size = 22 }) {
  if (tool.img) return <img src={tool.img} alt="" width={size} height={size} className="tool-logo" />
  const I = tool.Icon
  return I ? <I size={size} className="tool-icon" /> : null
}

/** Types and deletes a rotating list of words. */
export function Typewriter({ words }) {
  const [i, setI] = useState(0)
  const [text, setText] = useState('')
  const [del, setDel] = useState(false)

  useEffect(() => {
    setText('')
    setDel(false)
    setI(0)
  }, [words])

  useEffect(() => {
    const word = words[i % words.length]
    let ms = del ? 40 : 85
    if (!del && text === word) ms = 1600
    if (del && text === '') ms = 250
    const id = setTimeout(() => {
      if (!del && text === word) setDel(true)
      else if (del && text === '') {
        setDel(false)
        setI((n) => n + 1)
      } else setText(del ? word.slice(0, text.length - 1) : word.slice(0, text.length + 1))
    }, ms)
    return () => clearTimeout(id)
  }, [text, del, i, words])

  return (
    <span className="typewriter">
      {text}
      <span className="caret" />
    </span>
  )
}

/** Counts up the leading number of a value like "2+" when it scrolls into view. */
export function Counter({ value }) {
  const m = /^(\d+)(.*)$/.exec(value)
  const ref = useRef(null)
  const [n, setN] = useState(m ? 0 : null)
  useEffect(() => {
    if (!m || !ref.current) return
    const target = Number(m[1])
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const t0 = performance.now()
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / 1200)
        setN(Math.round(target * (1 - Math.pow(1 - k, 3))))
        if (k < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    io.observe(ref.current)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return <strong ref={ref}>{m ? `${n}${m[2]}` : value}</strong>
}

export function Marquee({ items }) {
  const row = [...items, ...items]
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {row.map((it, k) => (
          <span key={k} className="marquee-item">
            <span className="marquee-logo"><ToolLogo tool={it} size={24} /></span>
            {it.name}
          </span>
        ))}
      </div>
    </div>
  )
}

export function SectionHead({ kicker, title, subtitle }) {
  return (
    <div className="section-head reveal">
      <span className="kicker mono">
        <span className="kicker-line" /> {kicker}
      </span>
      <h2>{title}</h2>
      {subtitle && <p className="muted">{subtitle}</p>}
    </div>
  )
}

/** Sets --mx/--my on `.spot` elements for the cursor spotlight effect. */
export function useSpotlight() {
  useEffect(() => {
    const onMove = (e) => {
      const el = e.target.closest?.('.spot')
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${e.clientX - r.left}px`)
      el.style.setProperty('--my', `${e.clientY - r.top}px`)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])
}

export function useScrollProgress() {
  const [p, setP] = useState(0)
  useEffect(() => {
    const on = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight
      setP(h > 0 ? window.scrollY / h : 0)
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
    }
  }, [])
  return p
}

/** External link that falls back to same-tab navigation when a new tab is blocked. */
export function ExternalLink({ href, children, ...props }) {
  const onClick = (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    const w = window.open(href, '_blank')
    if (w) w.opener = null
    else window.location.href = href
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} {...props}>
      {children}
    </a>
  )
}

/** "GK" monogram: white G + K whose upper arm is an orange robot-arm segment with a joint. */
export function LogoMark({ size = 36 }) {
  return (
    <svg className="logo-svg" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="gk-tile" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c1c20" />
          <stop offset="1" stopColor="#0c0c0e" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="47" height="47" rx="12.5" fill="url(#gk-tile)" stroke="#2c2c31" />
      <g fill="none" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23.2 17.4A8.6 8.6 0 1 0 25.6 24h-6" stroke="#fafafa" />
        <path d="M30.4 15.4v17.2M32.8 24.4l5.4 8.2" stroke="#fafafa" />
        <path d="M30.6 25l7.6-9.6" stroke="#ff6a13" />
      </g>
      <circle cx="30.5" cy="25" r="2.8" fill="#ff6a13" />
      <circle cx="30.5" cy="25" r="1.1" fill="#0c0c0e" />
    </svg>
  )
}

export function Logo({ role }) {
  return (
    <span className="brand">
      <LogoMark />
      <span className="brand-text">
        <span className="brand-name">Granit Kurrumeli</span>
        {role && <span className="brand-role mono">{role}</span>}
      </span>
    </span>
  )
}
