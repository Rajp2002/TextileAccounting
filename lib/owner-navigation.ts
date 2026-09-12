import { Archive, BarChart3, Calculator, ClipboardList, CreditCard, DollarSign, Factory, FileText, HandCoins, Package, Settings, SlidersHorizontal, Store, Tags, Truck, Users, Warehouse, Wrench, type LucideIcon } from 'lucide-react'
import { resolveStockKind } from './stock-navigation'
import { hasCapability, type PlanCapability, type SubscriptionTier } from './subscription-access'
import { isWorkflowVisible, type ProductionMode, type WorkflowKey } from './production-mode'

type Context = { tier: SubscriptionTier; productionMode: ProductionMode }
export type OwnerNavigationItem = {
 id: string; translationKey: string; name: string; icon: LucideIcon; section: 'costing' | 'production_stock' | 'workforce' | 'utilities'; order: number;
 route: (context: Context) => string; active: (pathname: string, href: string) => boolean; allowed: (context: Context) => boolean
}
export function ownerRouteActive(pathname: string, href: string) {
 const path = href.split(/[?#]/)[0]
 return pathname === path || path !== '/free' && pathname.startsWith(`${path}/`)
}
const baseWorkflow = ({ tier, productionMode }: Context) => hasCapability(tier, 'legacy_full_suite') ? isWorkflowVisible(productionMode, 'baseProduction') : hasCapability(tier, 'production_management')
const capability = (value: PlanCapability) => ({ tier }: Context) => hasCapability(tier, value)
const legacy = (workflow: WorkflowKey) => ({ tier, productionMode }: Context) => hasCapability(tier, 'legacy_full_suite') && isWorkflowVisible(productionMode, workflow)
function item(id: string, name: string, path: string, icon: LucideIcon, section: OwnerNavigationItem['section'], order: number, allowed: OwnerNavigationItem['allowed'], freePath?: string): OwnerNavigationItem {
 return { id, name, translationKey: `navigation.${id}`, route: ({ tier }) => tier === 'free' && freePath ? freePath : hasCapability(tier, 'legacy_full_suite') && id === 'machines' ? '/owner/machines' : hasCapability(tier, 'legacy_full_suite') && id === 'workers' ? '/owner/fixed-workers' : path, icon, section, order, active: id === 'stock' ? pathname => resolveStockKind(pathname) !== null : ownerRouteActive, allowed }
}
export const ownerNavigation: OwnerNavigationItem[] = [
 item('estimate', 'Cost Estimate', '/owner/estimator', Calculator, 'costing', 0, capability('estimator'), '/free'),
 item('costings', 'Saved Costings', '/owner/quotes', FileText, 'costing', 1, capability('saved_costings'), '/free/costings'),
 item('rates', 'Yarn Rate Book', '/owner/rates', Tags, 'costing', 2, capability('rate_book')),
 item('production', 'Production', '/owner/production', ClipboardList, 'production_stock', 0, baseWorkflow),
 item('assignments', 'Machine Assignments', '/owner/assignments', SlidersHorizontal, 'production_stock', 1, baseWorkflow),
 item('stock', 'Stock', '/owner/stock', Warehouse, 'production_stock', 2, ({tier, productionMode}) => hasCapability(tier, 'legacy_full_suite') ? isWorkflowVisible(productionMode, 'stock') : hasCapability(tier, 'production')),
 item('dispatches', 'Dispatches', '/owner/dispatches', Truck, 'production_stock', 3, ({tier, productionMode}) => hasCapability(tier, 'legacy_full_suite') ? isWorkflowVisible(productionMode, 'dispatches') : hasCapability(tier, 'production')),
 item('machines', 'Machines', '/owner/machines?register=base', Wrench, 'production_stock', 4, ({ tier, productionMode }) => hasCapability(tier, 'legacy_full_suite') ? isWorkflowVisible(productionMode, 'looms') : hasCapability(tier, 'production_management')),
 item('workers', 'Workers', '/owner/workers', Users, 'workforce', 0, ({ tier, productionMode }) => hasCapability(tier, 'legacy_full_suite') ? isWorkflowVisible(productionMode, 'workers') : hasCapability(tier, 'production_management')),
 item('payroll', 'Payroll', '/owner/payroll', DollarSign, 'workforce', 1, ({tier, productionMode}) => hasCapability(tier, 'legacy_full_suite') ? isWorkflowVisible(productionMode, 'payroll') : hasCapability(tier, 'production')),
 // Retain legitimate full-suite workflow access; these use a separate historical data model.
 item('today', 'Factory Today', '/owner/today', Factory, 'production_stock', 10, legacy('productionLogging')),
 item('orders', 'Party Orders', '/owner/orders', Package, 'production_stock', 11, legacy('orders')),
 item('market_runs', 'Market Runs', '/owner/market-runs', Store, 'production_stock', 12, legacy('marketRuns')),
 item('analytics', 'Analytics', '/owner/analytics', BarChart3, 'production_stock', 13, legacy('ownerAnalytics')),
 item('advances', 'Upaad', '/owner/advances', HandCoins, 'workforce', 11, legacy('advances')),
 item('commercials', 'Party Ledger', '/owner/commercials', DollarSign, 'workforce', 12, legacy('commercials')),
 item('archive', 'Archive', '/owner/archive', Archive, 'utilities', 0, legacy('archive')),
 item('settings', 'Settings', '/owner/settings', Settings, 'utilities', 1, capability('account_settings'), '/free/account'),
 item('billing', 'Plan & Billing', '/owner/billing', CreditCard, 'utilities', 2, ({ tier }) => tier !== 'none', '/free/billing'),
]
export function visibleOwnerNavigation(context: Context) {
 return (['costing', 'production_stock', 'workforce', 'utilities'] as const).map(id => ({
  id, translationKey: `navigation.sections.${id}`,
  items: ownerNavigation.filter(item => item.section === id && item.allowed(context)).sort((a,b) => a.order - b.order).map(item => ({ ...item, href: item.route(context) })),
 })).filter(group => group.items.length)
}
