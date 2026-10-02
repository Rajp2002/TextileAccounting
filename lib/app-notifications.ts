import { toast as sonnerToast } from 'sonner'

type ToastMessage = Parameters<typeof sonnerToast.success>[0]
type ToastOptions = Parameters<typeof sonnerToast.success>[1]

const defaultOptions: NonNullable<ToastOptions> = {
  duration: 4200,
  closeButton: true,
}

// An error usually asks the owner to do something, so it stays long enough
// to read twice.
const errorDuration = 6500

function withDefaults(options?: ToastOptions) {
  return { ...defaultOptions, ...options }
}

/**
 * Base UX notification wrapper. Keeping the Sonner API behind this module
 * gives every customer-facing message the same duration and close affordance.
 * Placement and styling live on the shared Toaster (components/ui/sonner.tsx).
 */
export const toast = {
  success(message: ToastMessage, options?: ToastOptions) {
    return sonnerToast.success(message, withDefaults(options))
  },
  error(message: ToastMessage, options?: ToastOptions) {
    return sonnerToast.error(message, withDefaults({ duration: errorDuration, ...options }))
  },
  info(message: ToastMessage, options?: ToastOptions) {
    return sonnerToast.info(message, withDefaults(options))
  },
  warning(message: ToastMessage, options?: ToastOptions) {
    return sonnerToast.warning(message, withDefaults(options))
  },
}

const TECHNICAL_ERROR_PATTERN = /(?:PGRST|PostgREST|Supabase|Postgres|SQLSTATE|relation .* does not exist|column .* does not exist|constraint|JWT|TypeError|ReferenceError|SyntaxError|fetch failed|ECONN|undefined is not|cannot read propert)/i

/**
 * Keep database/runtime details in logs while giving the owner a clear next
 * step. Server actions may still return a useful, intentional business error;
 * only obvious implementation/infrastructure text is hidden here.
 */
export function userFacingError(error: unknown, fallback: string) {
  const message = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : ''
  const trimmed = message.trim()
  return trimmed && !TECHNICAL_ERROR_PATTERN.test(trimmed) ? trimmed : fallback
}
