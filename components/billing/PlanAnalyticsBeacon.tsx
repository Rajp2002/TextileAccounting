'use client'

import { useEffect, useRef } from 'react'
import { trackPlanEvent, type PlanAnalyticsEventName, type PlanAnalyticsProperties } from '@/lib/plan-analytics'

export default function PlanAnalyticsBeacon({
  eventName,
  properties,
}: {
  eventName: PlanAnalyticsEventName
  properties?: PlanAnalyticsProperties
}) {
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    trackPlanEvent(eventName, properties)
  }, [eventName, properties])

  return null
}
