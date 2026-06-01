'use client'

import { useState, useEffect } from 'react'

export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(true)

    useEffect(() => {
        const initialStatusTimer = window.setTimeout(() => setIsOnline(navigator.onLine), 0)
        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.clearTimeout(initialStatusTimer)
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    return isOnline
}
