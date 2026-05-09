export type SellAndDispatchInput = {
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
    dispatchDate: string
    transporterName?: string | null
    vehicleNumber?: string | null
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
      dispatchId: string
      dispatchNumber: number
      trackingUrl: string | null
    }
  | {
      success: false
      stage: 'validation' | 'sale' | 'dispatch'
      message: string
      saleIds?: string[]
      recoverable?: boolean
    }
