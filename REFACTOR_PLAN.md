# DiceSystemLayout Refactoring Plan

## Overview
The `src/layouts/DiceSystemLayout.tsx` file (517 lines) has become monolithic with repeated patterns and duplicated utilities. This plan outlines modular improvements.

---

## Phase 1: Extract Shared Utilities

### 1.1 Create `src/utils/typeCoercion.ts`
Extract common type coercion functions used across layouts:
- `str(v: unknown): string` - safe string conversion
- `num(v: unknown, fallback?: number): number` - safe number conversion
- `bool(v: unknown): boolean` - parse 't'/'f'/true/false values
- `toBoolTf(b: boolean): string` - convert boolean back to 't'/'f'

**Files affected:**
- `src/layouts/DiceSystemLayout.tsx` (remove local definitions, import from util)
- `src/layouts/AttributesLayout.tsx` (has duplicate `str()`)
- `src/components/FieldEditor.tsx` (has `toBool()`, `isBoolTf()`)

---

## Phase 2: Create Reusable Form Components

### 2.1 Create `src/components/forms/FormField.tsx`
A generic labeled input field component:
```tsx
type Props = {
  label: string;
  type?: 'text' | 'number' | 'select';
  value: unknown;
  onChange: (value: unknown) => void;
  options?: { value: string; label: string }[];
  className?: string;
  hint?: string;
};
```

### 2.2 Create `src/components/forms/CheckboxField.tsx`
Checkbox with title and description (used 6+ times in DiceSystemLayout):
```tsx
type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description?: string;
  warningText?: string;
};
```

### 2.3 Create `src/components/forms/BuffPairField.tsx`
For the repeated debuff/buff input pairs (Attribute, Skill, Stat):
```tsx
type Props = {
  label: string;
  debuffValue: number;
  buffValue: number;
  onDebuffChange: (v: number) => void;
  onBuffChange: (v: number) => void;
};
```

---

## Phase 3: Extract CSS Constants

### 3.1 Create `src/styles/formClasses.ts`
Centralize repeated Tailwind class strings:
- `inputClass`
- `checkboxClass`
- `selectClass`
- `sectionClass`
- `sectionTitleClass`
- `labelClass`

---

## Phase 4: Refactor DiceSystemLayout

### 4.1 Use CollapsibleSection
Wrap each section (Rules, Points, Buffs, Statuses, Help, Armor) with the existing `CollapsibleSection` component for consistency.

### 4.2 Replace inline JSX with components
- Replace ~25 input patterns with `FormField`
- Replace ~6 checkbox patterns with `CheckboxField`
- Replace 3 buff/debuff pairs with `BuffPairField`

### 4.3 Extract section components (optional)
If the file is still large after Phase 4.2, consider extracting:
- `DiceRulesSection.tsx`
- `DicePointsSection.tsx`
- `DiceBuffsSection.tsx`
- `DiceArmorSection.tsx`

---

## Estimated Impact

| Metric | Before | After (est.) |
|--------|--------|--------------|
| DiceSystemLayout.tsx lines | 517 | ~150-200 |
| Duplicate utility functions | 4 | 0 |
| Repeated form patterns | 25+ | 0 |
| Shared components created | 0 | 3-4 |

---

## Execution Order

1. Phase 1 (utilities) - low risk, immediate benefit
2. Phase 3 (CSS constants) - low risk, quick win
3. Phase 2 (form components) - medium effort, high reuse
4. Phase 4 (refactor layout) - depends on 1-3

---

## Notes
- Maintain backward compatibility - no API changes to DiceSystemLayout props
- Test each phase independently before proceeding
- Other layouts (Attributes, Skills, Stats, etc.) can also benefit from these shared components
