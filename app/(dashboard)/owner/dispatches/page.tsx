import { getAllDispatches } from "../orders/actions"
import DispatchesClient from "./DispatchesClient"

export const metadata = {
    title: "Dispatches | Owner Dashboard",
    description: "Monitor sent fabric dispatches and trader confirmations.",
}

export default async function DispatchesPage() {
    const { data: dispatches, error } = await getAllDispatches()

    if (error) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-red-500">Error loading dispatches</h1>
                <p className="text-muted-foreground">{error}</p>
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <DispatchesClient initialDispatches={dispatches || []} />
        </div>
    )
}
