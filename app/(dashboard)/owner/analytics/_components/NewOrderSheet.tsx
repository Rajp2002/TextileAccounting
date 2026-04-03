'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Loader2, Plus, CalendarIcon, ChevronDown } from 'lucide-react'
import { format, isBefore, startOfDay, addDays } from 'date-fns'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { getSuratTodayString } from '@/lib/time'
import { createFlatOrder } from '../../orders/actions'

// ─── Schema (lean flat-order, no quality_id) ─────────────────────────────────

const NewOrderSchema = z.object({
  party_name:          z.string().min(2, 'Party name is required').max(120),
  quality_label:       z.string().min(1, 'Fabric type is required').max(80),
  warp_instruction:    z.string().max(200).optional(),
  weft_instruction:    z.string().max(200).optional(),
  total_target_meters: z.coerce.number().positive('Must be greater than 0'),
  deadline:            z.string().refine(d => new Date(d) > new Date(), 'Deadline must be in the future'),
})

type NewOrderValues = z.infer<typeof NewOrderSchema>

// ─── Component ────────────────────────────────────────────────────────────────

export function NewOrderSheet({
  onSuccess,
  trigger,
}: {
  onSuccess?: () => void
  /** Optional custom trigger element. Defaults to a "New Order" button. */
  trigger?: React.ReactNode
}) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const form = useForm<NewOrderValues>({
    resolver: zodResolver(NewOrderSchema) as any,
    defaultValues: {
      party_name:          '',
      quality_label:       '',
      warp_instruction:    '',
      weft_instruction:    '',
      total_target_meters: undefined,
      deadline:            '',
    },
  })

  const onSubmit = async (values: NewOrderValues) => {
    setLoading(true)
    try {
      const res = await createFlatOrder({
        party_name:          values.party_name,
        quality_label:       values.quality_label,
        warp_instruction:    values.warp_instruction || undefined,
        weft_instruction:    values.weft_instruction || undefined,
        total_target_meters: values.total_target_meters,
        start_date:          getSuratTodayString(),
        deadline:            values.deadline,
      })
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success('Order created! Your supervisor can now log production.')
      setOpen(false)
      form.reset()
      setShowAdvanced(false)
      onSuccess?.()
    } catch {
      toast.error('Failed to create order. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button className="font-semibold gap-2 shadow-sm">
            <Plus size={18} />
            New Order
          </Button>
        )}
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col h-full rounded-l-[2.5rem] border-l-0 shadow-2xl p-0 overflow-hidden"
      >
        <div className="flex-1 flex flex-col p-8 sm:p-10 overflow-y-auto">
          <SheetHeader className="mb-8 text-left">
            <SheetTitle className="text-3xl font-bold tracking-tight">New Order</SheetTitle>
            <SheetDescription className="text-base text-muted-foreground/80 mt-2">
              Add core details to start tracking production pace and deadlines.
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col">
              <div className="space-y-6 flex-1">

                {/* Party Name */}
                <FormField
                  control={form.control}
                  name="party_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Party Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Reliance Textiles"
                          {...field}
                          className="h-12 rounded-2xl bg-muted/30 border-muted/20 focus-visible:bg-background px-4 text-base"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Fabric / Quality Label */}
                <FormField
                  control={form.control}
                  name="quality_label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Fabric Type</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. 60g Georgette, Japan Satin…"
                          {...field}
                          className="h-12 rounded-2xl bg-muted/30 border-muted/20 focus-visible:bg-background px-4 text-base"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Target Meters */}
                <FormField
                  control={form.control}
                  name="total_target_meters"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Target Meters</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g. 5000"
                          {...field}
                          className="h-12 rounded-2xl bg-muted/30 border-muted/20 focus-visible:bg-background px-4 text-base"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Deadline */}
                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Deadline</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full h-12 rounded-2xl bg-muted/30 border-muted/20 pl-4 text-left font-normal hover:bg-muted/40',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value
                                ? format(new Date(field.value), 'PPP')
                                : <span>Pick a date</span>
                              }
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-3xl overflow-hidden" align="start">
                          <Calendar
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => date && field.onChange(format(date, 'yyyy-MM-dd'))}
                            disabled={(date) => isBefore(date, startOfDay(addDays(new Date(), 1)))}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Advanced: Warp/Weft instructions */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(v => !v)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
                  >
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showAdvanced && 'rotate-180')} />
                    {showAdvanced ? 'Hide' : 'Add'} warp / weft instructions
                  </button>

                  {showAdvanced && (
                    <div className="mt-4 space-y-4">
                      <FormField
                        control={form.control}
                        name="warp_instruction"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">Warp Instruction</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. 120/2 White PE"
                                {...field}
                                className="h-11 rounded-2xl bg-muted/30 border-muted/20 focus-visible:bg-background px-4 text-sm"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="weft_instruction"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">Weft Instruction</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. 75D/36F Black"
                                {...field}
                                className="h-11 rounded-2xl bg-muted/30 border-muted/20 focus-visible:bg-background px-4 text-sm"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-8 mt-6 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 rounded-full text-base font-semibold border-muted/30 hover:bg-muted/20"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-12 rounded-full text-base font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Order
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
