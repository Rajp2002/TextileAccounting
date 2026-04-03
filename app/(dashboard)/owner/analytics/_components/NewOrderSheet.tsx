'use client'

import { useState, useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Loader2, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Calendar as CalendarIcon } from 'lucide-react'
import { format, isBefore, startOfDay } from 'date-fns'
import { getQualities, createOrder } from '../../actions/dashboard'
import { toast } from 'sonner'
import { getSuratTodayString } from '@/lib/time'
import { SubmitHandler } from 'react-hook-form'
import { cn } from '@/lib/utils'

const NewOrderSchema = z.object({
  party_name: z.string().min(2, 'Party name required').max(120),
  quality_id: z.string().uuid('Select a quality'),
  total_target_meters: z.coerce.number().positive('Must be greater than 0'),
  deadline: z.string().refine(
    d => new Date(d) > new Date(),
    'Deadline must be in the future'
  ),
})

type NewOrderValues = z.infer<typeof NewOrderSchema>

export function NewOrderSheet({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false)
  const [qualities, setQualities] = useState<{ id: string, name: string }[]>([])
  const [loading, setLoading] = useState(false)

  const form = useForm<any>({
    resolver: zodResolver(NewOrderSchema) as any,
    defaultValues: {
      party_name: '',
      quality_id: '',
      total_target_meters: 0,
      deadline: '',
    },
  })

  useEffect(() => {
    if (open) {
      getQualities().then(setQualities).catch(err => {
        console.error('Failed to fetch qualities', err)
        toast.error('Could not load qualities')
      })
    }
  }, [open])

  const onSubmit: SubmitHandler<NewOrderValues> = async (values) => {
    setLoading(true)
    try {
      await createOrder(values)
      toast.success('Order created successfully')
      setOpen(false)
      form.reset()
      onSuccess?.()
    } catch (err) {
      console.error('Failed to create order', err)
      toast.error('Failed to create order. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="font-semibold gap-2 shadow-sm">
          <Plus size={18} />
          New Order
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col h-full rounded-l-[2.5rem] border-l-0 shadow-2xl p-0 overflow-hidden">
        <div className="flex-1 flex flex-col p-8 sm:p-10">
          <SheetHeader className="mb-10 text-left">
            <SheetTitle className="text-3xl font-bold tracking-tight">Create New Order</SheetTitle>
            <SheetDescription className="text-base text-muted-foreground/80 mt-2">
              Add essential details to start tracking production pace and deadlines.
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col">
              <div className="space-y-8 flex-1 overflow-y-auto pr-1">
                <FormField
                  control={form.control}
                  name="party_name"
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Party Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g. Reliance Textiles" 
                          {...field} 
                          className="h-12 rounded-2xl bg-muted/30 border-muted/20 focus-visible:bg-background transition-all px-4 text-base"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quality_id"
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Quality</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 rounded-2xl bg-muted/30 border-muted/20 focus-visible:bg-background transition-all px-4 text-base">
                            <SelectValue placeholder="Select quality" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {qualities.map(q => (
                            <SelectItem key={q.id} value={q.id}>
                              {q.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="total_target_meters"
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Total Target Meters</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          {...field} 
                          className="h-12 rounded-2xl bg-muted/30 border-muted/20 focus-visible:bg-background transition-all px-4 text-base"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Deadline</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full h-12 rounded-2xl bg-muted/30 border-muted/20 pl-4 text-left font-normal transition-all hover:bg-muted/40",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-3xl overflow-hidden" align="start">
                          <Calendar
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(format(date, 'yyyy-MM-dd'))}
                            disabled={(date) => isBefore(date, startOfDay(new Date()))}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex gap-4 pt-8 mt-auto border-t border-border/40">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1 h-12 rounded-full text-base font-semibold border-muted/30 hover:bg-muted/20 transition-all"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 h-12 rounded-full text-base font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all" disabled={loading}>
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
