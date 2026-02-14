import { useMemo } from 'react';
import { num } from '@/utils/rprHelpers';

type Row = Record<string, unknown>;

/** Parse RGBA float string "R,G,B,A" → CSS rgba() */
function rgbaFloatToCSS(colorStr: unknown): string {
  const s = String(colorStr ?? '').trim();
  if (!s) return 'rgba(128,128,128,1)';
  const parts = s.split(',').map((v) => parseFloat(v.trim()));
  if (parts.length < 3 || parts.some((p) => !Number.isFinite(p))) return 'rgba(128,128,128,1)';
  const r = Math.round((parts[0] ?? 0) * 255);
  const g = Math.round((parts[1] ?? 0) * 255);
  const b = Math.round((parts[2] ?? 0) * 255);
  const a = parts[3] ?? 1;
  return `rgba(${r},${g},${b},${a})`;
}

/** Determine if a color is "light" to pick text contrast */
function isLightColor(colorStr: unknown): boolean {
  const s = String(colorStr ?? '').trim();
  if (!s) return false;
  const parts = s.split(',').map((v) => parseFloat(v.trim()));
  if (parts.length < 3) return false;
  // Perceived luminance
  const lum = 0.299 * (parts[0] ?? 0) + 0.587 * (parts[1] ?? 0) + 0.114 * (parts[2] ?? 0);
  return lum > 0.6;
}

function idOf(row: Row): number {
  const nodeIdRaw = row['Node ID'];
  const nodeId =
    typeof nodeIdRaw === 'string' && nodeIdRaw.trim() === '' ? NaN : Number(nodeIdRaw);
  if (Number.isFinite(nodeId) && nodeId !== 0) return nodeId;
  const idRaw = row.ID;
  const id = typeof idRaw === 'string' && idRaw.trim() === '' ? NaN : Number(idRaw);
  return id;
}

export type StatusEffectSummary = {
  label: string;
  type: 'stat' | 'skill' | 'perk' | 'ability' | 'status';
};

type StatusCategory = {
  name: string;
  statuses: ParsedStatus[];
};

type ParsedStatus = {
  id: number;
  name: string;
  color: string;
  colorRaw: unknown;
  isLight: boolean;
  isPublic: boolean;
  effects: StatusEffectSummary[];
};

type Props = {
  statusRows: Row[];
  statusActionRows: Row[];
  skillById: Map<number, Row>;
  statById: Map<number, Row>;
  spellById: Map<number, Row>;
  activeStatusIds: Set<number>;
  onToggleStatus: (statusId: number, active: boolean) => void;
};

const FUNCTION_LABELS: Record<number, { type: StatusEffectSummary['type']; prefix: string }> = {
  0: { type: 'skill', prefix: '' },
  1: { type: 'stat', prefix: '' },
  2: { type: 'perk', prefix: 'Grants Perk' },
  3: { type: 'ability', prefix: 'Grants' },
  4: { type: 'status', prefix: 'Grants Status' },
};

export default function StatusPanel({
  statusRows,
  statusActionRows,
  skillById,
  statById,
  spellById,
  activeStatusIds,
  onToggleStatus,
}: Props) {
  // Build a map of StatusAction effects for each status
  const effectsByStatus = useMemo(() => {
    const map = new Map<number, StatusEffectSummary[]>();
    for (const act of statusActionRows) {
      const sid = num(act.StatusID);
      if (sid <= 0) continue;
      const fn = num(act.Function);
      const targetId = num(act.TargetID);
      const value = num(act.Value);

      const meta = FUNCTION_LABELS[fn];
      if (!meta) continue;

      let label = '';
      if (fn === 0) {
        // Modify Skill
        const sk = skillById.get(targetId);
        const name = sk ? String(sk.Name ?? `Skill ${targetId}`) : `Skill ${targetId}`;
        label = `${name} ${value >= 0 ? '+' : ''}${value}`;
      } else if (fn === 1) {
        // Modify Stat
        const st = statById.get(targetId);
        const name = st ? String(st.Name ?? `Stat ${targetId}`) : `Stat ${targetId}`;
        label = `${name} ${value >= 0 ? '+' : ''}${value}`;
      } else if (fn === 2) {
        // Grant Perk — not commonly used in StatusAction but supported
        label = `${meta.prefix} ${targetId}`;
      } else if (fn === 3) {
        // Grant Ability
        const sp = spellById.get(targetId);
        const name = sp ? String(sp.Name ?? `Ability ${targetId}`) : `Ability ${targetId}`;
        label = `${meta.prefix} ${name}`;
      } else if (fn === 4) {
        // Grant Status
        label = `${meta.prefix} ${targetId}`;
      }

      if (!label) continue;
      const arr = map.get(sid) ?? [];
      arr.push({ label, type: meta.type });
      map.set(sid, arr);
    }
    return map;
  }, [statusActionRows, skillById, statById, spellById]);

  // Parse all statuses and group by separator categories
  const categories = useMemo(() => {
    const cats: StatusCategory[] = [];
    let currentCat: StatusCategory = { name: 'General', statuses: [] };
    cats.push(currentCat);

    for (const row of statusRows) {
      const name = String(row.Name ?? '').trim();
      const sid = idOf(row);

      // Detect separator rows
      if (name.startsWith('=====') && name.endsWith('=====')) {
        const catName = name.replace(/^=+/, '').replace(/=+$/, '').trim();
        currentCat = { name: catName || 'Other', statuses: [] };
        cats.push(currentCat);
        continue;
      }

      if (!name || !Number.isFinite(sid)) continue;

      currentCat.statuses.push({
        id: sid,
        name,
        color: rgbaFloatToCSS(row.Color),
        colorRaw: row.Color,
        isLight: isLightColor(row.Color),
        isPublic: String(row.Public ?? 'f').toLowerCase() === 't',
        effects: effectsByStatus.get(sid) ?? [],
      });
    }

    // Filter out empty categories
    return cats.filter((c) => c.statuses.length > 0);
  }, [statusRows, effectsByStatus]);

  if (categories.length === 0) return null;

  const totalActive = activeStatusIds.size;

  return (
    <details className="rounded-lg border theme-border theme-bg-muted" open>
      <summary className="font-semibold p-3 cursor-pointer hover:theme-bg-elevated transition-colors select-none theme-text">
        Status Tracker{totalActive > 0 ? ` (${totalActive} active)` : ''}
      </summary>
      <div className="px-3 pb-3 space-y-4">
        {categories.map((cat) => (
          <div key={cat.name}>
            <div className="text-xs uppercase tracking-wide theme-text-muted mb-2 flex items-center gap-2">
              <span>{cat.name}</span>
              <span className="flex-1 border-b theme-border" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {cat.statuses.map((status) => {
                const isActive = activeStatusIds.has(status.id);
                return (
                  <button
                    key={status.id}
                    type="button"
                    onClick={() => onToggleStatus(status.id, !isActive)}
                    className={`group relative rounded-lg border-2 transition-all text-left p-2 ${
                      isActive
                        ? 'shadow-md scale-[1.02]'
                        : 'border-transparent opacity-60 hover:opacity-90 hover:border-gray-500/30'
                    }`}
                    style={
                      isActive
                        ? {
                            borderColor: status.color,
                            backgroundColor: status.color.replace(/[\d.]+\)$/, '0.15)'),
                          }
                        : {}
                    }
                    title={
                      status.effects.length > 0
                        ? status.effects.map((e) => e.label).join('\n')
                        : status.name
                    }
                  >
                    {/* Color indicator dot */}
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border border-black/20"
                        style={{ backgroundColor: status.color }}
                      />
                      <span
                        className={`text-sm font-medium truncate ${
                          isActive ? 'theme-text' : 'theme-text-secondary'
                        }`}
                      >
                        {status.name}
                      </span>
                    </div>

                    {/* Effects preview — show first 2 */}
                    {status.effects.length > 0 && (
                      <div className="text-[10px] theme-text-muted leading-tight space-y-0.5 ml-5">
                        {status.effects.slice(0, 2).map((eff, i) => (
                          <div key={i} className="truncate">
                            {eff.label}
                          </div>
                        ))}
                        {status.effects.length > 2 && (
                          <div className="theme-text-faint">
                            +{status.effects.length - 2} more
                          </div>
                        )}
                      </div>
                    )}

                    {/* Active indicator */}
                    {isActive && (
                      <div
                        className="absolute top-1 right-1 w-2 h-2 rounded-full"
                        style={{ backgroundColor: status.color }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
