import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { LedgerParty } from '../actions'
import { partyTypeLabels, getBalanceTone, shortMoney } from '../utils'

interface PartyListProps {
    parties: LedgerParty[]
    search: string
    onSearchChange: (value: string) => void
    showInactive: boolean
    onToggleShowInactive: () => void
    selectedPartyId: string | null
    onSelectParty: (id: string) => void
}

export function PartyList({
    parties,
    search,
    onSearchChange,
    showInactive,
    onToggleShowInactive,
    selectedPartyId,
    onSelectParty,
}: PartyListProps) {
    return (
        <Card className="overflow-hidden border-slate-200/80 shadow-sm flex flex-col h-full">
            <CardHeader className="space-y-4 border-b bg-slate-50/70 shrink-0">
                <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base font-black">Parties</CardTitle>
                    <Badge variant="secondary">{parties.length}</Badge>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                        value={search}
                        onChange={event => onSearchChange(event.target.value)}
                        placeholder="Search party, GSTIN, phone..."
                        className="bg-white pl-9"
                    />
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start px-0 text-xs font-bold text-slate-500 hover:bg-transparent"
                    onClick={onToggleShowInactive}
                >
                    {showInactive ? 'Hide archived parties' : 'Show archived parties'}
                </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[720px] xl:max-h-[800px]">
                {parties.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
                        No parties yet. Add the trader or processor you sell grey fabric to.
                    </div>
                ) : (
                    parties.map(party => {
                        const selected = selectedPartyId === party.id
                        const overLimit = party.credit_limit > 0 && party.outstanding > party.credit_limit
                        return (
                            <button
                                key={party.id}
                                onClick={() => onSelectParty(party.id)}
                                className={cn(
                                    'w-full rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm',
                                    selected ? 'border-teal-400 bg-teal-50/80 shadow-sm' : 'border-slate-200 bg-white',
                                    !party.is_active && 'opacity-60'
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="truncate text-sm font-black text-slate-950">{party.name}</p>
                                            {!party.is_active && <Badge variant="outline">Archived</Badge>}
                                        </div>
                                        <p className="mt-1 text-xs font-semibold text-slate-500">
                                            {partyTypeLabels[party.party_type]}{party.broker_name ? ` · Broker: ${party.broker_name}` : ''}
                                        </p>
                                    </div>
                                    {party.overdue_amount > 0 && (
                                        <Badge className="border-rose-200 bg-rose-50 text-rose-700 shrink-0">
                                            Overdue
                                        </Badge>
                                    )}
                                </div>
                                <div className="mt-4 flex items-end justify-between gap-3">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Outstanding</p>
                                        <p className={cn('mt-1 rounded-full border px-2.5 py-1 text-sm font-black tabular-nums', getBalanceTone(party.outstanding))}>
                                            {shortMoney(Math.abs(party.outstanding))}
                                        </p>
                                    </div>
                                    <div className="text-right text-xs font-bold text-slate-500">
                                        {party.credit_limit > 0 ? `${Math.max(0, party.credit_used_pct ?? 0)}% used` : 'No limit set'}
                                        {overLimit && <p className="mt-1 text-rose-600">Limit crossed</p>}
                                    </div>
                                </div>
                            </button>
                        )
                    })
                )}
            </CardContent>
        </Card>
    )
}
