'use client'
import { Button } from '@/components/ui/button'
export default function PrintButton() {
    return (
        <Button
            className="h-10 px-5 rounded-xl bg-loom text-white font-bold hover:bg-loom-elevated shadow-xs"
            onClick={() => window.print()}
        >
            Print / Save as PDF
        </Button>
    )
}
