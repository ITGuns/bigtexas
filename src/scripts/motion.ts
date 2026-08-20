/**
 * Site-wide motion system.
 * Declarative: components opt in with data attributes —
 *   data-reveal            → rise+fade on enter (variants: fade|left|right|scale)
 *   data-reveal-group      → stagger direct children marked data-reveal-child
 *   data-count="1234"      → count up when visible
 *   data-magnetic          → magnetic pull on fine pointers
 *   data-parallax="0.15"   → subtle translateY parallax
 * Reduced-motion users get instant, static content (CSS handles initial states).
 */
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const motionOK = window.matchMedia('(prefers-reduced-motion: no-preference)').matches
const finePointer = window.matchMedia('(pointer: fine)').matches
/* Page loaded in a hidden tab: rAF is suspended, so entrance tweens would
   freeze mid-flight. Settle to final states immediately instead. */
const instant = !motionOK || document.visibilityState === 'hidden'

/* ---------- reveals ---------- */
function initReveals() {
  if (instant) return

  const singles = gsap.utils.toArray<HTMLElement>('[data-reveal]:not([data-reveal-child])')
  for (const el of singles) {
    const variant = el.dataset.reveal
    const from: gsap.TweenVars = { opacity: 0 }
    if (variant === 'left') from.x = -32
    else if (variant === 'right') from.x = 32
    else if (variant === 'scale') from.scale = 0.94
    else if (variant !== 'fade') from.y = 28

    gsap.fromTo(el, from, {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      duration: 0.9,
      ease: 'expo.out',
      delay: parseFloat(el.dataset.revealDelay ?? '0'),
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    })
  }

  const groups = gsap.utils.toArray<HTMLElement>('[data-reveal-group]')
  for (const group of groups) {
    const children = group.querySelectorAll<HTMLElement>('[data-reveal-child]')
    if (!children.length) continue
    gsap.fromTo(
      children,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'expo.out',
        stagger: 0.08,
        scrollTrigger: { trigger: group, start: 'top 85%', once: true },
      },
    )
  }
}

/* Instant mode: make everything visible immediately. */
function ensureVisibleFallback() {
  if (!instant) return
  document
    .querySelectorAll<HTMLElement>('[data-reveal], [data-reveal-child]')
    .forEach((el) => {
      el.style.opacity = '1'
      el.style.transform = 'none'
    })
}

/* ---------- counters ---------- */
function initCounters() {
  const els = gsap.utils.toArray<HTMLElement>('[data-count]')
  for (const el of els) {
    const target = parseFloat(el.dataset.count ?? '0')
    const decimals = el.dataset.countDecimals ? parseInt(el.dataset.countDecimals) : 0
    const suffix = el.dataset.countSuffix ?? ''
    const prefix = el.dataset.countPrefix ?? ''
    if (instant) {
      el.textContent = prefix + target.toFixed(decimals) + suffix
      continue
    }
    const obj = { v: 0 }
    gsap.to(obj, {
      v: target,
      duration: 1.6,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      onUpdate: () => {
        el.textContent = prefix + obj.v.toFixed(decimals) + suffix
      },
    })
  }
}

/* ---------- magnetic buttons ---------- */
function initMagnetic() {
  if (!motionOK || !finePointer) return
  const els = document.querySelectorAll<HTMLElement>('[data-magnetic]')
  for (const el of els) {
    const strength = parseFloat(el.dataset.magnetic || '0.25')
    const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' })
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect()
      xTo((e.clientX - (r.left + r.width / 2)) * strength)
      yTo((e.clientY - (r.top + r.height / 2)) * strength)
    })
    el.addEventListener('mouseleave', () => {
      xTo(0)
      yTo(0)
    })
  }
}

/* ---------- parallax ---------- */
function initParallax() {
  if (!motionOK) return
  const els = gsap.utils.toArray<HTMLElement>('[data-parallax]')
  for (const el of els) {
    const amount = parseFloat(el.dataset.parallax || '0.15')
    gsap.to(el, {
      yPercent: amount * -100,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
    })
  }
}

/* ---------- scroll progress + nav state ---------- */
function initChrome() {
  const bar = document.getElementById('scroll-progress')
  if (bar) {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
  }

  const nav = document.querySelector<HTMLElement>('[data-nav]')
  if (nav) {
    const setScrolled = () => nav.classList.toggle('nav--scrolled', window.scrollY > 24)
    setScrolled()
    window.addEventListener('scroll', setScrolled, { passive: true })
  }
}

initReveals()
ensureVisibleFallback()
initCounters()
initMagnetic()
initParallax()
initChrome()

/* Recalculate after fonts/images settle */
window.addEventListener('load', () => ScrollTrigger.refresh())

export {}
