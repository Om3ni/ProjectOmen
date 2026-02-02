#!/usr/bin/env python3
from pathlib import Path
import re

old = Path('../rpr.txt').read_text(encoding='utf-8').splitlines()
new = Path('../rprdiff.txt').read_text(encoding='utf-8').splitlines()

# Build Skill mapping from old->new by name
old_skills = {}
for line in old:
    parts = line.split('|')
    if parts[0] == 'SkillDef' and len(parts) > 3:
        try:
            old_id = int(parts[2])
        except:
            continue
        name = parts[3].strip()
        old_skills[name] = old_id

new_skills = {}
for line in new:
    parts = line.split('|')
    if parts[0] == 'SkillDef' and len(parts) > 3:
        try:
            new_id = int(parts[2])
        except:
            continue
        name = parts[3].strip()
        new_skills[name] = new_id

# Build oldId -> newId mapping
remap = {}
for name, oid in old_skills.items():
    nid = new_skills.get(name)
    if nid is not None and nid != oid:
        remap[oid] = nid

# Helper to remap integers in a field when they exactly equal an old skill id
def remap_int(val, remap):
    try:
        v = int(val)
    except:
        return val
    if v in remap:
        return str(remap[v])
    return val

fixed = []
changes = []
for lineno, line in enumerate(new, start=1):
    parts = line.split('|')
    if parts[0] == 'PerkAction' and len(parts) > 4:
        # Function at 2, TargetType at 3, TargetID at 4
        func = None
        try:
            func = int(parts[2])
        except:
            pass
        target_val = parts[4]
        # If function is 0 or 1 (Allow/Deny skill) -> TargetID is Skill
        if func in (0,1):
            new_target = remap_int(target_val, remap)
            if new_target != target_val:
                parts[4] = new_target
                changes.append((lineno, line, '|'.join(parts)))
        else:
            # For other functions, heuristically remap if TargetID matches an old skill id
            try:
                tid = int(target_val)
                if tid in remap:
                    parts[4] = str(remap[tid])
                    changes.append((lineno, line, '|'.join(parts)))
            except:
                pass
    elif parts[0] == 'MutatorAction' and len(parts) > 3:
        # Function at 2, TargetID at 3
        func_raw = parts[2]
        try:
            func = int(func_raw)
        except:
            func = None
        if func == 0:
            new_target = remap_int(parts[3], remap)
            if new_target != parts[3]:
                parts[3] = new_target
                changes.append((lineno, line, '|'.join(parts)))
        else:
            try:
                tid = int(parts[3])
                if tid in remap:
                    parts[3] = str(remap[tid])
                    changes.append((lineno, line, '|'.join(parts)))
            except:
                pass
    fixed.append('|'.join(parts))

# Write fixed file and report
outp = Path('../rprdiff_fixed.txt')
outp.write_text('\n'.join(fixed), encoding='utf-8')
summary = [f'Applied {len(changes)} targeted Skill ID remaps to rprdiff (wrote rprdiff_fixed.txt)']
summary += [f'Examples:']
for c in changes[:50]:
    ln, oldline, newline = c
    summary.append(f'Line {ln}:')
    summary.append(f'  - old: {oldline}')
    summary.append(f'  - new: {newline}')

Path('tools/fix_rprdiff_skill_refs_summary.txt').write_text('\n'.join(summary), encoding='utf-8')
print('\n'.join(summary))
print('\nWrote ../rprdiff_fixed.txt and tools/fix_rprdiff_skill_refs_summary.txt')
