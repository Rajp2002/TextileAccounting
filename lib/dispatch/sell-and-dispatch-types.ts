export type StockSaleSourceType = 'stock_lot' | 'market_run' | 'order' | 'expected_stock'

export type DispatchStatus =
  | 'not_dispatched'
  | 'partially_dispatched'
  | 'dispatched'
  | 'received'
  | 'discrepancy'

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overdue'

export type SellAndDispatchInput = {
  sourceType: StockSaleSourceType
  sourceId: string
  partyId?: string | null
  partyName: string
  partyPhone?: string | null
  partyCity?: string | null
  partyGstin?: string | null
  soldMeters: number
  soldTakas?: number | null
  saleRatePerMeter: number
  creditDays: number
  saleDate: string
  dispatchNow: boolean
  actualDispatchedMeters?: number | null
  dispatchDate?: string | null
  transportName?: string | null
  vehicleNumber?: string | null
  challanNumber?: string | null
  notes?: string | null
}

export type LegacyOrderSellAndDispatchInput = {
  orderId: string
  selectedLots: Array<{
    stockLotId: string
    unitsToSell: number
  }>
  sale: {
    saleRatePerMeter: number
    saleDate: string
    notes?: string | null
  }
  dispatch: {
    actualDispatchedMeters?: number | null
    dispatchDate: string
    transporterName?: string | null
    vehicleNumber?: string | null
    challanNumber?: string | null
    ewayBillNumber?: string | null
    ewayBillDate?: string | null
    approximateDistanceKm?: number | null
    notes?: string | null
  }
}

export type SellAndDispatchResult =
  | {
      success: true
      saleIds: string[]
      dispatchId: string | null
      dispatchNumber: number | null
      trackingUrl: string | null
      dispatchStatus: DispatchStatus
      pendingDispatchMeters: number
      receivableId?: string | null
    }
  | {
      success: false
      stage: 'validation' | 'sale' | 'dispatch' | 'commercials'
      message: string
      saleIds?: string[]
      recoverable?: boolean
    }
