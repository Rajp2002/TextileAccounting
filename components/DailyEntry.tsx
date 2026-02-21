"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

// Mock data for workers
const MOCK_WORKERS = [
    { id: "1", name: "Rajesh Kumar" },
    { id: "2", name: "Suresh Patel" },
    { id: "3", name: "Amit Singh" },
    { id: "4", name: "Priya Sharma" },
    { id: "5", name: "Vikram Malhotra" },
]

export function DailyEntry() {
    const [productionData, setProductionData] = useState<Record<string, string>>({})

    const handleInputChange = (workerId: string, value: string) => {
        setProductionData((prev) => ({
            ...prev,
            [workerId]: value,
        }))
    }

    const handleSaveAll = () => {
        console.log("Saving production data:", productionData)
        // Here we would typically make an API call to save the data
        alert("Production data saved! (Check console for details)")
    }

    return (
        <div className="space-y-4 pb-20"> {/* Add padding bottom to account for fixed footer */}
            <h1 className="text-2xl font-bold mb-4">Daily Production Entry</h1>

            <div className="grid gap-4">
                {MOCK_WORKERS.map((worker) => (
                    <Card key={worker.id} className="shadow-sm">
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                            <div className="flex-1">
                                <Label htmlFor={`production-${worker.id}`} className="text-base font-medium">
                                    {worker.name}
                                </Label>
                            </div>
                            <div className="w-24">
                                <Input
                                    id={`production-${worker.id}`}
                                    type="number"
                                    placeholder="0"
                                    value={productionData[worker.id] || ""}
                                    onChange={(e) => handleInputChange(worker.id, e.target.value)}
                                    className="text-right"
                                />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-center z-10">
                <Button
                    onClick={handleSaveAll}
                    className="w-full max-w-md h-12 text-lg font-semibold shadow-lg"
                >
                    Save All Entries
                </Button>
            </div>
        </div>
    )
}
