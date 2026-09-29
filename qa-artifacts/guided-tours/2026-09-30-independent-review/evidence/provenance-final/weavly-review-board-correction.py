import pathlib
root = pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas')
path = root / 'docs/guided-tours/EXECUTION_STATUS.md'
lines = path.read_text().splitlines()
changed = []
for index, line in enumerate(lines):
    cells = line.split('|')
    if len(cells) != 8:
        continue
    if cells[2].strip().startswith('GT-05 '):
        cells[3] = ' FAILED '
        cells[5] = ' 2026-09-30 '
        cells[6] = ' BV-01 Major phone Save anchor; independent review below '
        changed.append('GT-05')
    elif cells[2].strip().startswith('GT-07 '):
        cells[5] = ' 2026-09-30 '
        cells[6] = ' Independent 20-run matrix complete; human gates UNVERIFIED below '
        changed.append('GT-07')
    lines[index] = '|'.join(cells)
assert changed == ['GT-05', 'GT-07'], changed
path.write_text('\n'.join(lines) + '\n')
print(changed)
