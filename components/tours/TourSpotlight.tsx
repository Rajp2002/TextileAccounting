import type { TourBox } from '@/lib/tours/placement'
export function TourSpotlight({ rect, animate }: { rect: TourBox | null; animate: boolean }) {
  const hole = rect ? { left: rect.left - 6, top: rect.top - 6, right: rect.right + 6, bottom: rect.bottom + 6 } : null
  const clipPath = hole ? `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${hole.left}px ${hole.top}px, ${hole.left}px ${hole.bottom}px, ${hole.right}px ${hole.bottom}px, ${hole.right}px ${hole.top}px, ${hole.left}px ${hole.top}px)` : undefined
  return <><div aria-hidden="true" className="guided-tour-backdrop pointer-events-none fixed inset-0 z-[100] bg-ink/45" style={{ clipPath }} />{hole && <div aria-hidden="true" className="guided-tour-highlight pointer-events-none fixed z-[100] rounded-xl border-2 border-saffron" style={{ left: hole.left, top: hole.top, width: hole.right - hole.left, height: hole.bottom - hole.top, transition: animate ? 'left 160ms ease-out, top 160ms ease-out, width 160ms ease-out, height 160ms ease-out' : 'none' }} />}</>
}
