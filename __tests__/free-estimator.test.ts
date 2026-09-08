import { describe,it,expect } from 'vitest'
import { makeFreeEstimate,makeFreeDemo } from '../lib/free-estimator-defaults'
import { parseFreeEstimate,canonicalFreeInputs } from '../lib/free-estimator-input'
import { calcFullTotals,buildCostingResult } from '../lib/estimator'
import { freeText } from '../lib/i18n/free-tier'
import { isFreeTelemetryEvent,isFreeTelemetryPath } from '../lib/free-telemetry'
import { freeJsonBody } from '../lib/free-http'
describe('Free engine boundary',()=>{
 it('starts without paid rates or saved overhead content',()=>{
  const state=makeFreeEstimate();expect(state.warpRows[0].yarnRate).toBe(0);expect(state.weftRows[0].yarnRate).toBe(0);expect(state.overheadItems).toEqual([])
  expect(()=>parseFreeEstimate(state)).toThrow('FREE_INVALID_INPUT')
 })
 it('matches the existing DNO252 manual regression fixture without alternate formulas',()=>{
  const state=makeFreeDemo();const totals=calcFullTotals(state)
  expect(totals.totalProductionCostPerM).toBeCloseTo(55.9113,4)
  expect(buildCostingResult(state,totals)).toEqual(buildCostingResult(state,calcFullTotals(state)))
 })
 it('rejects missing rates, injected persisted metadata and arbitrary demo flags',()=>{
  const state=makeFreeDemo();state.warpRows[0].yarnRate=0;expect(()=>parseFreeEstimate(state)).toThrow()
  expect(()=>parseFreeEstimate({...makeFreeDemo(),demo:true})).toThrow()
  expect(()=>parseFreeEstimate({...makeFreeDemo(),outputSuggestion:{avg30Days:100}})).toThrow()
  expect(()=>parseFreeEstimate({...makeFreeDemo(),overheadItems:[{id:'x',category:'custom',label:'x',monthlyAmount:1,isPreset:false,isLocked:true,source:'derived'}]})).toThrow()
 })
 it('normalizes representation while binding effective changed rates',()=>{
  const a=makeFreeDemo(),b=structuredClone(a);b.warpRows[0].id='new';b.warpRows[0].label='renamed'
  expect(canonicalFreeInputs(a)).toEqual(canonicalFreeInputs(b));b.warpRows[0].yarnRate+=1
  expect(canonicalFreeInputs(a)).not.toEqual(canonicalFreeInputs(b))
 })
 it('keeps units and rounding through the same formula engine',()=>{
  const a=makeFreeEstimate();a.warpRows[0]={...a.warpRows[0],calcDenier:100,beamEnds:4000,yarnRate:200};a.weftRows[0]={...a.weftRows[0],calcDenier:150,picks:60,reedSpace:150,yarnRate:230};a.perPickCostPaisa=.16;a.overheadOverridePerM=21.5;a.profitPct=20;a.orderQuantityM=1000
  const b=parseFreeEstimate(a);expect(calcFullTotals(b)).toEqual(calcFullTotals(a))
  const c=structuredClone(a);c.weftRows[0].effectiveCostingWidthCm=150;c.weftRows[0].reedSpace=140
  expect(canonicalFreeInputs(c)).toEqual(canonicalFreeInputs(a))
 })
})
describe('Free privacy and localization',()=>{
 it('recognizes Free telemetry without excluding similarly named paid pages',()=>{
  expect(isFreeTelemetryPath('/free?mode=detailed')).toBe(true);expect(isFreeTelemetryPath('https://weavly.in/api/free/calculate')).toBe(true)
  expect(isFreeTelemetryEvent({request:{url:'/api/free/calculate'}})).toBe(true);expect(isFreeTelemetryPath('/freedom')).toBe(false)
 })
 it('renders server allowance and India reset placeholders in all supported languages',()=>{
  for(const language of ['en','gu','hi'] as const){expect(freeText(language,'quota',{remaining:1,limit:2})).toContain('1');expect(freeText(language,'quota',{remaining:1,limit:2})).toContain('2');expect(freeText(language,'reset',{date:'9 Sep'})).toContain('9 Sep')}
 })
 it('rejects malformed and over-limit request bodies and foreign origins',async()=>{
  await expect(freeJsonBody(new Request('https://weavly.in/api/free/calculate',{method:'POST',body:'{'}))).rejects.toThrow('FREE_INVALID_INPUT')
  await expect(freeJsonBody(new Request('https://weavly.in/api/free/calculate',{method:'POST',body:'x'.repeat(100001)}))).rejects.toThrow('FREE_INVALID_INPUT')
  await expect(freeJsonBody(new Request('https://weavly.in/api/free/calculate',{method:'POST',headers:{Origin:'https://evil.invalid'},body:'{}'}))).rejects.toThrow('FREE_ACCESS_DENIED')
 })
})
