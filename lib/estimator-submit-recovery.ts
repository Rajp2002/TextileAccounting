export const ESTIMATOR_OFFLINE_SAVE_TITLE = 'Cost Estimate not saved'

const NETWORK_FAILURE_PATTERN =
  /failed to fetch|fetch failed|network(?:error| request)?|load failed|connection|offline/i

export function isLikelyEstimatorNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true
  return error instanceof Error && NETWORK_FAILURE_PATTERN.test(error.message)
}

export function getEstimatorSubmitFailureCopy(
  error: unknown,
  isOnline: boolean,
  draftSaved: boolean
): { title: string; description?: string; retryable: boolean } {
  if (!isOnline || isLikelyEstimatorNetworkFailure(error)) {
    return {
      title: ESTIMATOR_OFFLINE_SAVE_TITLE,
      description: draftSaved
        ? 'Your current inputs are saved on this device. Reconnect, then use Save Costing or Update Costing again.'
        : 'Keep this screen open. Reconnect, then use Save Costing or Update Costing again.',
      retryable: true,
    }
  }

  return {
    title: error instanceof Error && error.message.trim()
      ? error.message
      : 'Failed to save Cost Estimate',
    retryable: false,
  }
}
