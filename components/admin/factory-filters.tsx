'use client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { FactoryFilters } from '@/lib/admin/metrics'

function Filter({ name, label, value, options }: { name: string; label: string; value: string; options: [string, string][] }) {
    return <div className="min-w-40 flex-1"><label htmlFor={`factory-${name}`} className="mb-2 block text-xs font-medium text-subtle">{label}</label>
        <Select name={name} defaultValue={value}><SelectTrigger id={`factory-${name}`} className="h-11 w-full bg-surface"><SelectValue/></SelectTrigger>
            <SelectContent>{options.map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent></Select></div>
}
export function FactoryFiltersForm({ filters }: { filters: Omit<FactoryFilters, 'cursor'> }) {
    return <form action="/admin/factories" method="get" className="flex flex-wrap items-end gap-3 border-b border-hairline p-4 sm:p-5">
        <div className="min-w-56 flex-[2]"><label htmlFor="factory-search" className="mb-2 block text-xs font-medium text-subtle">Find a factory</label>
            <Input id="factory-search" name="search" defaultValue={filters.search} maxLength={120} className="h-11 bg-surface" placeholder="Name, ID, verified email or payment reference"/></div>
        <Filter name="cohort" label="Reporting group" value={filters.cohort} options={[
            ['production', 'Production'], ['unclassified', 'Unclassified'], ['test', 'Test'], ['demo', 'Demo'], ['internal', 'Internal'], ['all', 'All groups'],
        ]}/>
        <Filter name="plan" label="Effective access" value={filters.plan} options={[
            ['all', 'All access'], ['free', 'Free'], ['lite', 'Lite'], ['base', 'Base'], ['none', 'No access'], ['unknown', 'Unknown'],
        ]}/>
        <Filter name="paidTerm" label="Verified live paid term" value={filters.paidTerm} options={[
            ['all', 'All terms'], ['lite', 'Current Lite'], ['base', 'Current Base'], ['expiring', 'Due within 30 days'], ['no_evidenced_term', 'No evidenced current term'],
        ]}/>
        <Filter name="lifecycle" label="Write / identity state" value={filters.lifecycle} options={[
            ['all', 'All states'], ['locked', 'Business writes locked'], ['revoked', 'Owner revoked'], ['unlocked', 'Business writes unlocked'],
        ]}/>
        <Filter name="activation" label="Observed milestone" value={filters.activation} options={[
            ['all', 'All records'], ['estimator_observed', 'Original costing observed'], ['production_observed', 'Production observed'], ['not_observed', 'Neither observed'],
        ]}/>
        <Filter name="sort" label="Order" value={filters.sort} options={[
            ['joined_desc', 'Newest factory first'], ['name_asc', 'Factory name'],
        ]}/>
        <input type="hidden" name="limit" value={filters.limit}/><Button type="submit" className="h-11 bg-ink text-surface">Apply filters</Button>
    </form>
}
