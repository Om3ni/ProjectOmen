import { formatTargetInfo, parseIconColor } from '@/utils/abilityFiltering';
import { num } from '@/utils/rprHelpers';
import type { AbilityRequirementsResult } from '@/utils/requirementChecker';

type Row = Record<string, unknown>;

type Props = {
  spell: Row;
  requirements?: Row[]; // SpellReqDef entries for this spell
  requirementResults?: AbilityRequirementsResult; // Checked requirement status
  onSelect?: (spellId: number) => void;
  disabled?: boolean;
};

/**
 * Individual ability card displaying:
 * - Icon with color tint
 * - Name
 * - Target info
 * - Requirements (Phase 2)
 * - Select button
 */
export default function AbilityCard({
  spell,
  requirements = [],
  requirementResults,
  onSelect,
  disabled = false
}: Props) {
  const id = num(spell.ID ?? spell['Node ID']);
  const name = String(spell.Name ?? `Ability ${id}`);
  const iconName = String(spell.AbilityIcon ?? 'None');
  const iconColor = parseIconColor(spell.IconColor);
  const targetInfo = formatTargetInfo(spell);

  // Use requirement results if available, otherwise show raw requirements
  const checkedRequirements = requirementResults?.requirements ?? [];
  const hasRequirements = checkedRequirements.length > 0 || requirements.length > 0;
  const requirementsMode = requirementResults?.requirementsMode ?? 't';

  // For now, check if icon exists (Phase 1 - placeholder)
  const hasIcon = iconName && iconName !== 'None' && iconName !== '';

  const handleSelect = () => {
    if (!disabled && onSelect) {
      onSelect(id);
    }
  };

  return (
    <div className="rounded-lg border theme-border theme-bg-surface overflow-hidden">
      <div className="flex items-start gap-3 p-3">
        {/* Icon placeholder */}
        <div
          className="w-12 h-12 rounded-md flex items-center justify-center shrink-0 border theme-border-muted"
          style={{
            backgroundColor: hasIcon ? 'rgba(0,0,0,0.3)' : 'rgba(128,128,128,0.2)',
          }}
        >
          {hasIcon ? (
            <div
              className="w-8 h-8 rounded"
              style={{
                backgroundColor: iconColor,
                opacity: 0.8
              }}
              title={iconName}
            />
          ) : (
            <span className="text-xs theme-text-muted">?</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold theme-text">{name}</div>
          <div className="text-sm theme-text-secondary mt-0.5">
            {targetInfo}
          </div>

          {/* Requirements section */}
          {hasRequirements && (
            <div className="mt-2">
              <div className="text-xs theme-text-muted">
                {checkedRequirements.length === 1
                  ? 'Requires:'
                  : requirementsMode === 't'
                    ? 'Requires all of the following:'
                    : 'Requires any of the following:'}
              </div>
              <div className="mt-1 space-y-0.5">
                {checkedRequirements.length > 0 ? (
                  // Show checked requirements with color coding
                  checkedRequirements.slice(0, 5).map((req, idx) => (
                    <div key={idx} className="text-xs flex items-start gap-1">
                      <span className={req.met ? 'text-green-500' : 'text-orange-500'}>
                        {req.met ? '◆' : '◇'}
                      </span>
                      <span className={req.met ? 'theme-text-secondary' : 'text-orange-400'}>
                        {req.text}
                        {req.currentValue !== undefined && req.requiredValue !== undefined && !req.met && (
                          <span className="text-orange-300 ml-1">
                            (have {req.currentValue})
                          </span>
                        )}
                      </span>
                    </div>
                  ))
                ) : (
                  // Fallback to raw requirements if not checked
                  requirements.slice(0, 5).map((req, idx) => (
                    <div key={idx} className="text-xs flex items-start gap-1">
                      <span className="text-amber-500">◆</span>
                      <span className="theme-text-secondary">
                        {formatRequirementPlaceholder(req)}
                      </span>
                    </div>
                  ))
                )}
                {(checkedRequirements.length > 5 || requirements.length > 5) && (
                  <div className="text-xs theme-text-muted">
                    +{Math.max(checkedRequirements.length, requirements.length) - 5} more...
                  </div>
                )}
              </div>
            </div>
          )}

          {!hasRequirements && (
            <div className="text-xs theme-text-muted mt-2">
              No requirements
            </div>
          )}
        </div>

        {/* Select button */}
        <button
          type="button"
          className={
            disabled
              ? 'px-4 py-2 text-sm rounded-md theme-bg-elevated theme-text-muted cursor-not-allowed'
              : 'px-4 py-2 text-sm rounded-md bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:bg-[var(--accent-primary-hover)] transition-colors'
          }
          onClick={handleSelect}
          disabled={disabled}
        >
          Select
        </button>
      </div>
    </div>
  );
}

/**
 * Placeholder requirement formatter for Phase 1
 * Will be replaced with proper formatting in Phase 2
 */
function formatRequirementPlaceholder(req: Row): string {
  const fn = num(req.Function);
  const param = num(req.Param);
  const valueMin = num(req.ValueMin);
  const text = String(req.Text ?? '');

  // SpellReqDef Function enum:
  // 0=Stat, 1=Skill, 2=Skill Allocation, 3=Perk, 4=Conan Level, 5=Status Category, 6=Item ID
  switch (fn) {
    case 0:
      return `Stat ${param} is at least ${valueMin}`;
    case 1:
      return `Skill ${param} is at least ${valueMin}`;
    case 2:
      return `Skill allocation ${param} is at least ${valueMin}`;
    case 3:
      return `Has perk ${param}`;
    case 4:
      return `Level is at least ${valueMin}`;
    case 5:
      return text ? `Has status: ${text}` : 'Has status';
    case 6:
      return `Has item ${param}`;
    default:
      return `Requirement (fn=${fn})`;
  }
}
