import type { SchemaData } from '@/models/schema';

type Props = {
  data: SchemaData;
  onChange: (tableName: string, record: Record<string, unknown>) => void;
};

function getOrCreateSingleRecord(
  data: SchemaData,
  tableName: string,
  defaultLiteral: string
): Record<string, unknown> {
  const rows = data[tableName];
  if (Array.isArray(rows) && rows.length > 0) {
    return rows[0] as Record<string, unknown>;
  }
  return { Literal: defaultLiteral };
}

function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v);
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: unknown): boolean {
  const s = String(v ?? 'f').toLowerCase();
  return s === 't' || s === 'true' || s === '1';
}

function toBoolTf(b: boolean): string {
  return b ? 't' : 'f';
}

export default function DiceSystemLayout({ data, onChange }: Props) {
  const diceConfig = getOrCreateSingleRecord(data, 'DiceConfig', 'DiceConfig');
  const diceRules = getOrCreateSingleRecord(data, 'DiceRules', 'DiceRules');
  const gear = getOrCreateSingleRecord(data, 'Gear', 'Gear');

  const setConfig = (field: string, value: unknown) => {
    onChange('DiceConfig', { ...diceConfig, [field]: value });
  };

  const setRules = (field: string, value: unknown) => {
    onChange('DiceRules', { ...diceRules, [field]: value });
  };

  const setGear = (field: string, value: unknown) => {
    onChange('Gear', { ...gear, [field]: value });
  };

  const inputClass =
    'w-full rounded-md border theme-border-muted theme-bg-input px-3 py-2 text-sm theme-text focus:outline-none theme-ring';
  const checkboxClass =
    'w-4 h-4 rounded border-gray-600 bg-gray-700 text-[var(--color-accent)] focus:ring-[var(--color-accent)]';
  const selectClass =
    'w-full rounded-md border theme-border-muted theme-bg-input px-3 py-2 text-sm theme-text focus:outline-none theme-ring';
  const sectionClass = 'rounded-lg border theme-border theme-bg-muted p-4';
  const sectionTitleClass = 'text-base font-semibold theme-text mb-3';
  const labelClass = 'text-xs font-medium theme-text-secondary';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
      {/* Left Column */}
      <div className="space-y-6">
        {/* Rules Section */}
        <div className={sectionClass}>
          <h3 className={sectionTitleClass}>Rules</h3>

          {/* Enable Dice */}
          <label className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              checked={bool(diceConfig.EnableDiceCheck)}
              onChange={(e) => setConfig('EnableDiceCheck', toBoolTf(e.target.checked))}
              className={checkboxClass}
            />
            <div>
              <span className="text-sm theme-text font-medium">Enable dice</span>
              <p className="text-xs theme-text-secondary">Enable/disable the dice window and character sheets.</p>
            </div>
          </label>

          {/* Dice System */}
          <div className="mb-4">
            <label className={labelClass}>Dice System</label>
            <select
              className={selectClass}
              value={str(diceRules['Dice System'])}
              onChange={(e) => setRules('Dice System', parseInt(e.target.value, 10))}
            >
              <option value="0">Roll</option>
              <option value="1">Dice Pool</option>
            </select>
          </div>

          {/* Roll XdY */}
          <div className="flex items-center gap-2 mb-4">
            <span className={labelClass}>Roll</span>
            <input
              type="number"
              min="1"
              className={`${inputClass} w-16`}
              value={num(diceRules['Number of Dice'], 1)}
              onChange={(e) => setRules('Number of Dice', parseInt(e.target.value, 10) || 1)}
            />
            <span className="text-sm theme-text">d</span>
            <input
              type="number"
              min="2"
              className={`${inputClass} w-16`}
              value={num(diceRules['Sides of Dice'], 20)}
              onChange={(e) => setRules('Sides of Dice', parseInt(e.target.value, 10) || 20)}
            />
          </div>

          {/* Critical Thresholds */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelClass}>&gt;= Critical Success</label>
              <input
                type="number"
                className={inputClass}
                value={num(diceRules['Critical Success Threshold'], 20)}
                onChange={(e) => setRules('Critical Success Threshold', parseInt(e.target.value, 10))}
              />
            </div>
            <div>
              <label className={labelClass}>&lt;= Critical Failure</label>
              <input
                type="number"
                className={inputClass}
                value={num(diceRules['Critical Failure Threshold'], 1)}
                onChange={(e) => setRules('Critical Failure Threshold', parseInt(e.target.value, 10))}
              />
            </div>
          </div>

          {/* Roll vs Meet to Beat */}
          <label className="flex items-center gap-3 mb-3">
            <input
              type="checkbox"
              checked={bool(diceRules['Roll vs Meet to Beat'])}
              onChange={(e) => setRules('Roll vs Meet to Beat', toBoolTf(e.target.checked))}
              className={checkboxClass}
            />
            <div>
              <span className="text-sm theme-text font-medium">Roll vs DC is Meet to Beat</span>
              <p className="text-xs theme-text-secondary">
                If enabled, a successful roll must be equal or greater than the DC.
              </p>
            </div>
          </label>

          {/* 5e Advantage */}
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={bool(diceRules['Enable D8D 5e Advantage Modifiers'])}
              onChange={(e) => setRules('Enable D8D 5e Advantage Modifiers', toBoolTf(e.target.checked))}
              className={checkboxClass}
            />
            <div>
              <span className="text-sm theme-text font-medium">Enable D&D 5E Advantage modifiers</span>
              <p className="text-xs theme-text-secondary">
                If enabled, players will be able to select D&D 5E style advantage/disadvantage modifiers for their dice
                and ability rolls.
              </p>
            </div>
          </label>
        </div>

        {/* Points Section */}
        <div className={sectionClass}>
          <h3 className={sectionTitleClass}>Points</h3>

          {/* Attribute Points Row */}
          <div className="grid grid-cols-4 gap-3 mb-4 items-end">
            <div>
              <label className={labelClass}>Attribute Points</label>
              <input
                type="number"
                className={inputClass}
                value={num(diceConfig.AttributePoints)}
                onChange={(e) => setConfig('AttributePoints', parseInt(e.target.value, 10))}
              />
            </div>
            <div>
              <label className={labelClass}>Min Attribute</label>
              <input
                type="number"
                className={inputClass}
                value={num(diceConfig.MinAttributeAllocation)}
                onChange={(e) => setConfig('MinAttributeAllocation', parseInt(e.target.value, 10))}
              />
            </div>
            <div>
              <label className={labelClass}>Max Attr. Allocation</label>
              <input
                type="number"
                className={inputClass}
                value={num(diceConfig.MaxAttributeAllocation)}
                onChange={(e) => setConfig('MaxAttributeAllocation', parseInt(e.target.value, 10))}
              />
            </div>
            <label className="flex items-center gap-2 pb-2">
              <input
                type="checkbox"
                checked={bool(diceConfig.AttributePointBuy)}
                onChange={(e) => setConfig('AttributePointBuy', toBoolTf(e.target.checked))}
                className={checkboxClass}
              />
              <span className="text-xs theme-text">Attr. Point Buy</span>
            </label>
          </div>

          {/* Skill Points Row */}
          <div className="grid grid-cols-4 gap-3 mb-4 items-end">
            <div>
              <label className={labelClass}>Skill Points</label>
              <input
                type="number"
                className={inputClass}
                value={num(diceConfig.SkillPoints)}
                onChange={(e) => setConfig('SkillPoints', parseInt(e.target.value, 10))}
              />
            </div>
            <div>
              <label className={labelClass}>Min Skill</label>
              <input
                type="number"
                className={inputClass}
                value={num(diceConfig.MinSkillAllocation)}
                onChange={(e) => setConfig('MinSkillAllocation', parseInt(e.target.value, 10))}
              />
            </div>
            <div>
              <label className={labelClass}>Max Skill Allocation</label>
              <input
                type="number"
                className={inputClass}
                value={num(diceConfig.MaxSkillAllocation)}
                onChange={(e) => setConfig('MaxSkillAllocation', parseInt(e.target.value, 10))}
              />
            </div>
            <label className="flex items-center gap-2 pb-2">
              <input
                type="checkbox"
                checked={bool(diceConfig.SkillPointBuy)}
                onChange={(e) => setConfig('SkillPointBuy', toBoolTf(e.target.checked))}
                className={checkboxClass}
              />
              <span className="text-xs theme-text">Skill Point Buy</span>
            </label>
          </div>

          {/* Perk Points */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelClass}>Perk Points</label>
              <input
                type="number"
                className={inputClass}
                value={num(diceConfig.PerkPoints)}
                onChange={(e) => setConfig('PerkPoints', parseInt(e.target.value, 10))}
              />
            </div>
            <div>
              <label className={labelClass}>Max Runes</label>
              <input
                type="number"
                className={inputClass}
                value={num(diceConfig.MaxRunes)}
                onChange={(e) => setConfig('MaxRunes', parseInt(e.target.value, 10))}
              />
            </div>
          </div>
        </div>

        {/* Buffs Section */}
        <div className={sectionClass}>
          <h3 className={sectionTitleClass}>Buffs</h3>
          <p className="text-xs theme-text-secondary mb-4">
            Set caps to the maximum allowed stacking effect of buffs/debuffs.
          </p>

          {/* Attribute Buff/Debuff */}
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <label className={labelClass}>Attribute Debuff</label>
              <input
                type="number"
                className={inputClass}
                value={num(diceConfig.MaxAttributeDebuff)}
                onChange={(e) => setConfig('MaxAttributeDebuff', parseInt(e.target.value, 10))}
              />
            </div>
            <div>
              <label className={labelClass}>Attribute Buff</label>
              <input
                type="number"
                className={inputClass}
                value={num(diceConfig.MaxAttributeBuff)}
                onChange={(e) => setConfig('MaxAttributeBuff', parseInt(e.target.value, 10))}
              />
            </div>
          </div>

          {/* Skill Buff/Debuff */}
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <label className={labelClass}>Skill Debuff</label>
              <input
                type="number"
                className={inputClass}
                value={num(diceConfig.MaxSkillDebuff)}
                onChange={(e) => setConfig('MaxSkillDebuff', parseInt(e.target.value, 10))}
              />
            </div>
            <div>
              <label className={labelClass}>Skill Buff</label>
              <input
                type="number"
                className={inputClass}
                value={num(diceConfig.MaxSkillBuff)}
                onChange={(e) => setConfig('MaxSkillBuff', parseInt(e.target.value, 10))}
              />
            </div>
          </div>

          {/* Stat Buff/Debuff */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Stat Debuff</label>
              <input
                type="number"
                className={inputClass}
                value={num(diceConfig.MaxStatDebuff)}
                onChange={(e) => setConfig('MaxStatDebuff', parseInt(e.target.value, 10))}
              />
            </div>
            <div>
              <label className={labelClass}>Stat Buff</label>
              <input
                type="number"
                className={inputClass}
                value={num(diceConfig.MaxStatBuff)}
                onChange={(e) => setConfig('MaxStatBuff', parseInt(e.target.value, 10))}
              />
            </div>
          </div>
        </div>

        {/* Statuses Section */}
        <div className={sectionClass}>
          <h3 className={sectionTitleClass}>Statuses</h3>
          <div>
            <label className={labelClass}>Max Player Selected</label>
            <input
              type="number"
              className={`${inputClass} w-32`}
              value={num(diceConfig.MaxPlayersPerAbility)}
              onChange={(e) => setConfig('MaxPlayersPerAbility', parseInt(e.target.value, 10))}
            />
            <p className="text-xs theme-text-secondary mt-1">
              This is the maximum number of public (or unlocked) Statuses a player may select in their Bio panel.
            </p>
          </div>
        </div>
      </div>

      {/* Right Column - Help Text and Armor */}
      <div className="space-y-6">
        {/* Help Section */}
        <div className={sectionClass}>
          <h3 className={sectionTitleClass}>Editing the dice system</h3>
          <div className="text-sm theme-text-secondary space-y-4">
            <p>
              Editing attributes and skills will not automatically reset any character sheets. You may change names,
              descriptions, and other settings unintrusively.
            </p>
            <p>
              If you change the number of available attribute/skill points, existing characters will not be updated. You
              will need to initiate a server wide reset if you want to allow players to re-allocate their points.
            </p>
            <p className="text-amber-400">
              Please keep a separate document of all your changes! It is not my intention to introduce breaking changes
              that will reset your config, but things can happen.
            </p>

            <h4 className="font-semibold theme-text mt-4">Dice Systems</h4>
            <div className="space-y-3">
              <div>
                <strong className="theme-text">Roll</strong>
                <p>
                  Rolls the given dice and adds the skill and/or attribute bonus to the result. Critical Success occurs
                  when rolling the given Critical Success value or higher. Critical Failure occurs when rolling the
                  Critical Failure value or lower.
                </p>
                <p className="mt-2 text-xs italic">
                  Example: Conan rolls "Martial Arts". His skill bonus is +2 and his "Body" attribute bonus is +3. The
                  1d20 roll is: 15 + 5 and the final result is 20.
                </p>
              </div>
              <div>
                <strong className="theme-text">Dice Pool</strong>
                <p>
                  Rolls a number of dice equal to the skill and/or attribute bonus. Rolls equal or greater to the Add
                  Hit value will count as "hits". Rolls equal or less than the Subtract Hit value will subtract "hits".
                  Roll enough hits to pass the skill check!
                </p>
                <p className="mt-2 text-xs italic">
                  Example: Conan rolls "Martial Arts". His skill bonus is +2 and his "Body" attribute bonus is +3, a
                  total of 5d6. The rolls are: 3 5 1 2 6 and the final result is 3.
                </p>
              </div>
            </div>

            <h4 className="font-semibold theme-text mt-4">Point allocations</h4>
            <p>Attribute/skill points is how many points the player gets to spend.</p>
            <p>Min attribute/skill is the value they start from.</p>
            <p>Max attribute/skill allocation is how many points a player may allocate to a single attribute or skill.</p>
            <p>
              If Point Buy is enabled, the cost of another point will increase with each allocation.
              <br />
              0 → 1 = Costs 1 point
              <br />
              1 → 2 = Costs 1 point
              <br />
              2 → 3 = Costs 2 points
              <br />
              3 → 4 = Costs 3 points
            </p>
          </div>
        </div>

        {/* Armor Section */}
        <div className={sectionClass}>
          <h3 className={sectionTitleClass}>Armor</h3>
          <p className="text-sm theme-text-secondary mb-4">
            You can override how character armor weight is detected by the dice system. Select which armor slots should
            be used, and how to sum the equipped armor weights together.
          </p>

          {/* Use Armor Appearance */}
          <label className="flex items-start gap-3 mb-4">
            <input
              type="checkbox"
              checked={bool(gear.UseArmorAppearance)}
              onChange={(e) => setGear('UseArmorAppearance', toBoolTf(e.target.checked))}
              className={`${checkboxClass} mt-0.5`}
            />
            <div>
              <span className="text-sm theme-text font-medium">Use armor appearance</span>
              <p className="text-xs theme-text-secondary">
                If enabled, any transmogged items will use their visual "item" to detect armor weight, instead of what
                the player has actually equipped.
              </p>
              <p className="text-xs text-amber-400 mt-1">
                Armor appearance checks will only work with RR's transmog system!
              </p>
              <p className="text-xs text-amber-400">Fashionist and Outfit Manager are not compatible.</p>
            </div>
          </label>

          {/* Armor Slots */}
          <div className="mb-4">
            <label className={`${labelClass} block mb-2`}>Armor slots to scan</label>
            <div className="flex gap-4 flex-wrap">
              {[
                { field: 'ScanHead', label: 'Head' },
                { field: 'ScanTorso', label: 'Torso' },
                { field: 'ScanHands', label: 'Hands' },
                { field: 'ScanLegs', label: 'Legs' },
                { field: 'ScanFeet', label: 'Feet' },
              ].map(({ field, label }) => (
                <label key={field} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={bool(gear[field])}
                    onChange={(e) => setGear(field, toBoolTf(e.target.checked))}
                    className={checkboxClass}
                  />
                  <span className="text-sm theme-text">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Function */}
          <div>
            <label className={`${labelClass} block mb-2`}>Function</label>
            <p className="text-xs theme-text-secondary mb-2">How to calculate the final armor weight.</p>
            <div className="text-xs theme-text-secondary mb-2 space-y-1">
              <p>Highest: Light + Heavy = Heavy</p>
              <p>Lowest: Light + Heavy = Light</p>
              <p>Average Down: Med + Heavy = Med</p>
              <p>Average Up: Med + Heavy = Heavy</p>
            </div>
            <select
              className={selectClass}
              value={str(gear.ArmorWeightFunction)}
              onChange={(e) => setGear('ArmorWeightFunction', parseInt(e.target.value, 10))}
            >
              <option value="0">Highest</option>
              <option value="1">Lowest</option>
              <option value="2">Average Down</option>
              <option value="3">Average Up</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
