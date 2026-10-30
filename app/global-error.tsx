"use client"

// This boundary is in every page's server tree. Core shares the initialized
// client without pulling the Next.js/Node integrations into each page bundle.
import { captureException } from "@sentry/core"
import NextError from "next/error"
import { useEffect } from "react"

export default function GlobalError({
    error,
}: {
    error: Error & { digest?: string }
}) {
    useEffect(() => {
        captureException(error)
    }, [error])

    return (
        <html>
            <body>
                <NextError statusCode={0} />
            </body>
        </html>
    )
}
