const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', '..', 'rprdiff.txt');
const out = path.join(__dirname, '..', '..', 'stale_refs.json');
const data = fs.readFileSync(file, 'utf8').split(/\r?\n/);

const getIdCol = (token) => token === 'SkillDef' ? 2 : 1;

const idSets = {}; // token -> Set of ids present
const lines = [];

data.forEach((line, idx) => {
  if (!line.trim()) return;
  const parts = line.split('|');
  const token = parts[0];
  lines.push({token, parts, idx: idx + 1, raw: line});
  if (!idSets[token]) idSets[token] = new Set();
  const idCol = getIdCol(token);
  if (parts.length > idCol) {
    const id = parseInt(parts[idCol], 10);
    if (!isNaN(id)) idSets[token].add(id);
  }
});

const report = [];

const remapFormulaIds = (str) => {
  const ids = [];
  if (!str) return ids;
  const re = /(\d+)(?=\*[\d.]+)/g;
  let m;
  while ((m = re.exec(str)) !== null) ids.push(parseInt(m[1], 10));
  return ids;
};

const hasId = (token, id) => idSets[token] && idSets[token].has(id);

for (const ln of lines) {
  const t = ln.token;
  const p = ln.parts;
  const L = p.length;

  if (t === 'SkillDef' && L > 7 && p[7]) {
    const ids = remapFormulaIds(p[7]);
    ids.forEach((id) => {
      if (!hasId('SkillDef', id)) report.push({line: ln.idx, token: t, field: 'SkillDef.col7(formula)', refId: id, raw: p[7]});
    });
  }

  if (t === 'Stat' && L > 4 && p[4]) {
    const ids = remapFormulaIds(p[4]);
    ids.forEach((id) => {
      if (!hasId('SkillDef', id)) report.push({line: ln.idx, token: t, field: 'Stat.col4(formula)', refId: id, raw: p[4]});
    });
  }

  if (t === 'PerkAction' && L > 4) {
    const func = parseInt(p[2], 10);
    const target = parseInt(p[4], 10);
    if (!isNaN(func) && !isNaN(target)) {
      let targetTable = null;
      if ([0,1,4].includes(func)) targetTable = 'SkillDef';
      else if ([2,3,11].includes(func)) targetTable = 'PerkDef';
      else if ([6,7].includes(func)) targetTable = 'Stat';
      else if (func === 8) targetTable = 'SpellDef';
      else if ([9,10].includes(func)) targetTable = 'StatusDef';
      if (targetTable && !hasId(targetTable, target)) report.push({line: ln.idx, token: t, field: 'PerkAction.target', func, refId: target, targetTable, raw: ln.raw});
    }
  }

  if (t === 'StatusAction' && L > 3) {
    const func = parseInt(p[2], 10);
    const target = parseInt(p[3], 10);
    if (!isNaN(func) && !isNaN(target)) {
      const map = {0:'SkillDef',1:'Stat',2:'PerkDef',3:'SpellDef',4:'StatusDef'};
      const tt = map[func];
      if (tt && !hasId(tt, target)) report.push({line: ln.idx, token: t, field: 'StatusAction.target', func, refId: target, targetTable: tt, raw: ln.raw});
    }
  }

  if (t === 'MutatorAction' && L > 3) {
    const func = parseInt(p[2], 10);
    const target = parseInt(p[3], 10);
    if (!isNaN(func) && !isNaN(target)) {
      let tt = null;
      if (func === 0) tt = 'SkillDef';
      else if (func === 1) tt = 'Stat';
      else if (func === 2) tt = 'PerkDef';
      else if (func === 3) tt = 'SpellDef';
      else if ([4,5].includes(func)) tt = 'StatusDef';
      if (tt && !hasId(tt, target)) report.push({line: ln.idx, token: t, field: 'MutatorAction.target', func, refId: target, targetTable: tt, raw: ln.raw});
    }
  }

  if (t === 'RuneAction' && L > 2) {
    const target = parseInt(p[2], 10);
    if (!isNaN(target) && !hasId('SpellDef', target)) report.push({line: ln.idx, token: t, field: 'RuneAction.target', refId: target, targetTable: 'SpellDef', raw: ln.raw});
  }

  if (t === 'SpellEffect' && L > 5) {
    const target = parseInt(p[5], 10);
    if (!isNaN(target) && !hasId('Stat', target)) report.push({line: ln.idx, token: t, field: 'SpellEffect.target', refId: target, targetTable: 'Stat', raw: ln.raw});
  }

  if (t === 'SpellReqDef' && L > 3) {
    const target = parseInt(p[3], 10);
    if (!isNaN(target) && !hasId('Stat', target)) report.push({line: ln.idx, token: t, field: 'SpellReqDef.target', refId: target, targetTable: 'Stat', raw: ln.raw});
  }

  if (t === 'SpellTargetCond' && L > 4) {
    const target = parseInt(p[4], 10);
    if (!isNaN(target)) {
      if (!hasId('Stat', target) && !hasId('StatusDef', target)) report.push({line: ln.idx, token: t, field: 'SpellTargetCond.target', refId: target, targetTable: 'Stat|StatusDef', raw: ln.raw});
    }
  }

  if (t === 'RuneCondition' && L > 2) {
    const target = parseInt(p[2], 10);
    if (!isNaN(target)) {
      if (!hasId('Stat', target) && !hasId('StatusDef', target)) report.push({line: ln.idx, token: t, field: 'RuneCondition.target', refId: target, targetTable: 'Stat|StatusDef', raw: ln.raw});
    }
  }

  if (t === 'RuneEffect' && L > 3) {
    const target = parseInt(p[3], 10);
    if (!isNaN(target) && !hasId('Stat', target)) report.push({line: ln.idx, token: t, field: 'RuneEffect.target', refId: target, targetTable: 'Stat', raw: ln.raw});
  }
}

const summary = {};
report.forEach(r => { const k = `${r.token}:${r.field}`; summary[k] = (summary[k]||0) + 1; });

fs.writeFileSync(out, JSON.stringify({count: report.length, summary, examples: report.slice(0,200)}, null, 2), 'utf8');
console.log('Wrote ' + out + ' with ' + report.length + ' entries.');
process.exit(0);
