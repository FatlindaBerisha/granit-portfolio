import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight, ArrowUpRight, Award, BriefcaseBusiness, CalendarDays, Check, Code2, Copy, Cpu,
  Eye, EyeOff, Languages as LangIcon, Mail, MapPin, Menu, MousePointerClick, Phone, Rotate3d,
  Sparkles, Wrench, X, GraduationCap, Cog, ChevronRight, Boxes, ArrowUp,
} from 'lucide-react'
import { content, profile } from './i18n.js'
import { MARQUEE, SOFTWARE, autodeskLogo, blenderLogo } from './tools.js'
import LazyScene from './components/LazyScene.jsx'
import Icon, { LinkedinIcon } from './components/Icon.jsx'
import { Counter, ExternalLink, Flag, LangDropdown, Logo, Marquee, SectionHead, ToolLogo, Typewriter, useSpotlight } from './components/ui.jsx'
import { RobotPanel } from './components/robot.jsx'
import { createArm } from './three/armController.js'
import useReveal from './useReveal.js'
import Threads from './components/reactbits/Threads/Threads.jsx'
import BlurText from './components/reactbits/BlurText/BlurText.jsx'
import RotatingText from './components/reactbits/RotatingText/RotatingText.jsx'
import ShinyText from './components/reactbits/ShinyText/ShinyText.jsx'

const SECTIONS = ['about', 'experience', 'projects', 'skills', 'education', 'contact']

function getInitialLang() {
  try {
    const q = new URLSearchParams(window.location.search).get('lang')
    if (q === 'de' || q === 'sq') return q
    const s = localStorage.getItem('lang')
    if (s === 'de' || s === 'sq') return s
  } catch {
    /* storage unavailable */
  }
  return 'sq'
}

export default function App() {
  const [lang, setLang] = useState(getInitialLang)
  const t = content[lang]
  useReveal(lang)
  useSpotlight()

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = `Granit Kurrumeli · ${t.hero.role}`
    try {
      localStorage.setItem('lang', lang)
    } catch {
      /* ignore */
    }
  }, [lang, t])

  return (
    <>
      <div className="bg-grid" aria-hidden="true" />
      <div className="bg-noise" aria-hidden="true" />
      <Navbar t={t} lang={lang} setLang={setLang} />
      <main>
        <Hero t={t} />
        <About t={t} />
        <Experience t={t} />
        <Projects t={t} />
        <Skills t={t} />
        <Education t={t} />
        <Contact t={t} />
      </main>
      <footer className="footer">
        <div className="container">
          <div className="footer-top">
            <div className="footer-brand-col">
              <Logo role={t.hero.role} />
              <p className="muted">{t.footer.tagline}</p>
              <div className="socials">
                <ExternalLink href={profile.linkedin} aria-label="LinkedIn" className="icon-btn"><LinkedinIcon /></ExternalLink>
                <a href={`mailto:${profile.email}`} aria-label="Email" className="icon-btn"><Mail size={18} /></a>
                <a href={`tel:${profile.phoneHref}`} aria-label="Phone" className="icon-btn"><Phone size={18} /></a>
              </div>
            </div>
            <div className="footer-col">
              <h4 className="mono">{t.footer.navTitle}</h4>
              {SECTIONS.map((id) => <a key={id} href={`#${id}`}>{t.nav[id]}</a>)}
            </div>
            <div className="footer-col">
              <h4 className="mono">{t.footer.contactTitle}</h4>
              <a href={`mailto:${profile.email}`}>{profile.email}</a>
              <a href={`tel:${profile.phoneHref}`}>{profile.phone}</a>
              <ExternalLink href={profile.linkedin}>LinkedIn</ExternalLink>
              <span className="muted">{t.contact.locationValue}</span>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Granit Kurrumeli. {t.footer.rights}</span>
            <a href="#top" className="to-top">{t.footer.top} <ArrowUp size={14} /></a>
          </div>
        </div>
      </footer>
    </>
  )
}

/* ------------------------------------------------------------------ nav */
function Navbar({ t, lang, setLang }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [active, setActive] = useState('')

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12)
      let cur = ''
      for (const id of SECTIONS) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4) cur = id
      }
      setActive(cur)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
  }, [open])

  return (
    <>
      <header className={`nav ${scrolled || open ? 'scrolled' : ''}`}>
        <div className="nav-inner">
          <a href="#top" className="logo" onClick={() => setOpen(false)}>
            <Logo role={t.hero.role} />
          </a>
          <nav className="nav-links" aria-label="Main">
            {SECTIONS.map((id) => (
              <a key={id} href={`#${id}`} className={active === id ? 'active' : ''}>{t.nav[id]}</a>
            ))}
          </nav>
          <div className="nav-right">
            <LangDropdown lang={lang} setLang={setLang} />
            <button className="icon-btn menu-btn" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>
      <div className={`mobile-menu ${open ? 'open' : ''}`} aria-hidden={!open}>
        {SECTIONS.map((id, i) => (
          <a key={id} href={`#${id}`} onClick={() => setOpen(false)} style={{ transitionDelay: `${i * 40}ms` }}>
            <span className="mono">0{i + 1}</span> {t.nav[id]} <ChevronRight size={20} className="mm-arrow" />
          </a>
        ))}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ hero */
function Hero({ t }) {
  return (
    <section id="top" className="hero hero-v2">
      <div className="hero-bg" aria-hidden="true">
        <Threads color={[1, 0.42, 0.07]} accentColor={[1, 0.75, 0.55]} amplitude={1.1} distance={0.25} lineCount={70} speed={0.5} brightness={1.2} />
      </div>
      <div className="hero-vignette" aria-hidden="true" />
      <div className="container hero-center">
        <span className="badge">
          <span className="dot" />
          <ShinyText text={t.hero.badge} color="#a1a1aa" shineColor="#ffffff" speed={3} />
        </span>
        <p className="hello mono">{t.hero.hello}</p>
        <h1 className="hero-title" key={t.hero.hello}>
          <BlurText text="Granit Kurrumeli" animateBy="letters" delay={45} direction="top" className="hero-name" />
        </h1>
        <div className="hero-role">
          <span className="hero-role-main"><Cpu size={20} /> {t.hero.role}</span>
          <span className="hero-role-sep" />
          <RotatingText
            key={t.hero.focusLabel}
            texts={t.hero.words}
            highlight
            highlightColor="#ff6a13"
            mainClassName="hero-rotate"
            staggerDuration={0.02}
            splitBy="characters"
            rotationInterval={2400}
          />
        </div>
        <p className="tagline">{t.hero.tagline}</p>
        <div className="cta">
          <a href="#projects" className="btn primary">{t.hero.ctaProjects} <ArrowRight size={18} /></a>
          <a href="#contact" className="btn ghost"><Mail size={18} /> {t.hero.ctaContact}</a>
        </div>
        <div className="socials">
          <ExternalLink href={profile.linkedin} aria-label="LinkedIn" className="icon-btn"><LinkedinIcon /></ExternalLink>
          <a href={`mailto:${profile.email}`} aria-label="Email" className="icon-btn"><Mail size={18} /></a>
          <a href={`tel:${profile.phoneHref}`} aria-label="Phone" className="icon-btn"><Phone size={18} /></a>
          <span className="socials-line" />
          <span className="hero-loc mono small"><MapPin size={14} /> {t.hero.location}</span>
        </div>
      </div>
      <div className="container">
        <div className="stats">
          {t.hero.stats.map((s) => (
            <div key={s.label} className="stat spot">
              <Counter value={s.value} />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
      <Marquee items={MARQUEE.map((m) => ({ ...m, name: m.name || t.tools[m.key] }))} />
    </section>
  )
}

/* ------------------------------------------------------------------ about */
function About({ t }) {
  return (
    <section id="about" className="section container">
      <SectionHead kicker={t.about.kicker} title={t.about.title} />
      <div className="bento">
        <div className="card spot about-text reveal">
          <p className="lead">{t.about.text}</p>
          <div className="fact-row">
            {t.about.facts.map((f) => (
              <div key={f.label} className="fact">
                <span className="fact-icon"><Icon name={f.icon} size={18} /></span>
                <div>
                  <span className="muted small">{f.label}</span>
                  <strong>{f.value}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="focus-grid">
          {t.about.focus.map((f, i) => (
            <div key={f.title} className="card spot focus reveal" style={{ transitionDelay: `${i * 70}ms` }}>
              <span className="focus-icon"><Icon name={f.icon} size={22} /></span>
              <h3>{f.title}</h3>
              <p className="muted small">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ experience */
function Experience({ t }) {
  // the job card that has scrolled past ~55% of the viewport becomes active; the line fills down to it
  const ref = useRef(null)
  const [active, setActive] = useState(0)
  const [fill, setFill] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const el = ref.current
      if (!el) return
      const mid = window.innerHeight * 0.55
      let a = 0
      el.querySelectorAll('.tl-item').forEach((it, i) => {
        if (it.getBoundingClientRect().top < mid) a = i
      })
      setActive(a)
      const r = el.getBoundingClientRect()
      setFill(Math.max(0, Math.min(1, (mid - r.top) / r.height)))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <section id="experience" className="section container">
      <SectionHead kicker={t.experience.kicker} title={t.experience.title} />
      <div className="timeline" ref={ref}>
        <span className="tl-progress" style={{ transform: `scaleY(${fill})` }} aria-hidden="true" />
        {t.experience.jobs.map((job, i) => (
          <article key={job.company} className="tl-item reveal">
            <span className={`tl-dot ${i <= active ? 'active' : ''} ${i === active ? 'current' : ''}`} />
            <div className={`card spot job ${i === active ? 'is-active' : ''}`}>
              <div className="job-head">
                <span className="monogram">{job.icon ? <Icon name={job.icon} size={22} /> : job.company.slice(0, 2).toUpperCase()}</span>
                <div className="job-title">
                  <h3>{job.role}</h3>
                  <p className="company"><BriefcaseBusiness size={15} /> {job.company}</p>
                </div>
                <span className={`period mono ${job.current ? 'now' : ''}`}><CalendarDays size={14} /> {job.period}</span>
              </div>
              <p className="job-summary">{job.summary}</p>
              <ul className="job-list">
                {job.items.map((it) => (
                  <li key={it}><ChevronRight size={15} className="li-icon" /> {it}</li>
                ))}
              </ul>
              <div className="job-tags">
                {job.tags.map((tag) => <span key={tag} className="chip small-chip">{tag}</span>)}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ projects */
function Projects({ t }) {
  const P = t.projects
  const [active, setActive] = useState(0)
  const [labels, setLabels] = useState(true)
  const arm = useMemo(() => createArm({ auto: true }), [])
  const p = P.items[active]

  return (
    <section id="projects" className="section container">
      <SectionHead kicker={P.kicker} title={P.title} subtitle={P.subtitle} />

      <div className="tabs reveal" role="tablist">
        {P.items.map((it, i) => (
          <button
            key={it.id}
            role="tab"
            aria-selected={active === i}
            className={`tab spot ${active === i ? 'active' : ''}`}
            onClick={() => setActive(i)}
          >
            <span className="tab-num mono">0{i + 1}</span>
            <span className="tab-icon"><Icon name={it.icon} size={20} /></span>
            <span className="tab-text">
              <strong>{it.title}</strong>
              <span>{it.label}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="stage reveal">
        <div className="stage-left">
          <div className="viewer stage-viewer">
            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
            <LazyScene
              key={p.id}
              model={p.id}
              arm={p.id === 'robot' ? arm : undefined}
              labels={labels ? p.hotspots : undefined}
              autoRotate={p.id !== 'robot'}
            />
            <div className="viewer-tools">
              {p.hotspots && (
                <button className={`chip-btn ${labels ? 'on' : ''}`} onClick={() => setLabels((v) => !v)}>
                  {labels ? <Eye size={14} /> : <EyeOff size={14} />} {P.labelsToggle}
                </button>
              )}
              <span className="chip-btn ghost"><MousePointerClick size={14} /> 3D</span>
            </div>
          </div>
          {p.id === 'robot' && <RobotPanel arm={arm} t={P.panel} />}
        </div>

        <div className="stage-info" key={p.id}>
          <span className="project-label"><Icon name={p.icon} size={15} /> {p.label}</span>
          <h3>{p.title}</h3>
          <p className="muted">{p.text}</p>
          <ul className="points">
            {p.points.map((pt) => (
              <li key={pt}><span className="pt-check"><Check size={14} /></span> {pt}</li>
            ))}
          </ul>
          <div className="spec">
            <span className="spec-title mono"><Boxes size={14} /> {P.components}</span>
            <div className="spec-grid">
              {p.components.map((c) => <span key={c} className="spec-item">{c}</span>)}
            </div>
          </div>
          <div className="made-row">
            <div className="made-with">
              <span className="made-logo"><img src={autodeskLogo} alt="" width="16" height="16" /></span>
              <span><span className="muted small">{P.designedIn}</span> <strong>Autodesk Inventor</strong></span>
            </div>
            <div className="made-with">
              <span className="made-logo"><img src={blenderLogo} alt="" width="18" height="18" /></span>
              <span><span className="muted small">{P.visualizedIn}</span> <strong>Blender</strong></span>
            </div>
          </div>
        </div>
      </div>

      <div className="more-projects reveal">
        <p><strong>{P.moreTitle}</strong> {P.moreText}</p>
        <a href="#contact" className="btn ghost sm">{P.moreCta} <ArrowRight size={16} /></a>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ skills */
function Skills({ t }) {
  const s = t.skills
  const [main, ...rest] = SOFTWARE
  return (
    <section id="skills" className="section container">
      <SectionHead kicker={s.kicker} title={s.title} subtitle={s.subtitle} />
      <div className="sk-tools">
        <div className="card spot sk-main reveal">
          <span className="sk-badge mono">{s.primary}</span>
          <span className="sk-main-logo"><ToolLogo tool={main} size={40} /></span>
          <h3>{main.name}</h3>
          <p className="muted">{s.captions[main.name]}</p>
        </div>
        <div className="sk-grid">
          {rest.map((sw, i) => (
            <div key={sw.name || sw.key} className="sw spot reveal" style={{ transitionDelay: `${i * 50}ms` }}>
              <span className="sw-mono"><ToolLogo tool={sw} size={24} /></span>
              <span className="sw-text">
                <strong>{sw.name || t.tools[sw.key]}</strong>
                <span>{s.captions[sw.name || sw.key]}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="sk-lower">
      <div className="sk-groups">
        {s.groups.map((g, i) => (
          <div key={g.title} className="card spot sk-group reveal" style={{ transitionDelay: `${i * 70}ms` }}>
            <span className="focus-icon"><Icon name={g.icon} size={20} /></span>
            <h3>{g.title}</h3>
            <ul>
              {g.items.map((it) => (
                <li key={it}><Check size={15} /> {it}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="sk-bottom">
        <div className="card spot sk-personal reveal">
          <h3><Sparkles size={18} /> {s.personal}</h3>
          <div className="chips">
            {s.personalList.map((x) => <span key={x} className="chip">{x}</span>)}
          </div>
        </div>
        <div className="card spot sk-langs reveal">
          <h3><LangIcon size={18} /> {s.languages}</h3>
          <div className="langs">
            {s.languageList.map((l) => (
              <div key={l.name} className="lang">
                <Flag code={l.flag} className="lang-flag" title={l.name} />
                <div className="lang-body">
                  <div className="lang-row"><strong>{l.name}</strong><span className="mono muted">{l.level}</span></div>
                  <div className="bar"><span style={{ width: `${l.value}%` }} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ education */
function Education({ t }) {
  const e = t.education
  return (
    <section id="education" className="section container">
      <SectionHead kicker={e.kicker} title={e.title} />
      <div className="edu-grid">
        <div className="edu-list">
          {e.items.map((it, i) => (
            <div key={it.title} className="card spot edu reveal">
              <span className="edu-num mono">0{i + 1}</span>
              <span className="fact-icon"><GraduationCap size={18} /></span>
              <div>
                <h3>{it.title}</h3>
                <p className="muted">{it.place}</p>
                <span className="period mono"><CalendarDays size={14} /> {it.period}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="card spot cert reveal">
          <div className="cert-top">
            <span className="cert-badge"><Award size={26} /></span>
            <span className="kicker mono">{e.certTitle}</span>
          </div>
          <h3>{e.cert.title}</h3>
          <p className="small muted">{e.cert.place}</p>
          <p>{e.cert.text}</p>
          <span className="period mono"><CalendarDays size={14} /> {e.cert.period}</span>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ contact */
function Contact({ t }) {
  const c = t.contact
  return (
    <section id="contact" className="section container">
      <div className="contact reveal">
        <div className="contact-glow" aria-hidden="true" />
        <div className="contact-head">
          <h2>{c.title}</h2>
          <p className="muted">{c.text}</p>
          <div className="cta">
            <a href={`mailto:${profile.email}`} className="btn primary">
              <Mail size={18} /> {c.write} <ArrowUpRight size={18} />
            </a>
            <ExternalLink href={profile.linkedin} className="btn ghost">
              <LinkedinIcon size={16} /> LinkedIn
            </ExternalLink>
          </div>
        </div>
        <div className="contact-cards">
          <a href={`mailto:${profile.email}`} className="ccard spot">
            <span className="fact-icon"><Mail size={18} /></span>
            <span className="muted small">{c.email}</span>
            <span className="ccard-value">{profile.email}</span>
            <ArrowUpRight size={16} className="ccard-arrow" />
          </a>
          <a href={`tel:${profile.phoneHref}`} className="ccard spot">
            <span className="fact-icon"><Phone size={18} /></span>
            <span className="muted small">{c.phone}</span>
            <span className="ccard-value">{profile.phone}</span>
            <ArrowUpRight size={16} className="ccard-arrow" />
          </a>
          <ExternalLink href={profile.linkedin} className="ccard spot">
            <span className="fact-icon"><LinkedinIcon size={17} /></span>
            <span className="muted small">LinkedIn</span>
            <span className="ccard-value">{c.linkedinValue}</span>
            <ArrowUpRight size={16} className="ccard-arrow" />
          </ExternalLink>
          <div className="ccard">
            <span className="fact-icon"><MapPin size={18} /></span>
            <span className="muted small">{c.location}</span>
            <span className="ccard-value">{c.locationValue}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
