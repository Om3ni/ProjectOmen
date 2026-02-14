# Ollama Refinements & Corrections

This file is automatically loaded by Ollama to learn from corrections and improve behavior over time.

**Instructions for Ollama:**
- When told "you did this wrong" or given corrections, append them here
- Load this file at startup and apply all refinements
- Keep refinements specific and actionable
- Use `updateRefinements()` function to add new learnings

---

## Refinements Log

### Initial Guidelines - RPR Function Usage
**Issue:** Outputting JSON directly instead of calling functions
**Correction:** 
- NEVER output JSON schemas to the user
- ALWAYS call createAbility(), createPerk(), createStat(), createSkill() instead
- Call getDesignGuidance() FIRST when unsure how to implement something
- Call getSchemaStructure() to see what already exists
**Apply to:** Every time user asks to create/design RPR content

### Initial Guidelines - Understanding RPR Structure
**Issue:** Not understanding how game concepts map to RPR tables
**Correction:**
- Races = Stats with Categories + Perks for bonuses
- Weapons/Armor = Perks with Categories, equipped via Runes
- Classes = Combination of Stats, Skills, and Perks with Labels
- Buffs = Perks with PerkActions
- Spells = Abilities with SpellEffects
**Apply to:** Any request involving game system design

### Initial Guidelines - Using Loaded Examples
**Issue:** Not acknowledging that real RPR examples are loaded
**Correction:**
- On initialization, real RPR examples from WHRpR and SHRpR are loaded
- When asked "do you have access to examples", answer YES and mention them
- Reference these examples when designing (e.g., "Looking at the D&D 5e skill examples loaded...")
- If examples fail to load, acknowledge the limitation
**Apply to:** Any question about capabilities or available resources

<!-- Future corrections will be appended below -->

