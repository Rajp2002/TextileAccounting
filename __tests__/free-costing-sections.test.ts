import {describe,expect,it} from 'vitest'
import {makeFreeDemo,makeFreeEstimate} from '@/lib/free-estimator-defaults'
import {validateEstimatorSnapshot,requiresFactoryCapacity} from '@/lib/estimator-validation'
import {getFreeCostingSections} from '@/lib/free-costing-sections'

const validEstimate=()=>{
  const state=makeFreeDemo();state.weftRows[0].picks=60;state.perPickCostPaisa=13.75
  return state
}
const check=(state=validEstimate(),label='Test quality',acknowledged=false)=>getFreeCostingSections(
  validateEstimatorSnapshot(state,{requireTapeLength:false,requireCapacity:requiresFactoryCapacity(state)}),label,acknowledged,
)
describe('Free input section checklist',()=>{
  it('marks required blank sections incomplete without requiring optional charges',()=>{
    const sections=check(makeFreeEstimate(),'')
    expect(sections.filter(section=>section.status==='incomplete').map(section=>section.id)).toEqual(['details','warp','weft','weaving','overhead'])
    expect(sections.filter(section=>section.status==='complete').map(section=>section.id)).toEqual(['preparation','processing','pricing'])
  })
  it('accepts complete costing inputs without requiring a saved result',()=>{
    expect(check().every(section=>section.status==='complete')).toBe(true)
    expect(check(makeFreeDemo(),'   ').find(section=>section.id==='details')).toMatchObject({status:'incomplete',field:'qualityLabel'})
  })
  it('targets the incomplete row even when earlier components are complete',()=>{
    const state=validEstimate()
    state.weftRows.push({...state.weftRows[0],id:'second-weft',yarnRate:0})
    expect(check(state).find(section=>section.id==='weft')).toMatchObject({status:'incomplete',field:'weftRows.1.yarnRate'})
  })
  it('marks enabled optional charges and monthly output as needing input when required',()=>{
    const state=validEstimate()
    state.enabledSections={...state.enabledSections,processing:true}
    state.processingRatePerM=0
    state.overheadMode='monthly_expenses';state.monthlyOutputM=0
    expect(check(state).find(section=>section.id==='processing')).toMatchObject({status:'incomplete',field:'processingRatePerM'})
    expect(check(state).find(section=>section.id==='overhead')?.status).toBe('incomplete')
  })
  it('distinguishes unusual values from missing inputs until they are acknowledged',()=>{
    const state=validEstimate();state.warpRows[0].yarnRate=20000
    expect(check(state).find(section=>section.id==='warp')?.status).toBe('review')
    expect(check(state,'Test quality',true).find(section=>section.id==='warp')?.status).toBe('complete')
    state.warpRows[0].yarnRate=0
    expect(check(state,'Test quality',true).find(section=>section.id==='warp')?.status).toBe('incomplete')
  })
})
