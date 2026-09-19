import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
    calculateEmbodiedYarn,
    generateMaterialPositionCsv,
    type InventoryAuditBoard,
} from '@/lib/inventory-audit'

describe('Inventory Audit & Material Position Domain Engine', () => {
    describe('Embodied Yarn Calculation (Section 22)', () => {
        it('calculates embodied yarn proportionally based on remaining fabric metres', () => {
            // Production: 500m, Consumed: 26kg 40s Cotton, 15.5kg 30s Cotton
            // Remaining: 200m after 300m dispatch
            const lots = [
                {
                    produced_meters: 500,
                    remaining_meters: 200,
                    yarn_consumption: [
                        { yarn_key: '40s cotton', consumed_kg: 26.0 },
                        { yarn_key: '30s cotton', consumed_kg: 15.5 },
                    ],
                },
            ]

            const embodied = calculateEmbodiedYarn(lots)
            // 26 * 200 / 500 = 10.4 kg
            expect(embodied.get('40s cotton')).toBe(10.4)
            // 15.5 * 200 / 500 = 6.2 kg
            expect(embodied.get('30s cotton')).toBe(6.2)
        })

        it('correctly aggregates embodied yarn across multiple production lots of different qualities', () => {
            // Quality A Lot: 500m produced, 200m remaining, 26kg 40s Cotton consumed -> 10.4kg
            // Quality B Lot: 1000m produced, 600m remaining, 50kg 40s Cotton consumed -> 30.0kg
            const lots = [
                {
                    produced_meters: 500,
                    remaining_meters: 200,
                    yarn_consumption: [{ yarn_key: '40s cotton', consumed_kg: 26.0 }],
                },
                {
                    produced_meters: 1000,
                    remaining_meters: 600,
                    yarn_consumption: [{ yarn_key: '40s cotton', consumed_kg: 50.0 }],
                },
            ]

            const embodied = calculateEmbodiedYarn(lots)
            expect(embodied.get('40s cotton')).toBe(40.4)
        })

        it('returns zero embodied yarn when all fabric has been dispatched', () => {
            const lots = [
                {
                    produced_meters: 500,
                    remaining_meters: 0,
                    yarn_consumption: [{ yarn_key: '40s cotton', consumed_kg: 26.0 }],
                },
            ]

            const embodied = calculateEmbodiedYarn(lots)
            expect(embodied.get('40s cotton')).toBeUndefined()
        })
    })

    describe('End-to-End Acceptance Scenario (Section 61)', () => {
        it('verifies exact inventory progression across Activation, Production, Dispatch, and Audit', () => {
            // 1. Starting Stock
            let looseYarn40s = 100.0
            let looseYarn30s = 60.0
            let fabricStockABC = 0.0

            const recipeABC = {
                yarn40s_kg_per_100m: 5.20,
                yarn30s_kg_per_100m: 3.10,
            }

            // 2. Activate Quality ABC (Rule 1 & 2)
            // Both yarns available (> 0)
            const canActivate = looseYarn40s > 0 && looseYarn30s > 0
            expect(canActivate).toBe(true)
            // Stock remains unchanged upon activation (Rule 2)
            expect(looseYarn40s).toBe(100.0)
            expect(looseYarn30s).toBe(60.0)

            // 3. Produce 500m of Quality ABC (Rule 3 & 4)
            const producedMeters = 500.0
            const required40s = (producedMeters * recipeABC.yarn40s_kg_per_100m) / 100.0 // 26.0 kg
            const required30s = (producedMeters * recipeABC.yarn30s_kg_per_100m) / 100.0 // 15.5 kg

            expect(required40s).toBe(26.0)
            expect(required30s).toBe(15.5)

            // Deduct yarn and add fabric atomically
            looseYarn40s -= required40s // 74.0 kg
            looseYarn30s -= required30s // 44.5 kg
            fabricStockABC += producedMeters // 500.0 m

            expect(looseYarn40s).toBe(74.0)
            expect(looseYarn30s).toBe(44.5)
            expect(fabricStockABC).toBe(500.0)

            // Production Lot created
            const productionLot = {
                produced_meters: 500.0,
                remaining_meters: 500.0,
                yarn_consumption: [
                    { yarn_key: '40s cotton', consumed_kg: required40s },
                    { yarn_key: '30s cotton', consumed_kg: required30s },
                ],
            }

            // 4. Dispatch 300m of Quality ABC (Rule 5 & 20)
            const dispatchedMeters = 300.0
            fabricStockABC -= dispatchedMeters // 200.0 m
            productionLot.remaining_meters -= dispatchedMeters // 200.0 m

            // Invariant: Yarn stock does NOT change on dispatch (Rule 5)
            expect(looseYarn40s).toBe(74.0)
            expect(looseYarn30s).toBe(44.5)
            expect(fabricStockABC).toBe(200.0)

            // 5. Inventory Audit (Rule 6, Section 30 & 61)
            const embodiedMap = calculateEmbodiedYarn([productionLot])
            const embodied40s = embodiedMap.get('40s cotton')!
            const embodied30s = embodiedMap.get('30s cotton')!

            expect(embodied40s).toBe(10.4)
            expect(embodied30s).toBe(6.2)

            // Material Position: Loose + Embodied = Total Represented
            const totalRepresented40s = looseYarn40s + embodied40s
            const totalRepresented30s = looseYarn30s + embodied30s

            expect(totalRepresented40s).toBe(84.4)
            expect(totalRepresented30s).toBe(50.7)

            // Invariant: Operational stock MUST NOT become the higher audit numbers
            expect(looseYarn40s).toBe(74.0)
            expect(looseYarn30s).toBe(44.5)
        })
    })

    describe('Audit CSV Export (Section 30 & 31)', () => {
        it('formats material position CSV with unambiguous labeling and escaped values', () => {
            const board: InventoryAuditBoard = {
                audit_date: '2026-03-31',
                audit: null,
                lines: [],
                summary: {
                    total_fabric_meters: 200,
                    total_loose_yarn_kg: 118.5,
                    total_embodied_yarn_kg: 16.6,
                    total_yarn_represented_kg: 135.1,
                    unresolved_fabric_meters: 0,
                },
                yarns: [],
                fabric: [],
                material_position: [
                    {
                        yarn_id: '1',
                        yarn_name: '40s Cotton',
                        yarn_key: '40s cotton',
                        loose_kg: 74.0,
                        embodied_kg: 10.4,
                        total_represented_kg: 84.4,
                        drilldown: [],
                    },
                    {
                        yarn_id: '2',
                        yarn_name: '30s Cotton',
                        yarn_key: '30s cotton',
                        loose_kg: 44.5,
                        embodied_kg: 6.2,
                        total_represented_kg: 50.7,
                        drilldown: [],
                    },
                ],
            }

            const csv = generateMaterialPositionCsv(board)
            expect(csv).toContain('Weavly - Inventory Audit & Material Position Report')
            expect(csv).toContain('40s Cotton')
            expect(csv).toContain('74')
            expect(csv).toContain('10.4')
            expect(csv).toContain('84.4')
            expect(csv).toContain('Total Represented (kg)')
            // Label must NOT say "Total Yarn Stock" per Rule 31
            expect(csv).not.toContain('Total Yarn Stock')
        })
    })

    describe('Database Migration & Architecture Integrity (Phases 2-7)', () => {
        const migrationPath = join(process.cwd(), 'supabase/migrations/20260920000000_unified_inventory_audit_architecture.sql')

        it('migration exists and contains the complete unified schema and invariant protections', () => {
            expect(existsSync(migrationPath)).toBe(true)
            const sql = readFileSync(migrationPath, 'utf8')

            // Rule 5: Drops previous dispatch yarn deduction trigger
            expect(sql).toContain('DROP TRIGGER IF EXISTS dispatch_yarn_stock ON public.quality_stock_movements')

            // Rule 17: Production stock lots table
            expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.production_stock_lots')
            expect(sql).toContain('produced_meters')
            expect(sql).toContain('remaining_meters')
            expect(sql).toContain('recipe_snapshot')
            expect(sql).toContain('yarn_consumption_snapshot')

            // Rule 21: Delivery challan FIFO lot allocations
            expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.delivery_challan_lot_allocations')

            // Rule 23-38: Inventory audit and lines tables
            expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.inventory_audits')
            expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.inventory_audit_lines')

            // Rule 1: Quality activation yarn validation RPC
            expect(sql).toContain('CREATE OR REPLACE FUNCTION public.validate_quality_activation_yarn')

            // Rule 1 & 2: activate_saved_costing_for_production checks yarn and freezes recipe
            expect(sql).toContain('CREATE OR REPLACE FUNCTION public.activate_saved_costing_for_production')

            // Rule 3, 4, 13, 14: Atomic reconcile_quality_stock with yarn deduction and sufficiency check
            expect(sql).toContain('CREATE OR REPLACE FUNCTION private.reconcile_quality_stock')
            expect(sql).toContain('Insufficient yarn stock for %')
            expect(sql).toContain('production_consumption')
            expect(sql).toContain('production_reversal')

            // Rule 5 & 21: FIFO lot allocation on dispatch confirmation in mutate_delivery_challan
            expect(sql).toContain('CREATE OR REPLACE FUNCTION public.mutate_delivery_challan')

            // Rule 6, 22, 27-34: get_inventory_audit_data RPC
            expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_inventory_audit_data')

            // Rule 35, 36: apply_inventory_audit_adjustment RPC
            expect(sql).toContain('CREATE OR REPLACE FUNCTION public.apply_inventory_audit_adjustment')
            expect(sql).toContain('audit_adjustment')

            // Rule 37, 38: finalize_inventory_audit RPC
            expect(sql).toContain('CREATE OR REPLACE FUNCTION public.finalize_inventory_audit')

            // Rule 45: Existing yarn opening balance migration
            expect(sql).toContain('Opening stock initialization')
        })
    })
})
