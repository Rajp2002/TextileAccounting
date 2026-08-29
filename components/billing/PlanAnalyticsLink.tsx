'use client'

import Link from 'next/link'
import type { ComponentProps, MouseEvent, ReactNode } from 'react'
import { trackPlanEvent, type PlanAnalyticsEventName, type PlanAnalyticsProperties } from '@/lib/plan-analytics'

type PlanAnalyticsLinkProps = Omit<ComponentProps<typeof Link>, 'children'> & {
  eventName: PlanAnalyticsEventName
  properties?: PlanAnalyticsProperties
  children: ReactNode
}

export default function PlanAnalyticsLink({
  eventName,
  properties,
  children,
  ...props
}: PlanAnalyticsLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    trackPlanEvent(eventName, properties)
    props.onClick?.(event)
  }

  return <Link {...props} onClick={handleClick}>{children}</Link>
}
