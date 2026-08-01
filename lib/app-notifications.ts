import { toast as sonnerToast } from 'sonner'

type ToastMessage = Parameters<typeof sonnerToast.success>[0]
type ToastOptions = Parameters<typeof sonnerToast.success>[1]

const defaultOptions: NonNullable<ToastOptions> = {
  duration: 4200,
  closeButton: true,
}

function withDefaults(options?: ToastOptions) {
  return { ...defaultOptions, ...options }
}

/**
 * Base UX notification wrapper. Keeping the Sonner API behind this module
 * gives every customer-facing message the same duration and close affordance.
 */
export const toast = {
  success(message: ToastMessage, options?: ToastOptions) {
    return sonnerToast.success(message, withDefaults(options))
  },
  error(message: ToastMessage, options?: ToastOptions) {
    return sonnerToast.error(message, withDefaults(options))
  },
  info(message: ToastMessage, options?: ToastOptions) {
    return sonnerToast.info(message, withDefaults(options))
  },
  warning(message: ToastMessage, options?: ToastOptions) {
    return sonnerToast.warning(message, withDefaults(options))
  },
}
