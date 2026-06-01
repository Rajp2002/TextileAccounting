"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  isBefore,
  startOfDay
} from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { getSuratDate } from "@/lib/time"

export type CalendarProps = {
  selected?: Date
  onSelect?: (date: Date) => void
  disabled?: (date: Date) => boolean
  className?: string
}

export function Calendar({ 
  selected, 
  onSelect, 
  disabled, 
  className 
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(selected || getSuratDate())

  const headerDate = format(currentMonth, "MMMM yyyy")
  
  const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  })

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

  return (
    <div className={cn("p-3 select-none", className)}>
      <div className="flex items-center justify-between mb-4 px-1">
        <h4 className="text-sm font-semibold text-foreground/90">{headerDate}</h4>
        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="icon-xs" 
            onClick={prevMonth}
            className="hover:bg-accent rounded-full"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon-xs" 
            onClick={nextMonth}
            className="hover:bg-accent rounded-full"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {days.map((day) => (
          <div key={day} className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, i) => {
          const isSelected = selected && isSameDay(day, selected)
          const isCurrentMonth = isSameMonth(day, monthStart)
          const isToday = isSameDay(day, getSuratDate())
          const isDisabled = disabled ? disabled(day) : false

          return (
            <button
              key={i}
              onClick={() => !isDisabled && onSelect?.(day)}
              disabled={isDisabled}
              className={cn(
                "h-8 w-8 flex items-center justify-center text-sm transition-all rounded-full relative",
                !isCurrentMonth && "text-muted-foreground/30",
                isCurrentMonth && !isSelected && "text-foreground/80 hover:bg-accent hover:text-accent-foreground",
                isSelected && "bg-primary text-primary-foreground font-semibold shadow-md scale-105",
                isToday && !isSelected && "after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-primary after:rounded-full",
                isDisabled && "opacity-20 cursor-not-allowed grayscale"
              )}
            >
              {format(day, "d")}
            </button>
          )
        })}
      </div>
    </div>
  )
}
