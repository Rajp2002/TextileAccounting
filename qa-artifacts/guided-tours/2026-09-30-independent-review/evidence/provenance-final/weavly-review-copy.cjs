const fs=require('fs'),path=require('path'),Module=require('module');
const root='/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas';
const ts=require(path.join(root,'node_modules/typescript'));
const resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){return resolve.call(this,name.startsWith('@/')?path.join(root,name.slice(2)):name,parent,...rest)};
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const files={
 'saved-costings':['saved-costings-tutorial','savedCostingsTutorialCopy'],
 'cost-estimator':['cost-estimate-tutorial','costEstimateTutorialCopy'],
 'rate-book':['rate-book-tutorial','rateBookTutorialCopy'],
 'dispatches':['dispatch-tutorial','dispatchTutorialCopy'],
 'fabric-stock':['stock-tutorial','fabricStockTutorialCopy'],
 'yarn-stock':['stock-tutorial','yarnStockTutorialCopy'],
 'payroll':['payroll-tutorial','payrollTutorialCopy'],
 'production':['production-tutorial','productionTutorialCopy'],
 'daily-sheet':['daily-sheet-tutorial','dailySheetTutorialCopy'],
 'machines':['machines-tutorial','machinesTutorialCopy'],
 'workers':['workers-tutorial','workersTutorialCopy'],
 'machine-assignments':['configuration-tutorial','configurationTutorialCopy'],
};
const flatten=(value,prefix='',out={})=>{for(const[k,v]of Object.entries(value)){const key=prefix?prefix+'.'+k:k;if(typeof v==='string')out[key]=v;else if(v&&typeof v==='object')flatten(v,key,out);}return out;};
const results={};
const invitations=require(path.join(root,'lib/i18n/tour-invitations.ts')).tourInvitationCopy;
const invitationId={'machine-assignments':'configuration','dispatches':'dispatch','cost-estimator':'cost-estimate'};
function sourceKey(page,key){
 if(page==='payroll'){
  if(key==='guide.benefit')return 'benefit';
  if(key.startsWith('calculation.'))return key;
  if(key.startsWith('extra.handoff.'))return key.replace('extra.handoff.','steps.pra-handoff.');
  const extra=['advance','deduction','records','export','correct'];
  return 'steps.'+(extra.includes(key.split('.')[0])?'pra-':'pr-')+key;
 }
 if(page==='workers')return 'steps.'+key;
 if(page==='machine-assignments')return key.startsWith('handoff.empty.')?key.replace('handoff.empty.','emptyHandoff.'):'steps.ma-'+key;
 return key;
}
for(const page of process.argv.slice(2)){
 const [file,exportName]=files[page];
 const actual=require(path.join(root,'lib/i18n',file+'.ts'))[exportName];
 const rows=fs.readFileSync(path.join(root,'docs/guided-tours/pages',page+'.md'),'utf8').split('\n');
 const matches=[],mismatches=[],unmatched=[];
 for(const line of rows){
  const cells=line.split('|').slice(1,-1).map(s=>s.trim());
  if(cells.length!==4||!/^`[^`]+`$/.test(cells[0]))continue;
  const key=cells[0].slice(1,-1);
  if(!/title|body|detail|benefit|unavailable/.test(key))continue;
  for(const[lang,i]of [['en',1],['gu',2],['hi',3]]){
   const flat=flatten(actual[lang]);
   const source=sourceKey(page,key);
   const value=key==='guide.benefit'?invitations[lang].benefits[invitationId[page]||page]:flat[source];
   if(value===undefined){unmatched.push({key,source,lang,expected:cells[i]});continue;}
   const result={key,source,lang,expected:cells[i],actual:value};
   (cells[i]===value?matches:mismatches).push(result);
  }
 }
 results[page]={matched:matches.length,mismatches,unmatched,spotChecks:matches.filter((row,i)=>matches.filter(x=>x.lang===row.lang).indexOf(row)<5)};
}
fs.writeFileSync(path.join(root,'scratch/browser-verification/copy-alias-resolved-'+process.argv.slice(2).join('_')+'.json'),JSON.stringify(results,null,2));
for(const[page,r]of Object.entries(results))console.log(JSON.stringify({page,matched:r.matched,mismatches:r.mismatches,unmatched:r.unmatched.length,spotChecks:r.spotChecks}));
