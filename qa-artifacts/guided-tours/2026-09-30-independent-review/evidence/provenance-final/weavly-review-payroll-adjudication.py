import pathlib,json
root=pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas')
out=root/'scratch/browser-verification'
targets={'pr-settle','pr-paid','pr-complete','pra-advance','pra-deduction','pra-correct'}
proof=[]
def intersects(a,b):
    return min(a['x']+a['w'],b['x']+b['w'])>max(a['x'],b['x']) and min(a['y']+a['h'],b['y']+b['h'])>max(a['y'],b['y'])
for row in json.loads((out/'gt10-paint-results.json').read_text()):
    for capture in json.loads((out/'runs'/row['id']/'paint.json').read_text()):
        if capture.get('step') not in targets: continue
        rail=capture['rail']; dialog=capture['dialog']; highlight=capture['highlight']
        children=[child['rect'] for child in capture['railChildren']]
        assert rail['background']=='rgba(0, 0, 0, 0)' and int(rail['zIndex'])<int(dialog['zIndex'])
        assert not any(intersects(child,highlight['rect']) for child in children)
        proof.append(dict(run=row['id'],step=capture['step'],railRect=rail['rect'],railBackground=rail['background'],railZ=rail['zIndex'],dialogZ=dialog['zIndex'],paintedChildren=children,targetRect=highlight['rect'],screenshot=capture['path'],visualOcclusion=False))
assert len(proof)==6
result=dict(task='GT-10',adjudication='Numeric aside bounding-box flags are harness false positives in these six captured states',proof=proof,rawFailuresPreserved=True,assertionsUnchanged=True,hitTestingLimitation='elementsFromPoint returns the tour portal under inert isolation; it is not treated as paint visibility evidence',baselineAnalytics='One blocked pre-tour production_viewed POST per fixture mount; no tour-induced increment',livePopulatedPayroll='UNVERIFIED',humanGates='UNVERIFIED')
(out/'gt10-paint-adjudication.json').write_text(json.dumps(result,indent=2))
print(json.dumps({'proofSteps':len(proof),'artifact':'gt10-paint-adjudication.json'}))
