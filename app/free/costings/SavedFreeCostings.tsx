'use client'
import {useEffect,useState} from 'react'
import type {EstimateState,EstimatorV3Totals,CostingResultSnapshot} from '@/lib/estimator'
import {createCostingExportModel} from '@/lib/estimator-export'
import {CostingExportDialog} from '@/components/estimator/CostingExportDialog'
import {Button} from '@/components/ui/button'
import {useTranslation} from '@/lib/i18n/context'
import {freeText} from '@/lib/i18n/free-tier'

type Saved={id:string;label:string;created_at:string;estimate:EstimateState;result:CostingResultSnapshot;totals:EstimatorV3Totals}
export default function SavedFreeCostings(){
 const {language,tx}=useTranslation(),[rows,setRows]=useState<Saved[]>([]),[selected,setSelected]=useState<Saved|null>(null),[error,setError]=useState(false),[loading,setLoading]=useState(true),[nextPage,setNextPage]=useState<number|null>(null)
 useEffect(()=>{let active=true;fetch('/api/free/costings',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{if(active){setRows(data.costings);setNextPage(data.nextPage)}}).catch(()=>{if(active)setError(true)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[])
 async function loadMore(){if(nextPage===null)return;setLoading(true);setError(false);try{const r=await fetch(`/api/free/costings?page=${nextPage}`,{cache:'no-store'});if(!r.ok)throw Error();const data=await r.json();setRows(current=>[...current,...data.costings]);setNextPage(data.nextPage)}catch{setError(true)}finally{setLoading(false)}}
 return <section className="space-y-5" data-free-costing data-sentry-block><h1 className="text-2xl font-semibold">{freeText(language,'savedCostings')}</h1><p>{tx('View and export your completed costings without using your weekly allowance. These are fixed snapshots, not reusable saved qualities.')}</p>{loading&&<p role="status">{tx('Loading…')}</p>}{error&&<p role="alert">{tx('Unable to load saved costings. Please refresh.')}</p>}{!loading&&!error&&!rows.length&&<p>{tx('No saved costings yet. Complete a calculation in Cost Estimate to save your first costing.')}</p>}
 <div className="space-y-3">{rows.map(row=><article key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4"><div><h2 className="font-semibold">{row.label}</h2><p>{new Intl.DateTimeFormat(`${language}-IN`,{dateStyle:'medium',timeZone:'Asia/Kolkata'}).format(new Date(row.created_at))} · ₹{row.result.productionCostPerM.toFixed(2)}/m</p></div><Button variant="outline" onClick={()=>setSelected(row)}>{tx('View breakdown / Export')}</Button></article>)}</div>
 {nextPage!==null&&<Button variant="outline" disabled={loading} onClick={()=>void loadMore()}>{tx('Load more')}</Button>}
 <CostingExportDialog open={!!selected} onOpenChange={open=>{if(!open)setSelected(null)}} model={selected?createCostingExportModel({qualityLabel:selected.label,state:selected.estimate,totals:selected.totals,result:selected.result}):null} sourceRecordKind="costing" documentReference={selected?.id}/>
 </section>
}
