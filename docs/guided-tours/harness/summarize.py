import json,sys,glob
for f in sorted(glob.glob('out/*/record.json')):
    r=json.load(open(f)); steps=r['steps']
    if 'after' not in r: print(f.split('/')[1], 'ERROR', r.get('error'), r['logs'][:3]); continue
    issues=[]
    for i,s in enumerate(steps,1):
        if s['overlapArea']>0: issues.append(f"s{i} overlap={s['overlapArea']}")
        if s['panelOffscreen']: issues.append(f"s{i} panel-offscreen")
        if s['highlight'] is None: issues.append(f"s{i} NO-HIGHLIGHT")
        if s['descriptionScrollable']: issues.append(f"s{i} desc-scrolls")
        hl=s['highlight']
        vh=s.get('vh',900)
        if hl and (hl['y']+hl['h']<=0 or hl['y']>=vh): issues.append(f"s{i} TARGET-OFFSCREEN y={hl['y']}")
        elif hl and (hl['y']<0 or hl['y']+hl['h']>vh): issues.append(f"s{i} target-clipped")
        rl=s.get('rail')
        if hl and rl:
            ov=max(0,min(rl['x']+rl['w'],hl['x']+hl['w'])-max(rl['x'],hl['x']))*max(0,min(rl['y']+rl['h'],hl['y']+hl['h'])-max(rl['y'],hl['y']))
            if ov>0: issues.append(f"s{i} rail-rect-intersects(check screenshot)")
    corners=[(s['panel']['x']>500, s['panel']['y']>100) for s in steps if s['panel']]
    jumps=sum(1 for a,b in zip(corners,corners[1:]) if a!=b)
    print(f.split('/')[1], f"steps={len(steps)} panelCornerChanges={jumps} serverCalls={len(r['after']['serverCalls'])} nav={len(r['after']['navigations'])}", '; '.join(issues) or 'no geometry issues')
