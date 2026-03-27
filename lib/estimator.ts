/**
 * lib/estimator.ts
 *
 * Technical calculation logic for the Vastra Estimator (Surat textile hub).
 * Handles Grey Cost, Job-work with shrinkage, and Overhead allocation.
 */

import { z } from 'zod'

export interface JobWorkItem {
    name: string
    rate: number
    shrinkage: number
}

export interface EstimatorInputs {
    // Technical Specs
    ppi: number
    yarn_denier: number
    gsm: number
    
    // Order Specs
    meters: number
    yarn_rate_per_kg: number
    job_work_charges: JobWorkItem[]
    
    // Master Data / Overheads
    electricity_rate: number // ₹ per kWh
    factory_rent_per_day: number
    admin_overhead_per_day: number // Salaries, etc.
    avg_machine_efficiency: number // 0.85 etc.
    standard_wastage_percent: number
    gst_rate: number
    is_gst_inclusive: boolean
}

export interface EstimatorResult {
    greyCost: number
    jobWorkCost: number
    powerCost: number
    overheadCost: number
    pureLandedCost: number
    finalLandedCost: number
    gstAmount: number
    dailyProduction: number
}

/**
 * Calculates the landed cost per meter using the "Surat Logic".
 * Formula: Landed Cost = ((Grey + JobWork) / (1 - Shrinkage)) + ((Power + Labor + Rent) / Daily Production)
 */
export function calculateLandedCost(inputs: EstimatorInputs) {
    const {
        ppi,
        yarn_denier,
        gsm,
        yarn_rate_per_kg,
        job_work_charges,
        electricity_rate,
        factory_rent_per_day,
        admin_overhead_per_day,
        avg_machine_efficiency,
        standard_wastage_percent,
        gst_rate,
        is_gst_inclusive
    } = inputs

    // 1. Grey Cost Calculation
    // GSM (Grams per Square Meter) is usually provided or calculated.
    // In Surat, sometimes they use (GSM * Yarn Rate) / 1000 for yarn cost per meter.
    // We add wastage to the yarn consumption.
    const greyCostPerMeter = (gsm * yarn_rate_per_kg / 1000) * (1 + standard_wastage_percent / 100)

    // 2. Job-Work Cost with Shrinkage
    // If rate is ₹12 and shrinkage is 3%, the real cost is 12 / (1 - 0.03) = 12.37
    let totalJobWorkCost = 0
    let totalShrinkageFactor = 0
    job_work_charges.forEach(jw => {
        totalJobWorkCost += jw.rate
        totalShrinkageFactor += (jw.shrinkage / 100)
    })

    const directCostPerMeter = (greyCostPerMeter + totalJobWorkCost) / (1 - totalShrinkageFactor)

    // 3. Overhead Allocation (Power, Rent, Admin)
    // Daily Production depends on PPI and Machine Speed.
    // Standard Loom Speed (e.g., 600 RPM for water-jet)
    // Meters per Day = (RPM * 60 * 24 * efficiency) / (PPI * 39.37)
    // Let's assume a default daily production if not provided, or let user adjust.
    // For now, let's use a simplified "Machine Hour" approach or "Daily Total / Capacity".
    
    // Assume 1 machine produces X meters per day based on PPI
    // Typical Water-jet: 600 RPM.
    // Meters/min = 600 / PPI
    // Meters/day = (600 / PPI) * 60 * 24 * efficiency
    const rpm = 600 // Standard fallback
    const dailyProductionPerMachine = (rpm / ppi) * 60 * 24 * avg_machine_efficiency * 0.0254 // Converting picks to meters approx
    // Simplified Surat benchmark: 80-100 meters per day for 60 PPI.
    const fallbackDailyProduction = (100 * 60) / ppi // Inverse relation to PPI
    const realDailyProduction = dailyProductionPerMachine > 0 ? dailyProductionPerMachine : fallbackDailyProduction

    // Power Cost approx ₹2 per meter (Surat benchmark)
    // Power (kWh) = (Machine kW * 24) / Daily Production
    const machineKW = 2.5 // Typical water-jet loom power
    const powerCostPerMeter = (machineKW * 24 * electricity_rate) / realDailyProduction

    // Rent & Admin (Fixed)
    // We need to know how many machines the factory has to distribute rent.
    // Or we assume a "per machine" rent assignment.
    // Let's assume the factory has 24 machines for standard overhead distribution if not specified.
    const machineCount = 24 
    const fixedOverheadPerMachinePerDay = (factory_rent_per_day + admin_overhead_per_day) / machineCount
    const overheadCostPerMeter = fixedOverheadPerMachinePerDay / realDailyProduction

    const pureLandedCost = directCostPerMeter + powerCostPerMeter + overheadCostPerMeter

    // 4. GST Logic
    const gstFactor = 1 + (gst_rate / 100)
    const finalLandedCost = is_gst_inclusive ? pureLandedCost : pureLandedCost * gstFactor

    return {
        greyCost: greyCostPerMeter,
        jobWorkCost: totalJobWorkCost,
        powerCost: powerCostPerMeter,
        overheadCost: overheadCostPerMeter,
        pureLandedCost: pureLandedCost,
        finalLandedCost: finalLandedCost,
        gstAmount: finalLandedCost - pureLandedCost,
        dailyProduction: realDailyProduction
    }
}

/**
 * Stress Test Scenarios
 */
export function runStressTest(inputs: EstimatorInputs) {
    // Scenario 1: Yarn Price Hike (+5%)
    const yarnHike = calculateLandedCost({
        ...inputs,
        yarn_rate_per_kg: inputs.yarn_rate_per_kg * 1.05
    })

    // Scenario 2: Efficiency Drop (-15%)
    const efficiencyDrop = calculateLandedCost({
        ...inputs,
        avg_machine_efficiency: inputs.avg_machine_efficiency * 0.85
    })

    // Scenario 3: PPI Increase (+5 picks) - more labor/time
    const ppiIncrease = calculateLandedCost({
        ...inputs,
        ppi: inputs.ppi + 5
    })

    return {
        base: calculateLandedCost(inputs),
        yarnHike: yarnHike.finalLandedCost,
        efficiencyDrop: efficiencyDrop.finalLandedCost,
        ppiIncrease: ppiIncrease.finalLandedCost
    }
}
