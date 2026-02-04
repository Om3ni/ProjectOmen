#!/usr/bin/env python3
from pathlib import Path
import re

old_lines = Path('../rpr.txt').read_text(encoding='utf-8').splitlines()
new_lines = Path('../rprdiff.txt').read_text(encoding='utf-8').splitlines()

# Build old SkillDef id->name and name->id
skill_old_by_name = {}
skill_old_by_id = {}
for line in old_lines:
    parts = line.split('|')
    if parts[0] == 'SkillDef' and len(parts) > 3:
        try:
            idv = int(parts[2])
        except:
            continue
        name = parts[3].strip()
        skill_old_by_name[name] = idv
        skill_old_by_id[idv] = name

# Build new SkillDef name->id and id->name
skill_new_by_name = {}
skill_new_by_id = {}
for line in new_lines:
    parts = line.split('|')
    if parts[0] == 'SkillDef' and len(parts) > 3:
        try:
            idv = int(parts[2])
        except:
            continue
        name = parts[3].strip()
        skill_new_by_name[name] = idv
        skill_new_by_id[idv] = name

# Build mapping oldId -> newId for skills with same name
remap = {}
for name, oldId in skill_old_by_name.items():
    newId = skill_new_by_name.get(name)
    if newId is not None and newId != oldId:
        remap[oldId] = newId

# Now scan new_lines for occurrences of any oldId
stale_refs = []
pattern_cache = {old: re.compile(r'\b' + re.escape(str(old)) + r'\b') for old in remap}
for lineno, line in enumerate(new_lines, start=1):
    for old, new in remap.items():
        if pattern_cache[old].search(line):
            stale_refs.append((lineno, old, new, line))

# Summarize
out = []
out.append(f'Found {len(remap)} remapped Skill IDs (old->new).')
for old, new in sorted(remap.items()):
    out.append(f'  {old} -> {new} ({skill_old_by_id.get(old,"?")} )')

out.append('')
out.append(f'Found {len(stale_refs)} occurrences of old Skill IDs inside rprdiff (should be zero).')
if stale_refs:
    out.append('Examples:')
    for ln, old, new, line in stale_refs[:200]:
        out.append(f'Line {ln}: contains old={old} (maps to {new}): {line}')

Path('tools/check_skill_references_summary.txt').write_text('\n'.join(out), encoding='utf-8')
print('\n'.join(out))
print('\nWrote tools/check_skill_references_summary.txt')
