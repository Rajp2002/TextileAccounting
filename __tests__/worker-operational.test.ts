import { describe, expect, it } from 'vitest'
import {
  getWorkerOperationalSummary,
  type BaseProductionWorkerWithOperational,
} from '../lib/worker-operational'

describe('Worker Operational Summary Business Logic', () => {
  const basePieceWorker: BaseProductionWorkerWithOperational = {
    id: 'worker-1',
    name: 'Ramesh Patel',
    pay_type: 'piece_rate',
    rate_per_meter: 4.5,
    shift_availability: 'day',
    is_active: true,
    assignedMachineCount: 3,
  }

  const baseFixedWorker: BaseProductionWorkerWithOperational = {
    id: 'worker-2',
    name: 'Suresh Master',
    pay_type: 'fixed_monthly',
    role: 'Weaving Master',
    monthly_salary: 30000,
    start_date: '2026-01-01',
    rate_per_meter: 0,
    shift_availability: 'both',
    is_active: true,
    assignedMachineCount: 0,
  }

  describe('Piece-Rate Workers', () => {
    it('marks rate as Configured when rate_per_meter > 0', () => {
      const summary = getWorkerOperationalSummary(basePieceWorker)
      expect(summary.isPieceRate).toBe(true)
      expect(summary.isFixedSalary).toBe(false)
      expect(summary.hasRateConfigured).toBe(true)
      expect(summary.rateStatusLabel).toBe('Configured')
      expect(summary.assignedMachineCount).toBe(3)
    })

    it('marks rate as Not configured when rate_per_meter is 0 or missing', () => {
      const summary = getWorkerOperationalSummary({
        ...basePieceWorker,
        rate_per_meter: 0,
      })
      expect(summary.hasRateConfigured).toBe(false)
      expect(summary.rateStatusLabel).toBe('Not configured')
    })

    it('handles zero or negative assigned machines gracefully', () => {
      const summary = getWorkerOperationalSummary({
        ...basePieceWorker,
        assignedMachineCount: 0,
      })
      expect(summary.assignedMachineCount).toBe(0)
    })
  })

  describe('Fixed-Salary Workers', () => {
    it('marks salary as Configured and payroll as Ready when salary and start_date exist', () => {
      const summary = getWorkerOperationalSummary(baseFixedWorker)
      expect(summary.isPieceRate).toBe(false)
      expect(summary.isFixedSalary).toBe(true)
      expect(summary.hasSalaryConfigured).toBe(true)
      expect(summary.salaryStatusLabel).toBe('Configured')
      expect(summary.payrollStatusLabel).toBe('Ready')
    })

    it('marks payroll as Needs setup when start_date is missing', () => {
      const summary = getWorkerOperationalSummary({
        ...baseFixedWorker,
        start_date: null,
      })
      expect(summary.hasSalaryConfigured).toBe(true)
      expect(summary.salaryStatusLabel).toBe('Configured')
      expect(summary.payrollStatusLabel).toBe('Needs setup')
    })

    it('marks salary as Not configured and payroll as Needs setup when monthly_salary is 0', () => {
      const summary = getWorkerOperationalSummary({
        ...baseFixedWorker,
        monthly_salary: 0,
        salary_history: [],
      })
      expect(summary.hasSalaryConfigured).toBe(false)
      expect(summary.salaryStatusLabel).toBe('Not configured')
      expect(summary.payrollStatusLabel).toBe('Needs setup')
    })

    it('recognizes salary configuration from salary_history even if monthly_salary is 0', () => {
      const summary = getWorkerOperationalSummary({
        ...baseFixedWorker,
        monthly_salary: 0,
        salary_history: [{ effective_from: '2026-01-01', monthly_salary: 25000 }],
      })
      expect(summary.hasSalaryConfigured).toBe(true)
      expect(summary.salaryStatusLabel).toBe('Configured')
      expect(summary.payrollStatusLabel).toBe('Ready')
    })
  })
})
