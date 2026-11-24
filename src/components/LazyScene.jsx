import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

const Scene = lazy(() => import('../three/Scene.jsx'))

/** Mounts the WebGL canvas only while it is near the viewport. */
export default function LazyScene({ model, className = '', ...rest }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const loader = (
    <div className="scene-loader">
      <Loader2 className="spin" size={22} />
    </div>
  )

  return (
    <div ref={ref} className={`scene ${className}`}>
      {visible ? (
        <Suspense fallback={loader}>
          <Scene model={model} {...rest} />
        </Suspense>
      ) : (
        loader
      )}
    </div>
  )
}
