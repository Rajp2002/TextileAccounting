'use client'

import { useRef, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OrderCard } from './OrderCard'
import { Button } from '@/components/ui/button'

interface LiveOrdersLayoutProps {
  orders: any[]
  forecasts?: Record<string, any>
  onOrderClick?: (order: any) => void
}

export function LiveOrdersLayout({ orders, forecasts, onOrderClick }: LiveOrdersLayoutProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)

  const count = orders.length

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setShowLeftArrow(scrollLeft > 10)
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10)

    // Update active dot based on scroll position - simple version
    const itemWidth = (scrollWidth / count) || clientWidth
    const newIndex = Math.min(count - 1, Math.max(0, Math.round(scrollLeft / itemWidth)))
    setActiveIndex(newIndex)
  }

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const { clientWidth } = scrollRef.current
    const scrollAmount = direction === 'left' ? -clientWidth : clientWidth
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
  }

  useEffect(() => {
    handleScroll()
    // Trigger scroll check on mount and resize
    window.addEventListener('resize', handleScroll)
    return () => window.removeEventListener('resize', handleScroll)
  }, [count, orders])

  // State 1: Hero View (1 Order)
  if (count === 1) {
    return (
      <div className="w-full max-w-6xl mx-auto">
        <div className="cursor-pointer" onClick={() => onOrderClick?.(orders[0])}>
          <OrderCard order={orders[0]} forecast={forecasts?.[orders[0].order_id]} layout="wide" />
        </div>
      </div>
    )
  }

  // State 2: Grid View (2 or 3 Orders)
  if (count <= 3) {
    return (
      <div className={cn(
        "grid gap-8",
        count === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      )}>
        {orders.map((order) => (
          <div key={order.order_id} className="cursor-pointer" onClick={() => onOrderClick?.(order)}>
            <OrderCard 
              order={order} 
              forecast={forecasts?.[order.order_id]} 
              layout="compact" 
            />
          </div>
        ))}
      </div>
    )
  }

  // State 3: Carousel View (4+ Orders)
  return (
    <div className="relative group/carousel -mx-4 px-4 overflow-hidden">
      {/* Navigation Arrows */}
      {showLeftArrow && (
        <Button
          variant="outline"
          size="icon"
          className="absolute left-6 top-1/2 -translate-y-1/2 z-20 rounded-full bg-white/90 backdrop-blur shadow-xl border-slate-200 hidden group-hover/carousel:flex animate-in fade-in duration-300"
          onClick={() => scroll('left')}
        >
          <ChevronLeft className="h-6 w-6 text-slate-700" />
        </Button>
      )}
      
      {showRightArrow && (
        <Button
          variant="outline"
          size="icon"
          className="absolute right-6 top-1/2 -translate-y-1/2 z-20 rounded-full bg-white/90 backdrop-blur shadow-xl border-slate-200 flex animate-in fade-in duration-300"
          onClick={() => scroll('right')}
        >
          <ChevronRight className="h-6 w-6 text-slate-700" />
        </Button>
      )}

      {/* Peek Gradients */}
      <div className="absolute right-0 top-0 bottom-4 w-24 bg-gradient-to-l from-gray-50/80 to-transparent z-10 pointer-events-none" />
      {showLeftArrow && (
        <div className="absolute left-0 top-0 bottom-4 w-24 bg-gradient-to-r from-gray-50/80 to-transparent z-10 pointer-events-none" />
      )}

      {/* Scroll Container */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-8 pt-2 no-scrollbar scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {orders.map((order) => (
          <div 
            key={order.order_id} 
            className="min-w-[85%] sm:min-w-[45%] lg:min-w-[31%] snap-start cursor-pointer"
            onClick={() => onOrderClick?.(order)}
          >
            <OrderCard 
              order={order} 
              forecast={forecasts?.[order.order_id]} 
              layout="compact" 
            />
          </div>
        ))}
      </div>

      {/* Pagination Indicators */}
      <div className="flex justify-center gap-2 mt-2">
        {orders.map((_, idx) => (
          <div 
            key={idx}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              activeIndex === idx 
                ? "w-6 bg-teal-600 shadow-[0_0_8px_rgba(20,184,166,0.4)]" 
                : "w-1.5 bg-slate-200"
            )}
          />
        ))}
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -webkit-overflow-scrolling: touch;
        }
      `}</style>
    </div>
  )
}
