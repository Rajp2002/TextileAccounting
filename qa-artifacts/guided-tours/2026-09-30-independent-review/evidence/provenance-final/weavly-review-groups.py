import json,pathlib,sys
r=pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas')
o=r/'scratch/browser-verification'
std=[('en','1440x900'),('hi','1280x800'),('en','1024x768'),('gu','390x844')]
def matrix(task,variants):
 jobs=[]
 for index,scenario in enumerate(variants):
  for lang,size in std:jobs.append(dict(id=f'{task}-{index}-{lang}-{size}',task=task[:2].upper()+'-'+task[2:],scenario=scenario,language=lang,size=size))
  jobs.append(dict(id=f'{task}-{index}-reduced-en-1024x768',task=task[:2].upper()+'-'+task[2:],scenario=scenario,language='en',size='1024x768',env={'REDUCED_MOTION':'1'}))
 return jobs
groups={
 'gt07':matrix('gt07',['dispatch','dispatch?populated=1','dispatch?pending=1','dispatch?noStock=1']),
 'gt08':matrix('gt08',['fabric-stock','fabric-stock?populated=1&allOpening=1']),
 'gt09':matrix('gt09',['yarn-stock','yarn-stock?populated=1&unlinked=1']),
 'gt10':matrix('gt10',['payroll','payroll-extra']),
 'gt11':matrix('gt11',['production','production?populated=1']),
 'gt12':matrix('gt12',['daily-sheet','daily-sheet?populated=1']),
 'gt13':matrix('gt13',['machines','machines?populated=1']),
 'gt14':matrix('gt14',['workers','workers-salary','workers?populated=1&search=No%20matching%20retained%20worker&shift=night&status=inactive&worker=11111111-1111-4111-8111-111111111111','workers-salary?populated=1&search=No%20matching%20retained%20staff&shift=night&status=inactive&worker=22222222-2222-4222-8222-222222222222']),
 'gt15':matrix('gt15',['assignments','assignments?populated=1']),
}
for group,scenario,step in [('gt08','fabric-stock?populated=1&allOpening=1',3),('gt09','yarn-stock?populated=1&unlinked=1',3),('gt10','payroll',4),('gt10','payroll-extra',3),('gt11','production?populated=1',4),('gt12','daily-sheet?populated=1',8),('gt13','machines?populated=1',3),('gt15','assignments?populated=1',5)]:
 for lang,size in [('en','1440x900'),('gu','390x844')]:
  groups[group].append(dict(id=f'{group}-exit-{scenario.split("?")[0]}-{lang}-{size}',task='GT-'+group[2:],scenario=scenario,language=lang,size=size,env={'EXIT_AT':str(step)}))
for lang,size in std:
 groups['gt15'].append(dict(id=f'gt15-night-focus-{lang}-{size}',task='GT-15',scenario='assignments?populated=1&shift=night&worker=11111111-1111-4111-8111-111111111111&machine=22222222-2222-4222-8222-222222222222',language=lang,size=size,env={'PRE_TYPE':'No matching retained worker'}))
for group in sys.argv[1:]:
 (o/(group+'-jobs.json')).write_text(json.dumps(groups[group],indent=2))
 print(group,len(groups[group]))
