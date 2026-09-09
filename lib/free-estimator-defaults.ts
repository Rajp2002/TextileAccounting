import { makeDefaultEstimateState, type EstimateState } from './estimator'
/** Technical defaults only. No tenant profile, saved rates, or commercial prefill. */
export function makeFreeEstimate(): EstimateState {
  return { ...makeDefaultEstimateState(), warpCrimpPct:0, overheadItems:[], overheadMode:'direct', overheadOverridePerM:null,
    enabledSections:{winding:false,processing:false,finishing:false,commission:false,transport:false} }
}
/** DNO252 manual fixture from __tests__/estimator.test.ts. Illustrative historical sample only. */
export function makeFreeDemo(): EstimateState {
  return { ...makeFreeEstimate(), yarnShortagePct:10, overheadOverridePerM:21.5, monthlyOutputM:10000,
    warpRows:[{id:'sample-warp-1',label:'50/600',calculationMode:'manual',manualKgPer100m:3.8,calcDenier:50.6,beamEnds:6200,yarnRate:191,gstPct:0,shortagePct:null},
      {id:'sample-warp-2',label:'Jari',calculationMode:'manual',manualKgPer100m:3.3,calcDenier:0,beamEnds:0,yarnRate:340,gstPct:0,shortagePct:null}],
    weftRows:[{id:'sample-weft',label:'40 spun',calculationMode:'manual',manualKgPer100m:6.5,picks:0,reedSpace:0,calcDenier:0,yarnRate:197,gstPct:0,shortagePct:null}] }
}
