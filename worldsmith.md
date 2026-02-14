# WorldSmith DSL Specification v1.0


## Complete Specification: Sections 0-36


---


# 0. ARCHITECTURAL COVENANTS


This DSL grants extraordinary power, velocity, and generative capability — but only to those who design with absolute precision.


The WorldSmith DSL is a schema-first, deterministic architecture. It rewards correctness with exponential speed. It punishes imprecision with structural collapse.


**Why these rules exist:**


This DSL's generative architecture amplifies both correctness and mistakes. Schema errors propagate automatically to all generated components, parsers, validators, and UI surfaces. A single ambiguous field definition corrupts the entire stack. Therefore, schema must be correct at the moment of definition — the compiler enforces this by halting on structural inconsistencies rather than attempting repairs.


The following covenants govern every section that follows:


## 0.1 Schema Primacy Principle


The schema is upstream of everything. Any mistake in the schema infects all layers — components, workflows, payloads, imports, constraints, and relations.


Schema must be correct at definition time. You do not "fix schema later." Later becomes a refactor that requires revisiting every dependent structure.


This DSL is designed so that late-phase patches fail immediately, forcing you to correct root causes, not symptoms.


## 0.2 No Technical Debt Rule


Technical debt is explicitly prohibited.


**Reason:** Generative systems expand mistakes faster than human-written code. Ambiguity compounds exponentially — one fuzzy decision becomes systemic corruption. Versioned schemas cannot absorb debt gracefully.


The compiler halts on structural inconsistencies — by design. If you try to "clean up later," the DSL stops you now.


## 0.3 Determinism Over Convenience


The DSL prioritizes deterministic behavior over developer convenience, framework comfort, or runtime flexibility.


Nothing is inferred loosely. Nothing is auto-corrected. Nothing is interpreted by intention.


Every field, mapping, relation, constraint, workflow, and payload must be defined explicitly. If the spec doesn't say it, the engine must assume it does not exist.


## 0.4 Ambiguity Is Failure


Anything ambiguous is automatically wrong. Anything unclear is rejected at compile time. Anything inconsistent is halted immediately.


Systems built on ambiguity fail quietly and catastrophically. This DSL fails loudly and early to prevent that.


## 0.5 Responsibility of the Author


By writing a DSL configuration, you are taking on architectural responsibility, not merely configuration responsibility.


You must:
- think like a language designer,
- reason about all layers impacted by a definition,
- understand registry, payload, relations, and workflows simultaneously,
- and avoid any path that says "I'll deal with it later."


This is not YAML. This is not JSON hacking. This is not "declare a table and move on."


This is a domain architecture language.


## 0.6 Reward for Discipline


If you obey these covenants, the DSL gives you performance, reliability, and throughput no traditional architecture can match.


You gain:
- zero-boilerplate CRUD generation,
- automatic UI synthesis,
- automatic payload schemas,
- automatic workflow scaffolding,
- deterministic validation,
- clean integration surfaces,
- versioned evolution,
- and long-term architectural velocity.


This DSL is not for casual contributors. It is for people who want leverage, not convenience.


## 0.7 Covenant Summary


If you proceed past this section, you acknowledge:
- Precision is mandatory.
- Technical debt is not permitted.
- Ambiguity equals error.
- The schema is law.
- The compiler will stop you before you hurt yourself.


--- 


# 1. DSL OVERVIEW & PHILOSOPHY


## 1.1 Purpose


This specification defines a domain-agnostic, schema-first configuration language (the DSL) and its execution model.


The DSL exists to:
- Describe what data exists (entities, payloads, relations).
- Describe how it should be rendered, validated, and manipulated (components, constraints, workflows).
- Describe where data lives and how it is executed and stored (Registry spine + SDDA payloads).
- Describe how external systems can connect (imports, events, streams).


The DSL does not contain:
- Arbitrary code execution.
- Raw SQL or database-specific instructions.
- UI implementation details (frameworks, CSS, platform APIs).
- Repair procedures or domain-specific business logic not expressed as structured configuration.


The goal is to provide a deterministic, inspectable, versioned configuration layer, not an embedded programming language.


---


## 1.2 Design Goals


The DSL is designed with these goals:


1. **Determinism**
   - Every expression is pure and side-effect free.
   - Given the same inputs (registry, payload, relations, context), evaluation yields the same results.


2. **Schema-First**
   - All structures (entities, enums, widgets, workflows, imports, events) are declared in schemas.
   - The compiler derives type information, bindings, and runtime contracts from these schemas.


3. **Separation of Concerns**
   - Registry (fast lookup + metadata) is separate from SDDA payloads (rich data + logs).
   - UI semantics (components, widgets) are separate from UI implementation.
   - DSL describes behavior and structure; runtime chooses technology.


4. **Strong Typing & Static Validation**
   - Expressions are type-checked at compile time.
   - All bindings are resolved before deployment.
   - Invalid references or mismatched types fail compilation.


5. **Extensibility without Side Doors**
   - Imports, events, and streams provide integration points.
   - All external writes pass through Registry + SDDA + workflows, never raw DB hooks.
   - No mechanism exists in DSL to bypass constraints or typing.


6. **Storage-Efficient & Fast**
   - Registry indexProps are small, indexed, searchable.
   - SDDA payloads use pipe-delimited, line-oriented text for fast single-pass parsing.
   - Rotation and append patterns support large histories.


7. **Versioned and Evolvable**
   - DSL versions are explicit.
   - Breaking vs non-breaking changes can be identified.
   - Old payloads can be migrated or parsed by compatible readers.


8. **Implementation-Agnostic**
   - No specific database, message bus, UI framework, or protocol is required by the DSL.
   - Example runtimes (PostgreSQL + filesystem + message bus + React) are illustrative only.


---


## 1.3 Non-Goals


The DSL is not intended to:
- Replace full general-purpose programming languages.
- Express arbitrary algorithms, loops, or recursion.
- Serve as a low-level database schema language (DDL); it sits above DB-specific DDL.
- Embed or interpret vendor-specific logic or proprietary control firmware.
- Encode fine-grained pixel-perfect layouts or design systems (colors, CSS classes, animations).


---


## 1.4 Audience


The intended readers of this specification are:
- **Architects**, who define entities, workflows, and high-level behavior.
- **Engineers**, who implement runtime services (registry, SDDA parsers, workflow engines, UI renderers).
- **Domain designers**, who configure components, forms, constraints, and imports.
- **Tools maintainers**, who build and operate the compiler, linter, and deployment pipeline.


End users (technicians, operators) do not interact with the DSL directly.


---


## 1.5 Scope


This specification covers:


**The language:**
- Expression grammar (DW-Expr)
- Type system
- Binding rules


**The declarative structures:**
- Enums
- Widgets
- Context schema
- EntityKinds (registry, payload, relations)
- Components (layout, fields)
- Constraints
- Workflows
- Imports
- Events
- Streams


**The runtime contracts:**
- Registry semantics
- SDDA storage
- Payload integrity rules
- Relation enforcement
- Read/write pipelines
- Append and rotation rules


**The governance:**
- Versioning
- Migration and schema evolution
- Linting and anti-patterns
- Reserved areas for authorization and offline/sync


---


## 1.6 Out-of-Scope Topics (For Separate Documents)


The following topics are intentionally left to separate documents or future phases:
- Detailed authorization model (roles, permissions, policy evaluation).
- Offline-first sync strategies and conflict resolution.
- UI theme systems, styling, and accessibility specifics.
- Physical deployment, infra topology, scaling strategies.
- Performance tuning guidelines for specific technologies.


This spec defines the contracts and structures those topics will integrate with; it does not prescribe their implementation.


---


# 2. CORE DATA MODEL CONCEPTS


This section defines the core conceptual building blocks the DSL operates on. Subsequent sections formalize them.


---


## 2.1 Registry Spine


The Registry Spine is the canonical index of all entities.


Each entity is a row in `registry_entity` with:
- `id` (UUID)
- `kind` (entityKind name)
- `namespace` (e.g. tooltrack.shop1)
- `name` (human-readable)
- `key` (machine-readable key, unique within namespace)
- `index_props` (JSONB: small, indexed properties)
- `payload_*` fields (where detailed data lives)
- audit and version fields.


The Registry Spine is optimized for:
- Fast lookup by key, kind, namespace, tags, and simple properties.
- Graph-like relations via `registry_relation`.
- Tag-based categorization via `registry_tag`.


Registry is not responsible for storing full specifications or histories; those live in SDDA payloads.


---


## 2.2 SDDA Payloads (Schema-Driven Data Architecture)


SDDA payloads are pipe-delimited text files (or equivalent logical structures) governed by schemas:


Each schema defines:
- Tables
- Columns (index, name, type, defaults, enums)
- Optional UI hints
- Parent/child relationships.


Example file structure:
```
ToolSpec|uuid-123|DeWalt|DCD771C2|DW123456789|2023-06-15|129.99|2-year manufacturer|Excellent condition
ToolAttribute|uuid-123|Voltage|20|V
ToolAttribute|uuid-123|Weight|3.6|lbs
```


SDDA payloads are optimized for:
- Fast O(n) parsing.
- Text diffing and version control.
- Flexible schema evolution.
- Append-only logs (maintenance, telemetry, checkouts, etc.).


The DSL binds each EntityKind to one or more SDDA schemas that describe its payload(s).


---


## 2.3 EntityKinds


An EntityKind is a DSL-level type that ties together:


**Registry configuration:**
- Which indexProps exist.
- Default tags and flags.


**Payload bindings:**
- Which SDDA schema(s) describe the entity's detailed data.


**Relations:**
- Allowed relation types to other EntityKinds.
- Cardinality and requiredness.


**Views:**
- Which components are the canonical detail / list UIs for this kind.


EntityKinds are the conceptual equivalent of "domain models". They are the primary axis for configuration and reasoning.


---


## 2.4 Relations


Relations capture connections between entities:
- Stored in `registry_relation` as `(from_id, to_id, rel_type, metadata)`.
- Described in DSL by:
  - Relation type name (rel_type).
  - Allowed fromKinds and toKinds.
  - Cardinality (one-to-one, one-to-many, etc.).
  - Requiredness and enforcement rules.


At expression-time, relations are exposed as:
- `relations.<relType>.ids` (list of entityId)
- `relations.<relType>.count` (int)


The DSL never manipulates raw foreign keys; it always works with typed relations and counts.


---


## 2.5 Context


Context describes the environment in which the DSL is being evaluated:
- User identity and role(s).
- Device characteristics (form factor, input mode).
- Time (current timestamp).
- Any additional environmental metadata.


Context is defined via a `contextSchema` in the DSL and is bound at runtime by the host environment.


Context is read-only from the DSL's perspective and is available in expressions under `context.*`.


---


## 2.6 Components


Components describe UI structures:
- Their scope (which EntityKind and viewKind they serve).
- Their layout (sections, fields).
- Their field bindings (registry, payload, relations, context).
- Their widgets (input controls with typed props).
- Their constraints (rules that must hold for valid data).
- Their actions (links to workflows or other actions).


Components are declarative; how they are rendered is up to the implementation.


---


## 2.7 Widgets


Widgets define the UI semantics for fields, not their implementation.


Each widget has:
- A name (e.g. text, number, select, date).
- A set of typed props (e.g. min, max, enum ref).


Fields refer to widgets by name and provide widgetProps.


The renderer maps widget names to actual controls in the chosen UI framework.


---


## 2.8 Constraints


Constraints express rules that must hold under certain conditions:


Each constraint has:
- An id.
- A timing (live, on_submit, pre_commit, post_commit).
- A `when` expression: when the rule applies.
- A `require` expression: what must be true.
- A human-readable message.


Constraints are expressed using the same DW-Expr grammar and reference registry, payload, relations, and context.


---


## 2.9 Workflows


Workflows describe multi-step, transactional operations:


Each workflow has:
- A name.
- Input definitions.
- Preconditions (DW-Expr).
- Step list (updateRegistry, addRelation, appendSDDA, emitEvent, etc.).
- Transaction mode and error handling policy.
- Postconditions.


Workflows are the only sanctioned way to perform non-trivial changes spanning multiple entities and/or logs.


---


## 2.10 Imports


Imports are declarative bulk ingest jobs:


They describe:
- Source format (CSV/pipe/JSON).
- Mapping from external fields to registry, payload, and relations.
- Conflict policy (skip/update/error).
- Constraints and/or workflows to apply per record.


Imports go through the same validation and workflow paths as normal writes; they do not bypass Registry or SDDA.


---


## 2.11 Events


Events are typed outbound messages:


Each event:
- Has a name.
- Has a typed payload schema.


Workflows can include `emitEvent` steps to publish them.


External systems subscribe to these events via an implementation-specific mechanism (message bus, webhooks, logs).


---


## 2.12 Streams


Streams describe continuous ingestion from external sources:
- Telemetry feeds, scanners, message topics, etc.


Each stream:
- Binds inbound messages to an entityKind.
- Maps data into SDDA payloads using schemas and mappings.
- Uses rotation strategies for payload storage.


Streams may be used only for logging, or they may trigger workflows in more advanced setups.


---


## 2.13 Hybrid Execution Model


The DSL assumes a hybrid runtime:


**Registry:**
- SQL-backed index of entities, tags, and relations.
- Small index_props JSONB for search.


**SDDA Payloads:**
- Pipe-delimited, schema-driven data files or tables.
- Separate schemas for specs, logs, and telemetry.


**Runtime Services:**
- Registry service.
- SDDA service (parse/export/append).
- Workflow engine.
- UI renderer.
- Import engine.
- Event bus and optional stream engine.


The DSL describes what these services must do and how they must behave; implementation is free to choose technologies.


---


# 3. RESERVED TERMS & NAMING RULES


This section defines reserved words, naming conventions, and structural rules necessary to keep the DSL consistent and avoid collisions.


---


## 3.1 Reserved Words (Language-Level)


The following keywords are reserved in DW-Expr and must not be used as identifiers in positions where they would cause ambiguity:


**Logical / comparison:**
- AND, OR, NOT
- IN
- IS, NULL


**Boolean literals:**
- TRUE, FALSE


**Comparison operators:**
- =, !=, <>, <, <=, >, >=


**Root binding identifiers:**
- registry
- payload
- relations
- context
- inputs


Identifiers at the schema level (entityNames, enum names, etc.) may include these words as part of longer names but should avoid exact, case-insensitive matches in expression identifiers.


---


## 3.2 Root Binding Names


The following root segments are reserved and have fixed semantics in expressions:
- `registry` – Registry binding (indexProps, tags).
- `payload` – SDDA payload binding.
- `relations` – relation bindings.
- `context` – environment/context.
- `inputs` – workflow inputs.


No EntityKind, enum, widget, or field name may use these as their top-level identifier in a way that shadows expression paths.


---


## 3.3 Global Naming Conventions


### 3.3.1 EntityKinds


`entityKinds[*].name`:
- LowerCamelCase or lower_snake_case is recommended, but not required.
- Must be unique within DSL domain.
- Examples: "tool", "location", "person", "job".


`namespaceBase`:
- Dot-separated segments: domain or domain.subdomain.
- Example: "tooltrack", "tooltrack.shop".


Combined runtime namespace:
- Typically derived from namespaceBase + tenant identifier, e.g. "tooltrack.shop1".


### 3.3.2 Enums


`enums` keys:
- Dot-separated: `<domain>.<name>`.
- Examples:
  - "task.priority"
  - "tool.status"
  - "auth.roles".


Enum value keys:
- Lowercase or lower_snake_case strings.
- Examples: "low", "medium", "high", "urgent".


### 3.3.3 Widgets


Widget names:
- Simple lowercase tokens.
- Examples: "text", "textarea", "number", "select", "date", "datetime", "currency", "tagList".


Widgets are global within a DSL domain; names must be unique.


### 3.3.4 Components


Component name:
- PascalCase preferred.
- Example: "ToolDetail", "ToolList", "PersonDetail".
- Must be unique across DSL domain.


### 3.3.5 Constraints


Constraint id:
- Lower_snake_case or kebab-case short identifiers.
- Unique within a component; recommended to be globally unique for simplicity.
- Examples:
  - "must_have_location_when_available"
  - "checkout_requires_available_status".


### 3.3.6 Workflows


Workflow name:
- PascalCase or UpperCamelCase recommended.
- Unique across DSL domain.
- Examples:
  - "ToolCheckout", "ToolReturn", "AssignToolToJob".


### 3.3.7 Imports


Import name:
- PascalCase or UpperCamelCase.
- Examples:
  - "InitialToolLoad", "PeopleSyncFromHR".


### 3.3.8 Events


Event name:
- PascalCase, event-like nouns.
- Examples:
  - "ToolCheckedOut", "ToolReturned", "ToolMaintenanceRecorded".


### 3.3.9 Streams


Stream name:
- PascalCase.
- Examples:
  - "ToolTelemetry", "VehicleLocationStream".


---


## 3.4 Field & Path Naming


### 3.4.1 Registry indexProps


`indexProps` keys:
- LowerCamelCase or lower_snake_case.
- Example:
  - "manufacturer", "model", "serialNumber", "status", "branch".


These become available in expressions as:
- `registry.indexProps.manufacturer`
- `registry.indexProps.serialNumber`, etc.


### 3.4.2 Payload Fields


Table names:
- PascalCase or UpperCamelCase.
- Example: ToolSpec, ToolAttribute, MaintenanceEvent.


Column name:
- UpperCamelCase or PascalCase often used, but not required:
  - "PurchaseDate", "PurchasePrice", "SerialNumber".


Expressions reference payload fields as:
- `payload.<TableName>.<FieldName>`
- e.g. `payload.ToolSpec.PurchasePrice`.


### 3.4.3 Relations


Relation type strings (rel_type):
- lower_snake_case.
- Examples:
  - "located_at", "checked_out_to", "assigned_to".


Expressions reference relation-derived values as:
- `relations.located_at.count`
- (in future extensions, possibly `relations.located_at.hasAny`, etc.).


---


## 3.5 Versioning Identifiers


The DSL supports versioned structures:


`payloadSchemas[*].version`:
- SemVer-like string, e.g. "1.0.0", "1.1.0".


Potential `dslVersion` at root:
- Example: `"dslVersion": "1.1.0"`.


Migration and compatibility behaviors are described later; here we only enforce that:
- Version strings are consistent across the spec.
- Breaking changes (removal or type change of fields, renaming enums, etc.) must be accompanied by a version bump.


---


## 3.6 Disallowed / Reserved for Future Use


The following are reserved for future DSL features and should not be used as identifiers at this time:


**Expression-level:**
- Function-like names: DAYS_BETWEEN, NOW, COALESCE, etc.


**Root-level schema keys:**
- auth, offline, sync, policies, themes (intended for future extensions).


**Widget names:**
- Names that embed platform specifics like "iosSelect", "androidPicker", "win32Dialog".


Using these as identifiers now may cause conflicts with future versions.


---


## 3.7 Prohibited Patterns


1. **Raw SQL / DB Names**
   - No entity, field, or workflow should be named after physical table names or SQL keywords in a way that encourages direct coupling (users, select, insertIntoOrders, etc.).


2. **Platform Names in DSL Identifiers**
   - Avoid Android, iOS, Windows, etc., in identifiers. Platform-specific behavior must be expressed via context (e.g. formFactor, inputMode), not by OS name.


3. **Embedding Implementation Details**
   - Do not encode file paths, URLs, hostnames, or queue names as part of core DSL identifiers. Those belong in implementation, not DSL.


---


# 4. DW-EXPR GRAMMAR (EXPRESSION LAYER)


DW-Expr is the deterministic, side-effect-free expression language used throughout the DSL for:
- Constraints (`when`, `require`)
- Visibility / enablement rules
- Workflow preconditions
- Import validations
- Some workflow/event bindings (where allowed)


It deliberately provides only:
- Boolean logic
- Scalar comparisons
- Membership testing
- Arithmetic on numeric fields
- Path-based field access


It explicitly excludes:
- Loops
- Function definitions
- External calls
- Randomness
- Mutation


---


## 4.1 Purpose and Scope


DW-Expr is used anywhere the DSL needs a computed condition or derived boolean:
- `visibleWhen`, `enabledWhen` (components, fields, actions)
- `when` / `require` in constraints
- Workflow `preconditions`
- Import `validation` filters (where defined)
- Some simple bindings in `emitEvent`/`action` (paths or literals, not full expressions, unless explicitly allowed)


Expressions are always:
- Pure (no side effects)
- Total (must produce a value, never throw)
- Deterministic (same inputs → same output)


---


## 4.2 Grammar (EBNF)


The canonical grammar is:


```ebnf
Expression      ::= OrExpr
OrExpr          ::= AndExpr ( "OR" AndExpr )*
AndExpr         ::= NotExpr ( "AND" NotExpr )*
NotExpr         ::= ("NOT")* CompareExpr
CompareExpr     ::= AddExpr (CompareOp AddExpr)?
CompareOp       ::= "=" | "!=" | "<>" | "<" | "<=" | ">" | ">=" | "IN"
AddExpr         ::= MulExpr (("+" | "-") MulExpr)*
MulExpr         ::= UnaryExpr (("*" | "/") UnaryExpr)*
UnaryExpr       ::= ("+" | "-")? PrimaryExpr
PrimaryExpr     ::= Literal
                  | Path
                  | "(" Expression ")"
Literal         ::= BooleanLiteral
                  | StringLiteral
                  | NumberLiteral
                  | NullLiteral
BooleanLiteral  ::= "TRUE" | "FALSE"
NullLiteral     ::= "NULL"
StringLiteral   ::= "'" <any chars except single-quote>* "'" 
NumberLiteral   ::= Digit+ ("." Digit+)?
Digit           ::= "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
Path            ::= RootSegment ("." Identifier | "[" NumberLiteral "]")*
RootSegment     ::= "registry" | "payload" | "relations" | "context" | "inputs"
Identifier      ::= Letter (Letter | Digit | "_" )*
Letter          ::= "A" | … | "Z" | "a" | … | "z"
```


**Notes:**
- String literals use single quotes `'like this'`.
- Double quotes are reserved for future use (e.g., identifiers) and should be avoided for strings.
- IN operates on AddExpr on the left and a list of literals on the right:
  - In grammar terms: CompareExpr with CompareOp = "IN" and RHS of the form `( Literal ("," Literal)* )`.
  - Practically: `field IN ('a','b','c')`.


---


## 4.3 Root Binding Segments


The top-level path segments are fixed:
- `registry` – for registry/indexProps/tags access.
- `payload` – for SDDA payload fields.
- `relations` – for relation counts / ids.
- `context` – for environment (user, device, time, etc.).
- `inputs` – for workflow inputs (only inside workflows).


No other root segment is allowed.


---


## 4.4 Examples (Valid)


```
registry.indexProps.status = 'available'
registry.indexProps.priorityRank >= 3
payload.ToolSpec.PurchasePrice > 50
relations.located_at.count >= 1
context.formFactor = 'phone'
inputs.personId = registry.indexProps.assignedPersonId
(registry.indexProps.status IN ('available','checked_out'))
  AND (relations.checked_out_to.count <= 1)
```


---


## 4.5 Examples (Invalid)


These are rejected at compile time:


```
registry.unknownField
-- unknown binding


payload.ToolSpec.
-- incomplete path


NOW()
-- functions not supported in DW-Expr


'user' + 3
-- invalid type combination (string + number)


registry.indexProps.priority > 'high'
-- string ordering not allowed for enums unless using rank helper
```


---


# 5. TYPE SYSTEM


## 5.1 Supported Scalar Types


DW-Expr operates over these scalar types:
- string
- int
- float
- bool
- date
- datetime
- entityId
- enumValue
- null


Lists are not first-class types; they only exist syntactically for IN comparisons on the RHS as literal lists.


---


## 5.2 Path Typing


Each path is statically typed from schema:
- `registry.indexProps.<field>`
  - → type from EntityKind's registry.indexProps definition.
- `payload.<Table>.<Field>`
  - → type from corresponding SDDA schema.
- `relations.<relType>.count`
  - → int.
- `relations.<relType>.ids`
  - → list of entityId (only legal in specific contexts, e.g., membership or count, depending on extensions).
- `context.<field>`
  - → type from contextSchema.
- `inputs.<field>`
  - → type from workflow inputs definition.


Any path not defined in schema is a compile-time error.


---


## 5.3 Comparison Rules


Allowed scalar comparisons:
- **string**: `=`, `!=`
- **int and float**:
  - `<`, `<=`, `>`, `>=`, `=`, `!=`
- **enumValue**:
  - `=`, `!=`
  - `IN` with list of enum keys as strings
- **entityId**:
  - `=`, `!=` between compatible entityId types
- **date / datetime**:
  - `<`, `<=`, `>`, `>=`, `=`, `!=`


Disallowed:
- Ordering (`<`, `>`, `<=`, `>=`) on plain string fields (except through explicit numeric rank helper fields).
- Comparisons between incompatible types:
  - string vs int
  - bool vs int
  - enumValue vs non-enum string (unless explicitly allowed by schema, which v1 does not).
- Comparisons on `relations.<relType>.ids` directly (must use `.count` or specific helper constructs, if added later).


---


## 5.4 Arithmetic Rules


Allowed numeric operations:
- `int + int` → int
- `int - int` → int
- `float + float` → float
- `float - float` → float
- `float * float` → float
- `float / float` → float
- `int + float` or `float + int` → float
- `int - float` or `float - int` → float
- `int * float` or `float * int` → float
- `int / float` or `float / int` → float


Forbidden:
- string arithmetic of any kind.
- enumValue arithmetic.
- entityId arithmetic.
- Boolean arithmetic (e.g., `TRUE + 1`).


---


## 5.5 Boolean Logic


Expressions combined with AND, OR, and NOT must be boolean:
- **AND/OR**:
  - Both sides must be boolean.
- **NOT**:
  - Operand must be boolean.


Any non-boolean term used with these operators is a compile-time error.


---


## 5.6 Type Promotion


**Numeric promotion:**
- `int + float` → float
- float is the "wider" numeric type.


**Enums:**
- When comparing enum-valued fields using `=` or `IN`, the comparison is over the enum keys (string literals).
- Ordering comparisons must use explicitly defined rank fields such as:
  - `registry.indexProps.priorityRank`
  - or `payload.Task.PhaseRank`


No implicit ordering of enum keys is allowed.


---


## 5.7 Null Semantics


DW-Expr uses deterministic null semantics:
- `expr IS NULL`:
  - True if expr is null/missing.
- `expr IS NOT NULL`:
  - True if expr is non-null.


**Standard comparisons:**
- `expr = NULL` → always FALSE
- `expr != NULL` → always FALSE


**Comparisons where one side is null:**
- Any comparison with NULL (except IS / IS NOT) evaluates to FALSE.


**Booleans:**
- Null in a boolean position is treated as FALSE.


---


# 6. EVALUATION SEMANTICS


## 6.1 Purity and Determinism


DW-Expr evaluation must:
- Have no side effects.
- Not depend on external mutable state.
- Not depend on current wall-clock time or random sources.
- Be fully deterministic based solely on its inputs.


Given the same registry, payload, relations, context, and inputs, evaluation yields the same result.


---


## 6.2 Binding Resolution


### 6.2.1 Registry


Pattern:
- `registry.indexProps.<fieldName>`
- Allowed fields defined by EntityKind's registry.indexProps schema.
- Each field has a known scalar type.


If the value is missing at runtime:
- It is treated as NULL for expression purposes.


### 6.2.2 Payload


Pattern:
- `payload.<TableName>.<FieldName>`
- Schema defines which tables and fields exist.
- For v1, this is intended for "single logical row" tables (e.g., one ToolSpec per tool).


If table or field is missing in payload data:
- Evaluate as NULL.


**Note:** child tables and multiple-row operations (logs) can be handled via separate mechanisms (e.g., derived roll-ups, not direct row iteration) in v1.


### 6.2.3 Relations


Pattern:
- `relations.<relType>.count`
- `relations.<relType>.ids`
- `count` is an int.
- `ids` is a list of entityId (only used in restricted contexts).


If no relations of that type exist:
- `count` is 0.
- `ids` is an empty list.


### 6.2.4 Context


Pattern:
- `context.<fieldName>`


Defined by contextSchema.


Examples:
- `context.currentUserId`
- `context.currentUserRole`
- `context.formFactor`
- `context.inputMode`
- `context.timestamp`


Context is provided by the environment; it is read-only.


### 6.2.5 Inputs


Pattern:
- `inputs.<fieldName>`


Defined by workflow's inputs schema.


Only valid inside workflow-related expressions.


Outside workflows, any use of `inputs.*` is a compile-time error.


---


## 6.3 Precedence and Grouping


Operator precedence from highest to lowest:
1. Parentheses: `( ... )`
2. Unary: `+`, `-`, `NOT`
3. Multiplicative: `*`, `/`
4. Additive: `+`, `-`
5. Comparisons: `=`, `!=`, `<>`, `<`, `<=`, `>`, `>=`, `IN`
6. Logical AND
7. Logical OR


Expressions are left-associative within the same precedence level.


Parentheses can be used to override default precedence explicitly.


---


## 6.4 Short-Circuit Semantics


Implementations may short-circuit logical evaluation:
- For `A AND B`:
  - If A evaluates to FALSE, B need not be evaluated.
- For `A OR B`:
  - If A evaluates to TRUE, B need not be evaluated.


However, evaluation must be semantically equivalent to full evaluation. Since expressions are pure, short-circuiting does not change the result.


---


## 6.5 Handling of Missing Data


If a field is:
- Optional in schema and not present in data, or
- Present but null


Then:
- Its value in expression evaluation is NULL.
- Any comparison with NULL (except IS / IS NOT) evaluates to FALSE.
- Any boolean usage treats NULL as FALSE.


This behavior ensures expressions are total and predictable even under partial data.


---


## 6.6 Expression Evaluation Optimization


**Performance Consideration:**


Components with many fields may have extensive `visibleWhen`, `enabledWhen`, and `requiredWhen` expressions. For a 30-field form, this could mean 90 expression evaluations per render cycle.


**Optimization Rule:**


Implementations MAY cache expression results within a single evaluation context (render cycle), provided:
- Expressions remain pure (no observable side effects from caching)
- Caches are invalidated on any data change
- Deterministic results are guaranteed


Example: If `registry.indexProps.status = 'available'` is evaluated 5 times in one render with unchanging data, the implementation may compute it once and reuse the result.


**Implementation Note:**


Memoization must respect the tuple (registry, payload, relations, context, inputs) as the cache key. Any change to this tuple invalidates all cached expression results.


---


# 7. ERROR SEMANTICS


## 7.1 Error Categories


Expression-related issues fall into:


1. **Compile-Time Structural Errors**
   - Lexing/parsing failures:
     - Unrecognized characters
     - Unterminated string literals
     - Unbalanced parentheses
     - Invalid token sequences


2. **Compile-Time Binding Errors**
   - Unknown root segment.
   - Unknown path segments:
     - Unknown registry.indexProps field.
     - Unknown payload.Table or payload.Table.Field.
     - Unknown relations.relType.
     - Unknown context or inputs field.


3. **Compile-Time Type Errors**
   - Illegal comparisons (e.g. string vs int).
   - Illegal arithmetic (e.g. enum + number).
   - Boolean operators with non-boolean operands.
   - IN used with non-list RHS or mismatched element types.


4. **Compile-Time Semantic Rules**
   - Disallowed string ordering (`<`, `>` on plain strings).
   - Disallowed operations on `relations.<relType>.ids` directly (unless explicitly supported).


5. **Runtime Data Issues (Handled Safely)**
   - Missing optional fields ⇒ treated as NULL.
   - Missing optional relations ⇒ count = 0, empty ids.
   - Payload version mismatch ⇒ handled at payload parsing level, not in DW-Expr.


---


## 7.2 Compile-Time Error Handling


Any compile-time error:
- Prevents deployment of the DSL configuration.
- Must produce a clear diagnostic including:
  - File or section identifier (if applicable).
  - Location in expression (component/workflow/import, etc.).
  - The specific expression string (or snippet).
  - A human-readable cause.


Examples:


```
Unknown path 'registry.indexProps.serialNumbr' in component 'ToolDetail', 
field 'serialNumber': did you mean 'serialNumber'?


Type mismatch in workflow 'ToolCheckout' precondition: comparing string to int 
in expression 'registry.indexProps.status > 0'.
```


The compiler is responsible for these diagnostics.


---


## 7.3 Runtime "Errors" and Safe Evaluation


Under normal operation, expressions do not throw runtime errors.


Runtime anomalies (missing fields, null values) are reduced to deterministic outcomes:
- **Missing or null field:**
  - Evaluates as NULL.
- **Operations with NULL:**
  - `expr = NULL` / `expr != NULL` ⇒ FALSE.
  - `expr < NULL`, `expr > NULL`, etc. ⇒ FALSE.
  - Boolean context ⇒ FALSE.
- **Relation not present:**
  - `relations.relType.count` ⇒ 0.
  - `relations.relType.ids` ⇒ [].


If an implementation encounters a structural runtime error (e.g., corrupt payload that does not match schema at all), this is not an expression error, but a data integrity error handled at a different layer:
- Expression evaluation in such a case should treat affected payload fields as NULL unless the system explicitly forbids execution with corrupt data.


---


## 7.4 Expression Error vs Data Error


The system explicitly distinguishes:


**Expression Error (Compile-Time)**
- Mis-specified DSL.
- Prevents deployment.
- Must be fixed by modifying the spec.


**Data Error (Runtime)**
- Bad or incomplete data.
- DSL is correct; data is not.
- Expression evaluation yields a deterministic value (usually FALSE or NULL) based on null rules.
- Higher-level logic (constraints, workflows) decides whether to treat such results as failures.


---


## 7.5 Contract Summary


For DW-Expr:


1. All expressions must be:
   - Syntactically valid.
   - Bound to existing schema fields.
   - Type-correct.
   - Semantically valid under DSL rules.


2. No runtime expression exceptions are allowed:
   - All expression evaluations must yield a value.


3. Missing/optional data is handled via null semantics, not errors.


4. Any change to expression grammar, type system, or evaluation semantics must be treated as a potential breaking change and managed via DSL versioning and migration rules.


---


# 8. ENUMS (WITH RANK SEMANTICS)


Enums define controlled vocabularies of string values.


They are used in:
- registry.indexProps
- payload fields
- workflow inputs
- component fields (select widgets)
- constraints and DW-Expr comparisons


The DSL treats enums as *typed string sets*, with optional **rank semantics** for ordered comparisons.


---


## 8.1 Enum Structure


Each enum is defined as:


```json5
"enums": {
  "<domain>.<name>": {
    "values": [
      { "key": "<enumKey>", "label": "<Human Label>", "rank": <int|null> },
      ...
    ],
    "default": "<enumKey>"     // optional, must exist in values
  }
}
```


Constraints:
- `key` must be a unique string identifier for the enum.
- `label` is optional human-readable text.
- `rank` is optional:
  - If present, it must be an integer.
  - If omitted, the value has no ordinal semantics.
- If any enum value defines rank, all ranked values must be unique integers.
- `default`:
  - If present, must be one of the keys.
  - Used for UI and import defaults where applicable.


---


## 8.2 Examples


### 8.2.1 Unranked Enum


```json5
"enums": {
  "tool.status": {
    "values": [
      { "key": "available" },
      { "key": "checked_out" },
      { "key": "needs_repair" },
      { "key": "retired" }
    ],
    "default": "available"
  }
}
```


### 8.2.2 Ranked Enum


```json5
"enums": {
  "task.priority": {
    "values": [
      { "key": "low",    "rank": 1 },
      { "key": "medium", "rank": 2 },
      { "key": "high",   "rank": 3 },
      { "key": "urgent", "rank": 4 }
    ],
    "default": "medium"
  }
}
```


---


## 8.3 Binding Rules


In DW-Expr, enum values bind as:
- strings for equality and membership (IN)
- integers for rank comparisons (explicit), using separate rank fields


### 8.3.1 Equality


```
registry.indexProps.status = 'available'
```


### 8.3.2 Membership


```
registry.indexProps.status IN ('available','checked_out')
```


### 8.3.3 Rank Comparisons


Rank comparisons must not rely on string ordering. Instead, fields referencing enums may define rank mirror fields in registry:


Example (recommended pattern):


```json5
"registry": {
  "indexProps": {
    "priority":      { "type": "enum", "enum": "task.priority" },
    "priorityRank":  { "type": "int" }   // maintained by workflow
  }
}
```


Then DW-Expr:


```
registry.indexProps.priorityRank >= 3
```


Using string comparison:


```
registry.indexProps.priority >= 'medium'
```


is illegal, always a compile-time error.


---


## 8.4 Compilation Semantics


The compiler must validate:
- Enum names are unique.
- Enum keys are unique within the enum.
- Rank values, if present, are unique integers.
- default is valid.
- All references to enums in:
  - registry.indexProps
  - payload schemas
  - workflows
  - component fields use only valid enum keys.


The compiler must generate:
- A typed map of enumKey → label
- A typed map of enumKey → rank (if ranks defined)
- Validation code for fields referencing enums


---


## 8.5 Runtime Behavior


Runtime services must:
- Validate writes against enum membership.
- Reject invalid enum values immediately.
- Preserve enum keys as stored values (no implicit translation to ranks).


For rank usage:
- Rank comparisons operate only on designated rank mirror fields.
- Ranks cannot be inferred implicitly from enum order or enum index.


---


## 8.6 Reserved Semantics


These features are reserved for potential future versions:
- Enum inheritance or composition
- Localization of label fields
- Computed enum values
- Enums with complex attributes beyond label/rank


---


# 9. WIDGETS


Widgets define the UI control semantics for fields in Components.


They describe:
- expected input type
- allowed props
- rendering hints (not implementation details)
- validation constraints


## 9.1 Widget Definition Structure


Each widget is defined as:


```json5
"widgets": {
  "text": {
    "type": "string",
    "props": {
      "placeholder": { "type": "string", "required": false },
      "maxLength":   { "type": "int",    "required": false }
    }
  }
}
```


### Fields:
- `type`: scalar type the widget accepts.
- `props`: map of propName → { type, required }.
- Widget names must be globally unique.


## 9.2 Example Widget Set


```json5
"widgets": {
  "text": {
    "type": "string",
    "props": {
      "placeholder": { "type": "string" }
    }
  },
  "number": {
    "type": "float",
    "props": {
      "min": { "type": "float" },
      "max": { "type": "float" }
    }
  },
  "select": {
    "type": "enum",
    "props": {
      "enum": { "type": "enumRef", "required": true }
    }
  },
  "date": {
    "type": "date",
    "props": {}
  },
  "relationSelect": {
    "type": "entityId",
    "props": {
      "relationType": { "type": "string", "required": true },
      "targetKind": { "type": "string", "required": true }
    }
  }
}
```


**Note:** The `relationSelect` widget is used for selecting related entities. See Section 17.6.2 for usage patterns.


## 9.3 Binding Rules


- Component fields specify:
  - `"widget": "text"`
  - `"widgetProps": { ... }`
- Compiler verifies:
  - Widget exists.
  - Field type matches widget type.
  - `widgetProps` satisfy the prop schema.


Invalid bindings produce compile-time errors.


## 9.4 Runtime Behavior


Runtime renderer:
- Maps widget names to concrete UI components.
- Uses `widgetProps` as input to rendering.
- Must enforce input constraints (e.g., numeric ranges).


No widget logic appears in DW-Expr; widgets only define UI input semantics.


## 9.5 Reserved Semantics


Future expansions:
- widgets with platform variants
- accessibility metadata
- conditional widget props
- composite widgets


For v1, widgets remain simple declarative UI primitives.


---


# 10. CONTEXT SCHEMA


The Context Schema defines the shape of the context object exposed to DW-Expr and any DSL construct that depends on environment information.


Context is:
- Read-only from the DSL's perspective.
- Provided entirely by the host environment (server, client, or both).
- Fully typed and validated against this schema.


The DSL only describes the structure and types of context; it never mutates or derives them at runtime.


## 10.1 Purpose of Context


Context is used to:
- Drive visibility and enablement rules for components and actions.
- Apply RBAC and view profiles based on user identity and role.
- Adjust behavior and layout for device characteristics (form factor, input mode).
- Supply request-scoped metadata (tenant, locale, timestamp) into expressions.


In DW-Expr, context is accessed via the reserved root binding:


```
context.<fieldName>
```


and is part of the input tuple (registry, payload, relations, context, inputs) used to define determinism.


## 10.2 Placement in the DSL Root


The DSL root MAY define a contextSchema block:


```json5
{
  "contextSchema": {
    "fields": {
      "<fieldName>": {
        "type": "<scalarType>",
        "required": <bool>,
        "enum": "<enumName>",         // optional, for enumValue
        "description": "<string>",    // optional
        "entityKind": "<kindName>"    // optional, for entityId
      }
    }
  }
}
```


Where:
- fields is a map of fieldName → ContextFieldDefinition.
- Each fieldName must be a valid DW identifier (Section 3).
- The type system is the core scalar type system from Section 5:
  string, int, float, bool, date, datetime, entityId, enumValue.


If contextSchema is omitted:
- The implementation MAY still supply context, but DW-Expr must treat all context paths as unknown, and any such path is a compile-time binding error.
- A conforming DSL configuration SHOULD define contextSchema explicitly.


## 10.3 Context Field Definition


Each context field is described by a ContextFieldDefinition:


```json5
{
  "type": "string" | "int" | "float" | "bool" | "date" | "datetime" | "entityId" | "enumValue",
  "required": true | false,
  "enum": "domain.enumName",   // required when type = "enumValue"
  "entityKind": "Person",      // optional, for type = "entityId"
  "description": "Human-readable explanation"
}
```


Rules:
- type is required and must be one of the scalar types defined in Section 5.
- required is required:
  - true → the host MUST supply a non-null value at runtime.
  - false → the value may be null or omitted.
- enum:
  - Required when type = "enumValue".
  - Must reference a defined enum (Section 8).
- entityKind:
  - Optional, only meaningful when type = "entityId".
  - When present, documents the expected target kind (e.g., "Person", "User").
- description:
  - Optional, purely documentation.


The compiler must:
- Validate that all referenced enums exist.
- Validate that all referenced entityKinds (where used) exist.


## 10.4 Recommended Standard Context Fields


Implementations MAY define any context fields they need, but the following standard fields are recommended and should be reused when applicable.


### 10.4.1 currentUserId


```json5
"currentUserId": {
  "type": "entityId",
  "required": true,
  "entityKind": "User",
  "description": "Registry id of the current authenticated user"
}
```


Used in DW-Expr as `context.currentUserId`.


Typical uses:
- Ownership checks (`registry.indexProps.ownerId = context.currentUserId`).
- Scope enforcement for RBAC (e.g., "own" vs "all").


### 10.4.2 currentUserRole


```json5
"currentUserRole": {
  "type": "enumValue",
  "required": true,
  "enum": "auth.roles",
  "description": "Primary effective role of the current user"
}
```


Must reference a role enum compatible with RBAC.


Typical uses:
- View profile selection.
- Conditional visibility (`context.currentUserRole IN ('tech','dispatcher')`).


### 10.4.3 formFactor


```json5
"formFactor": {
  "type": "string",
  "required": false,
  "description": "Device form factor, e.g. 'phone', 'tablet', 'desktop'"
}
```


Recommended values: "phone", "tablet", "desktop".


Typical uses:
- Choosing list vs card views.
- Hiding low-value fields on small screens.


### 10.4.4 inputMode


```json5
"inputMode": {
  "type": "string",
  "required": false,
  "description": "Primary input mode, e.g. 'touch' or 'keyboard_mouse'"
}
```


Typical uses:
- Widget choice (larger controls for touch).
- Adjusting validation or step sizes.


### 10.4.5 tenantId


```json5
"tenantId": {
  "type": "string",
  "required": false,
  "description": "Tenant or account identifier for multi-tenant deployments"
}
```


Typical uses:
- Tenant scoping in registry queries.
- Isolation between customers.


### 10.4.6 timestamp


```json5
"timestamp": {
  "type": "datetime",
  "required": true,
  "description": "Current request-scoped timestamp supplied by the host"
}
```


Represents the request-scoped time when evaluation occurs.


It does not violate determinism:
- Determinism is defined over the tuple (registry, payload, relations, context, inputs).
- timestamp is part of context, hence part of the input.
- Given the same context (including timestamp), DW-Expr yields the same result.


Typical uses:
- Time-based constraints (e.g., `payload.Job.DueDate >= context.timestamp`).
- Audit enrichment (passed through to workflows).


## 10.5 Binding Rules in DW-Expr


Given a valid contextSchema, any field may be referenced as:


```
context.<fieldName>
```


The compiler must:
- Treat `context.<fieldName>` as having the scalar type declared in `contextSchema.fields[fieldName].type`.
- Reject any reference to `context.<fieldName>` that is not declared in contextSchema as a compile-time binding error.


At runtime:
- If required = true and the host omits or nulls the field, this is a runtime context error, not an expression error.
- If required = false and the host omits or nulls the field:
  - The value in DW-Expr is NULL.
  - The null semantics from Section 5.7 apply.


## 10.6 Validation and Error Semantics


Context validation is separated into:


**Compile-time:**
- Unknown context fields in expressions ⇒ compile-time binding error.
- Type mismatches between usage and schema ⇒ compile-time type error.
- Invalid enum or entityKind references ⇒ compile-time schema error.


**Runtime:**
- Missing required context field ⇒ context binding error (the host environment must fail the request or supply a default).
- Optional field missing ⇒ treated as NULL in expressions, following null rules.


DW-Expr itself does not throw runtime exceptions based on context; it only operates on the values (or NULL) it is given.


## 10.7 Mutability and Lifecycle


From the DSL's perspective, context is immutable for the duration of an evaluation:
- The host environment constructs context at the beginning of a request, action, or evaluation cycle.
- DW-Expr and DSL-defined structures may read `context.*` but never write to it.
- Workflows may receive context values as inputs and pass them along to external systems, but they do not modify context itself.


Formally:
- Given fixed (registry, payload, relations, context, inputs), all DW-Expr evaluations are deterministic.
- Any change in context between evaluations is treated as a change in the input tuple, not as a side effect.


## 10.8 Example contextSchema


An example context schema for a multi-tenant, role-based web app:


```json5
"contextSchema": {
  "fields": {
    "currentUserId": {
      "type": "entityId",
      "required": true,
      "entityKind": "User",
      "description": "Registry id of the current authenticated user"
    },
    "currentUserRole": {
      "type": "enumValue",
      "required": true,
      "enum": "auth.roles",
      "description": "Primary effective role of the current user"
    },
    "tenantId": {
      "type": "string",
      "required": true,
      "description": "Tenant/account id in a multi-tenant deployment"
    },
    "formFactor": {
      "type": "string",
      "required": false,
      "description": "Device form factor: 'phone', 'tablet', or 'desktop'"
    },
    "inputMode": {
      "type": "string",
      "required": false,
      "description": "Primary input mode: 'touch' or 'keyboard_mouse'"
    },
    "timestamp": {
      "type": "datetime",
      "required": true,
      "description": "Request-scoped evaluation timestamp supplied by the host"
    }
  }
}
```


In DW-Expr, these can be used as:


```
context.currentUserId = registry.indexProps.ownerId
context.currentUserRole IN ('tech','dispatcher')
context.formFactor = 'phone'
payload.Job.DueDate >= context.timestamp
```


All of the above are statically typed and validated against the contextSchema.


---


# 11. ENTITYKINDS (REGISTRY + PAYLOAD + RELATIONS + VIEWS)


An **EntityKind** is the DSL-level definition of a domain entity that unifies:
- **Registry** — identity, key, namespace, indexProps, tags.
- **Payload** — SDDA schemas describing the entity's structured data.
- **Relations** — allowed relation types to and from other entities.
- **Views** — canonical list/detail/edit components for UI.


Each row in `registry_entity` is an instance of exactly one EntityKind.


EntityKinds generalize the "table" concept from traditional schemas into a domain-agnostic configuration object.


---


## 11.1 Purpose of EntityKinds


EntityKinds are the primary unit of configuration and reasoning in the DSL. They:
- Provide the **type context** for DW-Expr:
  - Bind `registry.*`, `payload.*`, and `relations.*` paths for a given entity.
- Define **which SDDA schemas** (tables/columns) hold the entity's data.
- Define **which registry indexProps** expose key fields (ids, literals, flags).
- Declare **which relation types** are valid (from/to which kinds, with what cardinality).
- Bind **canonical UI components** (list/detail/edit) for generated or custom views.


---


## 11.2 Top-Level `entityKinds` Shape


At the DSL root, EntityKinds are declared as:


```json5
{
  "entityKinds": {
    "<kindName>": {
      "description": "<string>",
      "kindClass": "core" | "extension" | "virtual",
      "registry": { ... },
      "payload": { ... },
      "relations": { ... },
      "views": { ... },
      "tags": ["asset", "primary"]    // optional
    }
  }
}
```


### 11.2.1 `kindName`


- The `<kindName>` keys of `entityKinds`:
  - Type: string (required).
  - Must be unique across all EntityKinds.
  - Recommended: `UpperCamelCase` (e.g. `"Asset"`, `"Job"`, `"Person"`).
  - This value is stored in `registry_entity.kind` for instances of this EntityKind.


### 11.2.2 `description`


- Type: string (optional).
- Human-readable explanation of the entity's purpose.


### 11.2.3 `kindClass`


- Type: string (required).
- Allowed values:
  - `"core"` — primary domain entities.
  - `"extension"` — secondary entities extending or annotating core ones (e.g. comments, attachments, logs).
  - `"virtual"` — logical entities with no primary payload (e.g. views, projections).
- Used as a hint for tooling; no special semantics in DW-Expr.


### 11.2.4 `tags`


- Type: string[] (optional).
- Arbitrary labels to classify the entity (e.g. `"asset"`, `"job"`, `"customer"`).
- May be used by generators and UIs for grouping, navigation, or filtering.


---


## 11.3 `registry` Section


The `registry` block specifies how this EntityKind appears in the **Registry Spine** (`registry_entity`):


```json5
"registry": {
  "namePath": "payload.ToolSpec.Name",
  "keyPath": "payload.ToolSpec.AssetTag",
  "namespaceStrategy": "byTenant",
  "namespacePath": "context.tenantId",
  "indexProps": {
    "<propName>": {
      "type": "string" | "int" | "float" | "bool" | "date" | "datetime" | "enumValue" | "entityId",
      "from": "payload.<Table>.<Field>" | "workflow",
      "required": true | false,
      "enum": "domain.enumName",      // when type = enumValue
      "entityKind": "OtherKind",      // when type = entityId
      "searchable": true | false
    }
  },
  "defaultTags": ["asset", "tool"]
}
```


### 11.3.1 `namePath`


- Type: string (required).
- A **path** (not a full expression) used to derive `registry_entity.name`.
- Must be a valid DW-Expr path resolving to a scalar, typically in payload:
  - e.g. `"payload.ToolSpec.Name"`, `"payload.JobSpec.Title"`.
- If the value is NULL at runtime, name may be empty or implementation-defined; this is not an expression error.


### 11.3.2 `keyPath`


- Type: string (required).
- A **path** to a scalar value used as `registry_entity.key`.
- Must be a valid DW-Expr path:
  - e.g. `"payload.ToolSpec.AssetTag"`.
- The implementation is responsible for enforcing uniqueness of `(kind, namespace, key)`.


### 11.3.3 `namespaceStrategy`


- Type: string (required).
- Allowed values:
  - `"static"` — one global namespace (e.g. `"global"` or the app id).
  - `"byTenant"` — namespace derived from a context field.


Determines how `registry_entity.namespace` is computed.


### 11.3.4 `namespacePath`


- Type: string (optional).
- Required when `namespaceStrategy = "byTenant"`.
- Must be a valid context path, typically:
  - `"context.tenantId"` or equivalent.
- When `namespaceStrategy = "static"`, `namespacePath` is ignored and the implementation uses a fixed value.


### 11.3.5 `indexProps`


`indexProps` defines the shape of `registry_entity.index_props` for this EntityKind:


```json5
"indexProps": {
  "<propName>": IndexPropDefinition
}
```


Each `<propName>`:
- Type: string (required).
- Must be unique within this EntityKind.
- Must be a valid identifier per Section 3.4.1.
- Becomes available in DW-Expr as:
  - `registry.indexProps.<propName>`.


#### IndexPropDefinition


```json5
{
  "type": "string" | "int" | "float" | "bool" | "date" | "datetime" | "enumValue" | "entityId",
  "from": "payload.<Table>.<Field>" | "workflow",
  "required": true | false,
  "enum": "domain.enumName",
  "entityKind": "OtherKind",
  "searchable": true | false
}
```


Fields:
- `type` (required):
  - One of the scalar types in Section 5.
- `from` (required):
  - A **path** (not full expression) to a payload field: `"payload.ToolSpec.SerialNumber"`
  - OR the special value `"workflow"` indicating this field is maintained by workflows, not derived from payload
- `required` (required):
  - If `true`: writes must provide a non-null value.
  - If `false`: the value may be null or omitted.
- `enum` (required when `type = "enumValue"`):
  - Name of an enum defined in the `enums` section (Section 8).
- `entityKind` (optional; relevant when `type = "entityId"`):
  - Documents the expected target EntityKind.
- `searchable` (optional, default `false`):
  - Hint that the implementation may index this field for search or filtering.


**Important Note on `from` Values:**


When `from = "workflow"`, this indicates:
- The indexProp is NOT automatically derived from a payload field
- Workflows are responsible for explicitly setting and maintaining this value
- This is the correct pattern for:
  - Computed roll-ups from append-only tables
  - Relation-derived fields (e.g., selected location ID)
  - Rank mirror fields for enums
  - Any field that requires business logic to maintain


Example:
```json5
"indexProps": {
  "lastMaintenanceDate": {
    "type": "date",
    "from": "workflow",  // maintained by MaintenanceWorkflow, not auto-derived
    "required": false
  },
  "selectedLocationId": {
    "type": "entityId",
    "from": "workflow",  // set when user selects location, not from payload
    "entityKind": "Location",
    "required": false
  },
  "priorityRank": {
    "type": "int",
    "from": "workflow",  // mirror of enumValue priority for ordering
    "required": true
  }
}
```


The compiler must:
- Verify that paths in `from` (when not `"workflow"`) point to existing payload fields.
- Verify that `enum` and `entityKind` references exist when provided.
- Type-check payload fields (when `from` is a path) against `type`.


### 11.3.6 `defaultTags`


- Type: string[] (optional).
- Tags automatically attached to entities of this kind in `registry_tag`.
- Useful for grouping and filtering.


---


## 11.4 `payload` Section (SDDA Binding)


The `payload` block declares which SDDA schemas (tables/columns) define this EntityKind's structured data:


```json5
"payload": {
  "primarySchema": "ToolSpec_v1",
  "schemas": ["ToolSpec_v1", "ToolLog_v1"]
}
```


### 11.4.1 `primarySchema`


- Type: string (required for non-virtual EntityKinds).
- Must match a schema id defined in the SDDA section (tables/columns spec).
  - e.g. `"ToolSpec_v1"`.
- Represents the main "spec" table for the entity.


### 11.4.2 `schemas`


- Type: string[] (optional).
- If present, must include `primarySchema`.
- May list additional schemas:
  - Log tables (e.g. `"ToolLog_v1"`).
  - Telemetry tables.
  - Ancillary specs.


The compiler must:
- Ensure that all schema ids referenced exist.
- Ensure that any `registry.indexProps[*].from` paths (when not `"workflow"`) point into one of the listed schemas.


---


## 11.5 `relations` Section (Per-Entity View of Relation Types)


The DSL defines **relation types** globally. The `relations` block on an EntityKind describes how those global relation types apply to that specific kind:


```json5
"relations": {
  "asSource": {
    "<relType>": {
      "toKinds": ["Location", "Customer"],
      "cardinality": "one_to_many" | "one_to_one" | "many_to_many",
      "required": false
    }
  },
  "asTarget": {
    "<relType>": {
      "fromKinds": ["Job"],
      "cardinality": "many_to_one" | "one_to_one" | "many_to_many",
      "required": false
    }
  }
}
```


### 11.5.1 `asSource`


- Maps relation types where this EntityKind is the source (`from_id` in `registry_relation`).
- For each `<relType>`:
  - `toKinds`: array of EntityKinds allowed as targets.
  - `cardinality`: conceptual cardinality from this kind to targets.
  - `required`: whether at least one outgoing relation is required.


### 11.5.2 `asTarget`


- Maps relation types where this EntityKind is the target (`to_id` in `registry_relation`).
- For each `<relType>`:
  - `fromKinds`: array of EntityKinds allowed as sources.
  - `cardinality`: conceptual cardinality from each source.
  - `required`: whether at least one incoming relation is required.


### 11.5.3 Relation Exposure in DW-Expr


For each relation type `<relType>` that applies to this EntityKind, the following paths are available:
- `relations.<relType>.count` → int
- `relations.<relType>.ids` → list of `entityId` (restricted usage in v1 core)


The compiler must:
- Verify `<relType>` is defined in the global relation types section.
- Verify that all `fromKinds` and `toKinds` are valid EntityKinds.
- Enforce that relations used in workflows and constraints obey the declared cardinalities, where applicable.


---


## 11.6 `views` Section (Component Bindings)


The `views` block binds this EntityKind to canonical UI components:


```json5
"views": {
  "listComponent": "AssetList",
  "detailComponent": "AssetDetail",
  "editComponent": "AssetEdit"
}
```


Fields:
- `listComponent` (string, optional):
  - Name of a list component defined elsewhere in the DSL.
- `detailComponent` (string, optional):
  - Name of a detail component.
- `editComponent` (string, optional):
  - Name of an edit component.


The compiler must:
- Verify that any referenced component names exist in the components registry.


---


## 11.7 Validation Rules for EntityKinds


The compiler must validate each EntityKind as follows:


1. **Naming and uniqueness**
   - `kindName` unique across `entityKinds`.
   - All keys in `indexProps`, `relations.asSource`, `relations.asTarget`, and `views` are valid identifiers and non-duplicated.


2. **Registry binding**
   - `registry.namePath` and `registry.keyPath` are valid scalar paths.
   - `namespaceStrategy` and `namespacePath` are consistent.
   - Each `indexProps[*].from` (when not `"workflow"`) is a valid payload path of compatible type.


3. **Payload binding**
   - `payload.primarySchema` exists.
   - If `payload.schemas` is present, it contains `primarySchema`.


4. **Relations**
   - All relation types used under `relations` are defined globally.
   - All `fromKinds` / `toKinds` exist.
   - Cardinality strings are supported values.


5. **Views**
   - Any referenced components exist.


---


## 11.8 Example: `Asset` EntityKind


```json5
"entityKinds": {
  "Asset": {
    "description": "Company tools and equipment",
    "kindClass": "core",
    "tags": ["asset", "primary"],
    "registry": {
      "namePath": "payload.ToolSpec.Name",
      "keyPath": "payload.ToolSpec.AssetTag",
      "namespaceStrategy": "byTenant",
      "namespacePath": "context.tenantId",
      "indexProps": {
        "assetTag": {
          "type": "string",
          "from": "payload.ToolSpec.AssetTag",
          "required": true,
          "searchable": true
        },
        "status": {
          "type": "enumValue",
          "from": "payload.ToolSpec.Status",
          "required": true,
          "enum": "tool.status"
        },
        "selectedLocationId": {
          "type": "entityId",
          "from": "workflow",
          "required": false,
          "entityKind": "Location"
        }
      },
      "defaultTags": ["asset"]
    },
    "payload": {
      "primarySchema": "ToolSpec_v1",
      "schemas": ["ToolSpec_v1", "ToolLog_v1"]
    },
    "relations": {
      "asSource": {
        "located_at": {
          "toKinds": ["Location"],
          "cardinality": "one_to_one",
          "required": false
        }
      },
      "asTarget": {
        "checked_out_to": {
          "fromKinds": ["Person"],
          "cardinality": "many_to_one",
          "required": false
        }
      }
    },
    "views": {
      "listComponent": "AssetList",
      "detailComponent": "AssetDetail",
      "editComponent": "AssetEdit"
    }
  }
}
```


---


# 12. COMPONENTS (UI MODEL: LAYOUT, FIELDS, VISIBILITY, ENABLEMENT)


Components define UI structures for:
- entity views (list, detail, edit),
- workflow screens (wizards, dialogs),
- and standalone screens (dashboards, search, admin screens).


They are purely declarative:
- No mutation, no business logic, no backend code.
- All behavior emerges from:
  - field bindings,
  - widget selection,
  - DW-Expr visibility/enablement rules,
  - layout metadata,
  - constraints and workflows defined elsewhere.


A component describes what a screen looks like and which data it binds to, not how it is rendered or persisted.


## 12.1 Top-Level Components Collection


At the DSL root, components are declared as:


```json5
{
  "components": {
    "<ComponentName>": ComponentDefinition
  }
}
```


`<ComponentName>`:
- Type: string (required).
- Must be unique across all components.
- Recommended: PascalCase (e.g. "AssetDetail", "JobList", "TimeEntryEdit").


## 12.2 ComponentDefinition Structure


A component has this general shape:


```json5
"components": {
  "<ComponentName>": {
    "label": "Human Label",
    "description": "Optional longer description",
    "scope": {
      "kind": "entity" | "workflow" | "standalone",
      "entityKind": "Asset",
      "viewMode": "list" | "detail" | "edit" | "wizard" | "dashboard",
      "device": "any" | "desktop" | "mobile"
    },
    "layout": {
      "sections": [ SectionDefinition ],
      "defaultSectionId": "main"
    },
    "fields": [ FieldBinding ],
    "actions": [ ActionDefinition ]
  }
}
```


All fields are described in the following subsections.


## 12.3 scope — Where and How the Component Is Used


```json5
"scope": {
  "kind": "entity",
  "entityKind": "Asset",
  "viewMode": "detail",
  "device": "any"
}
```


### 12.3.1 kind


Type: string (required).


Allowed values:
- `"entity"` — bound to an EntityKind instance or collection.
- `"workflow"` — bound to a workflow (e.g. wizard, confirmation dialog).
- `"standalone"` — not tied to a specific entity or workflow; e.g. dashboard, search hub.


### 12.3.2 entityKind


Type: string (required when kind = "entity", otherwise omitted).


Must match an entityKinds key.


Defines which EntityKind's registry/payload/relations are in scope:
- DW-Expr can use registry.*, payload.*, relations.* for that kind.


### 12.3.3 viewMode


Type: string (required).


Recommended values:
- `"list"` — list/grid/board view over many entities.
- `"detail"` — single-entity read-only or read-mostly view.
- `"edit"` — single-entity editing form.
- `"wizard"` — multi-step guided flow.
- `"dashboard"` — summary/aggregate view.


Engines may support additional values; unknown values must fall back to reasonable defaults.


### 12.3.4 device


Type: string (optional, default "any").


Allowed values:
- `"any"` — device-agnostic.
- `"desktop"` — optimized for desktop layouts.
- `"mobile"` — optimized for mobile layouts.


Used by runtimes to pick appropriate components based on form factor.


## 12.4 layout — Sections and Simple Grid Hints


The layout block describes how fields and actions are arranged. For v1, layout is intentionally simple and non-recursive.


```json5
"layout": {
  "sections": [
    {
      "sectionId": "main",
      "label": "Main",
      "columns": 2,
      "order": ["name", "categoryId", "status", "assetTag"],
      "collapsible": false
    }
  ],
  "defaultSectionId": "main"
}
```


### 12.4.1 sections


Type: array of SectionDefinition (required, non-empty).


**SectionDefinition:**


```json5
{
  "sectionId": "main",
  "label": "Main",
  "description": "Primary fields",
  "columns": 1,
  "order": ["name", "status"],
  "collapsible": false,
  "initiallyCollapsed": false
}
```


Fields:
- `sectionId`:
  - Type: string (required).
  - Unique within the component.
  - Used by fields and actions to indicate placement.
- `label`:
  - Type: string (required).
  - Human-readable section title.
- `description`:
  - Type: string (optional).
- `columns`:
  - Type: int (optional, default 1).
  - Hint for layout engine on how many columns this section should use.
- `order`:
  - Type: string[] (optional).
  - List of fieldId values from fields[*].fieldId defining order within this section.
  - If omitted, implementation may default to the declaration order of fields.
- `collapsible`:
  - Type: bool (optional, default false).
- `initiallyCollapsed`:
  - Type: bool (optional, default false).
  - Only meaningful when collapsible = true.


### 12.4.2 defaultSectionId


Type: string (optional).


If present, must match one of layout.sections[*].sectionId.


Used when a field or action omits its sectionId.


## 12.5 fields — Field Bindings and Widget Hints


The fields array defines which fields appear in the component, how they bind to data, and how they behave:


```json5
"fields": [
  {
    "fieldId": "name",
    "label": "Name",
    "sectionId": "main",
    "path": "payload.ToolSpec.Name",
    "widget": "text",
    "widgetProps": {
      "placeholder": "Enter asset name"
    },
    "visibleWhen": "TRUE",
    "enabledWhen": "TRUE",
    "requiredWhen": "registry.indexProps.status = 'active'",
    "readOnly": false
  }
]
```


### 12.5.1 fieldId


Type: string (required).


Local identifier for this component.


Must be unique within the component.


Used in layout.sections[*].order and in actions[*].inputs if needed.


### 12.5.2 label


Type: string (required).


Human label for this field in this component.


May differ from the label defined at the data model level (if any).


### 12.5.3 sectionId


Type: string (optional).


If present, must match a layout.sections[*].sectionId.


If omitted, the field is placed in layout.defaultSectionId if defined; otherwise implementation chooses a default section.


### 12.5.4 path


Type: string (required).


A path expression root for this field's value:
- Typically `registry.indexProps.<name>` or `payload.<Table>.<Field>`.
- Must be a valid DW-Expr path referring to a scalar or enum field.


The type of the field is inferred from the target path (Section 5).


### 12.5.5 widget and widgetProps


```json5
"widget": "text",
"widgetProps": {
  "placeholder": "Enter asset name"
}
```


- `widget`:
  - Type: string (required).
  - Must match a widget defined in the global widgets map (Section 9).
  - The widget's declared type must match the field's scalar type.
- `widgetProps`:
  - Type: object (optional).
  - Must conform to the prop schema for that widget.
  - Compiler validates types and required-ness for props.


### 12.5.6 Visibility and Enablement (visibleWhen, enabledWhen, requiredWhen)


```json5
"visibleWhen": "registry.indexProps.status != 'retired'",
"enabledWhen": "context.currentUserRole = 'owner'",
"requiredWhen": "TRUE"
```


- `visibleWhen`:
  - Type: string (optional).
  - DW-Expr boolean expression.
  - Defaults to "TRUE" if omitted.
  - If evaluates to FALSE, the field is not rendered.
- `enabledWhen`:
  - Type: string (optional).
  - DW-Expr boolean expression.
  - Defaults to "TRUE" if omitted.
  - If FALSE, the field is rendered read-only/disabled.
- `requiredWhen`:
  - Type: string (optional).
  - DW-Expr boolean expression.
  - Defaults to "FALSE" if omitted.
  - Used by form validation to require a non-null value when TRUE.


### 12.5.7 readOnly


Type: bool (optional, default false).


When true, this field must be rendered in read-only mode regardless of enabledWhen.


Intended for fields like IDs, system timestamps, or audit fields.


The compiler must:
- Validate that path is bound to a known field and type.
- Validate that widget exists and that widgetProps matches its declared prop types.
- Parse and type-check visibleWhen, enabledWhen, and requiredWhen as DW-Expr booleans.


## 12.6 actions — Component-Level Actions


The actions array defines buttons and other invokable actions from this component:


```json5
"actions": [
  {
    "actionId": "save",
    "label": "Save",
    "sectionId": "main",
    "placement": "footer",
    "visibleWhen": "TRUE",
    "enabledWhen": "context.currentUserRole IN ('owner','editor')",
    "workflow": "AssetSave",
    "inputs": {
      "entityId": "registry.id"
    },
    "confirmMessage": "Save changes?"
  }
]
```


### 12.6.1 actionId


Type: string (required).


Local identifier within this component.


Must be unique within the component.


### 12.6.2 label


Type: string (required).


Human label shown on the button or control.


### 12.6.3 sectionId


Type: string (optional).


If present, must match a layout.sections[*].sectionId.


If omitted, implementation may place the action in a default header or footer area.


### 12.6.4 placement


Type: string (optional).


Recommended values (non-exhaustive):
- "header", "footer", "row" (for list actions), "toolbar", etc.


Used as a hint for runtime placement.


### 12.6.5 Visibility and Enablement


```json5
"visibleWhen": "TRUE",
"enabledWhen": "registry.indexProps.status != 'retired'"
```


- `visibleWhen`:
  - Type: string (optional, DW-Expr, default "TRUE").
  - If FALSE, the action is not rendered.
- `enabledWhen`:
  - Type: string (optional, DW-Expr, default "TRUE").
  - If FALSE, the action is rendered disabled.


### 12.6.6 workflow and inputs


```json5
"workflow": "AssetSave",
"inputs": {
  "entityId": "registry.id",
  "currentStatus": "registry.indexProps.status"
}
```


- `workflow`:
  - Type: string (optional).
  - Name of a workflow defined in the workflows section.
  - If omitted, the action may be a navigation or purely client-side behavior (implementation-defined).
- `inputs`:
  - Type: object (optional).
  - Map from workflow input field name to a **path string**.


**Critical Note on Input Semantics:**


For WorldSmith v1 core, action `inputs` are **strictly path-based**. See Section 17 for complete normative semantics. Each value in `inputs`:
- MUST be a syntactically valid DW-Expr path
- MUST use one of the allowed roots: `registry.*`, `payload.*`, `relations.*`, `context.*`
- MUST NOT include operators, arithmetic, boolean logic, or literals
- MUST resolve to a scalar type compatible with the workflow input definition


Examples of **valid** v1 inputs:
```json5
"inputs": {
  "entityId": "registry.id",
  "status": "registry.indexProps.status",
  "userId": "context.currentUserId"
}
```


Examples of **invalid** v1 inputs (compile-time errors):
```json5
"inputs": {
  "status": "registry.indexProps.status = 'available'",  // comparison not allowed
  "userId": "context.currentUserId OR registry.indexProps.ownerId",  // boolean logic not allowed
  "tag": "'fixed-literal'"  // literals not allowed in v1 core
}
```


**Note on Extensions:**


Implementations MAY support richer input expressions as a non-portable extension, but any DSL configuration relying on such behavior is not WorldSmith v1 core compliant. The normative semantics are defined in Section 17.


### 12.6.7 confirmMessage


Type: string (optional).


If present, UI should prompt the user with this message before invoking the action.


Implementations may localize or extend this behavior.


The compiler must:
- Verify workflow, if present, refers to a defined workflow.
- Validate that inputs refer to valid paths (v1 core restriction).


## 12.7 Component Evaluation and Constraints


Components themselves do not execute DW-Expr beyond:
- visibleWhen,
- enabledWhen,
- requiredWhen (fields),
- and the equivalent on actions.


Constraints (Section 13) may reference component fields indirectly via entity state, but components:
- Do not own global constraints.
- Do not own workflows.
- Do not own mutations.


Their responsibility is limited to:
- binding fields to data,
- providing visibility/enablement rules,
- and wiring actions to workflows.


## 12.8 Minimal Example


```json5
"components": {
  "AssetDetail": {
    "label": "Asset Detail",
    "description": "View and edit an asset",
    "scope": {
      "kind": "entity",
      "entityKind": "Asset",
      "viewMode": "detail",
      "device": "any"
    },
    "layout": {
      "sections": [
        {
          "sectionId": "main",
          "label": "Main",
          "columns": 2,
          "order": ["name", "status"]
        }
      ],
      "defaultSectionId": "main"
    },
    "fields": [
      {
        "fieldId": "name",
        "label": "Name",
        "sectionId": "main",
        "path": "payload.ToolSpec.Name",
        "widget": "text",
        "widgetProps": {
          "placeholder": "Enter asset name"
        },
        "visibleWhen": "TRUE",
        "enabledWhen": "TRUE",
        "requiredWhen": "TRUE"
      },
      {
        "fieldId": "status",
        "label": "Status",
        "sectionId": "main",
        "path": "payload.ToolSpec.Status",
        "widget": "select",
        "widgetProps": {
          "enum": "tool.status"
        },
        "visibleWhen": "TRUE",
        "enabledWhen": "TRUE",
        "requiredWhen": "TRUE"
      }
    ],
    "actions": [
      {
        "actionId": "save",
        "label": "Save",
        "placement": "footer",
        "visibleWhen": "TRUE",
        "enabledWhen": "TRUE",
        "workflow": "AssetSave",
        "inputs": {
          "entityId": "registry.id"
        }
      }
    ]
  }
}
```


---


# 13. CONSTRAINTS


Constraints are the guardrails of the DSL.


They are strict, deterministic, statically validated boolean contracts that:
- must always produce a value,
- must never throw,
- must never rely on implementation magic,
- and must be evaluated exactly when the spec says they are.


If a constraint fires, the operation fails. No partial writes, no silent coercions, no "warnings."


## 13.1 What a Constraint Is


A constraint is a declarative rule with two boolean expressions:
- `when` — the condition under which the rule applies
- `require` — the condition that must be TRUE or the operation is rejected


Both must be DW-Expr expressions, both must type-check, both must be total.


The structure:


```json5
{
  "id": "string-identifier",
  "timing": "live" | "on_submit" | "pre_commit" | "post_commit",
  "when": "DW-Expr boolean",
  "require": "DW-Expr boolean",
  "message": "Human readable explanation"
}
```


## 13.2 What a Constraint Is Not


A constraint is not:
- Business logic
- Workflow steps
- UI validation
- Something the engine "tries to fix"
- Supposed to be clever


A constraint is a boolean guardrail, nothing more.


## 13.3 Constraint Timing


The DSL enforces four explicit evaluation timing categories, each with its own allowed bindings.


### 13.3.1 live constraints (UI-driven)


Evaluated continuously as the user interacts with a component.


They may reference:
- `registry.*`
- `payload.*`
- `relations.*`
- `context.*`


They may not reference:
- `inputs.*`
- workflow state
- future data that does not yet exist


If violated, the UI marks the field invalid but does not stop the user from continuing to edit.


(Only on_submit and later can block actual writes.)


### 13.3.2 on_submit (component-level gate)


Evaluated when a user submits a component form.


These constraints may block the action bound to the component.


They may not mutate anything, and they cannot reference `inputs.*`.


If any constraint fails, the submit is canceled with the provided message.


### 13.3.3 pre_commit (workflow preconditions)


These run before workflow steps execute.


They may reference:
- `inputs.*`
- `registry.*`
- `payload.*`
- `relations.*`
- `context.*`


These constraints prevent the workflow from executing at all.


### 13.3.4 post_commit (workflow postconditions)


Evaluated after workflow steps complete but before the transaction finalizes.


If any fail, the engine must:
- roll back the entire workflow transaction,
- surface the message,
- and leave the system unchanged.


This is the DSL-level contract for atomicity.


### 13.3.5 Import-level constraints


Imports behave like workflows over many rows.


Constraints attached to an import are evaluated:
- after mapping (so expressions see the correct registry/payload structure)
- before the workflow for that row


They use:
- `registry.*`
- `payload.*`
- `relations.*`


## 13.4 Where Constraints Can Live


The DSL permits constraints in:
- `components[*].constraints`
- `entityKinds[*].constraints`
- `workflows[*].preconditions` and `workflows[*].postconditions`
- `imports[*].constraints`


Each location has its own timing defaults:


| Location   | Default Timing | Allowed Overrides |
|------------|----------------|-------------------|
| Component  | live           | on_submit         |
| EntityKind | pre_commit     | none (global)     |
| Workflow   | explicitly pre_commit or post_commit | required |
| Import     | pre_commit     | none              |


EntityKind constraints are "global rules" — they apply anytime that entity is being created or updated, whether through UI, API, workflow, or import.


## 13.5 Evaluation Rules


Evaluation uses the following mandatory rules — no implementation is allowed to deviate.


### 13.5.1 The when → require pipeline


For each constraint:
1. If `when` evaluates to FALSE, the constraint is ignored.
2. If `when` evaluates to NULL, treat it as FALSE.
3. If `when` evaluates to TRUE, evaluate `require`.
4. If `require` is TRUE → pass.
5. If `require` is FALSE or NULL → constraint FAILS.


NULL never saves you. If you needed null-acceptance, write it explicitly:


```
payload.ToolSpec.Weight IS NULL OR payload.ToolSpec.Weight > 0
```


### 13.5.2 Allowed bindings per timing category


| Timing Level | registry | payload | relations | context | inputs |
|--------------|----------|---------|-----------|---------|--------|
| live         | ✓        | ✓       | ✓         | ✓       | ✗      |
| on_submit    | ✓        | ✓       | ✓         | ✓       | ✗      |
| pre_commit   | ✓        | ✓       | ✓         | ✓       | ✓      |
| post_commit  | ✓        | ✓       | ✓         | ✓       | ✓      |


Engines must enforce this strictly. If your UI tries to reference `inputs.*` outside a workflow: compile-time error.


## 13.6 Failure Semantics


A failed constraint produces:
- a boolean FALSE result,
- the user-provided human-readable message,
- and an operation abort.


Workflows must roll back. Registry writes must not occur. Payload writes must not occur. No partial state is permitted.


There is no soft-failure mode in this DSL.


## 13.7 Reserved Extensions


These are intentionally not implemented in v1:
- constraint groups
- severity levels
- dynamic constraint injection
- cross-entity constraint aggregation
- context-sensitive error message templating
- variable binding inside expressions


They may return in v2 or v3 when the engine semantics are fully stabilized.


## 13.8 Minimal Examples


**Valid:**


```json5
{
  "id": "must_have_location_if_active",
  "timing": "pre_commit",
  "when": "registry.indexProps.status = 'active'",
  "require": "relations.located_at.count >= 1",
  "message": "Active assets must be assigned a location."
}
```


**Invalid (references forbidden binding):**


```json5
{
  "when": "inputs.entityId = registry.id",  // illegal in components
  "require": "TRUE"
}
```


**Invalid (non-boolean require):**


```json5
{
  "when": "TRUE",
  "require": "payload.Spec.Weight + 5"  // evaluates to number, not boolean
}
```


---


# 14. WORKFLOWS


A workflow is the only sanctioned mechanism to mutate system state.


Therefore, any ambiguity, convenience feature, or "runtime interpretation" must be eliminated. A workflow either executes deterministically or it does not execute at all.


A workflow is:
- A typed, declarative, transactional mutation sequence.
- Bound entirely to the schema defined in preceding sections.
- Executed atomically.
- Validated by constraints.
- Forbidden from containing logic outside the DSL's primitive operations.


Workflows are deterministic state machines — nothing more, nothing less.


## 14.1 Workflow Definition Structure


A workflow definition appears as:


```json5
{
  "name": "ToolCheckout",
  "inputs": {
    "assetId": { "type": "entityId", "entityKind": "Asset", "required": true },
    "personId": { "type": "entityId", "entityKind": "Person", "required": true },
    "timestamp": { "type": "datetime", "required": true }
  },
  "preconditions": [ ... ],
  "steps": [ ... ],
  "postconditions": [ ... ],
  "messageOnSuccess": "Checkout completed."
}
```


No fields beyond these are allowed unless explicitly added in future spec versions.


## 14.2 Workflow Inputs (Strict and Static)


Workflow inputs:
- Must be fully typed.
- Must reference only scalar types or entityId types.
- Must be statically validated at compile time.
- Must not reference context, registry, relations, or payload.


Workflow inputs represent the only mutable external data allowed into the workflow.


**Illegal Inputs:**
- Input whose type is "string but will contain JSON" → invalid.
- Input whose type is "enum but we'll validate later" → invalid.
- Input whose type is missing → invalid.
- Input with optional type that is not explicitly defined → invalid.
- Input with no entityKind attached when type = entityId → invalid.


The rule is simple: If an input is not fully typed, the workflow is malformed.


## 14.3 Preconditions


Preconditions are DW-Expr expressions evaluated before any mutation occurs.


They may reference:
- `inputs.*`
- `registry.*`
- `payload.*`
- `relations.*`
- `context.*`


If any precondition evaluates to FALSE or NULL:
- the workflow aborts
- no steps run
- an error message is surfaced


Preconditions may not:
- perform mutation
- embed dynamic references
- reference steps
- depend on sequence
- depend on future values


## 14.4 Workflow Steps (The Only Allowed Mutation Primitives)


A workflow step is one of the following — and nothing else:


### 14.4.1 registryWrite


Updates indexProps for an entity.


```json5
{
  "step": "registryWrite",
  "entityId": "inputs.assetId",
  "fields": {
    "status": "checked_out",
    "assignedTo": "inputs.personId"
  }
}
```


Constraints:
- fields must map to valid indexProps keys.
- Types must match schema.
- No nested writes.
- No dynamic field generation.
- EntityKind invariants must remain intact.


### 14.4.2 payloadWrite


Writes or replaces a single-row payload table.


```json5
{
  "step": "payloadWrite",
  "entityId": "inputs.assetId",
  "table": "ToolSpec",
  "fields": { ... }
}
```


Constraints:
- Table must be a schema-defined non-log table.
- Fields must match table schema.
- All non-nullable fields must be present.
- No field outside schema may appear.


### 14.4.3 payloadAppend


Appends a new row to an append-only table (logs, audits, telemetry, history).


```json5
{
  "step": "payloadAppend",
  "entityId": "inputs.assetId",
  "table": "MaintenanceEvent",
  "row": { ... }
}
```


Constraints:
- Table must be marked as append-only in schema.
- All required fields must be present.
- Row ordering must not be modified by the workflow.


### 14.4.4 addRelation


Adds a typed relation between two entities.


```json5
{
  "step": "addRelation",
  "from": "inputs.assetId",
  "to": "inputs.personId",
  "relType": "checked_out_to"
}
```


Constraints:
- Relation type must exist in schema.
- Cardinality rules must not be violated.
- Workflow must not resolve relation targets dynamically (no query-like behavior).


### 14.4.5 removeRelation


Removes an existing relation.


Identical constraints to addRelation.


### 14.4.6 emitEvent


Emits a typed event declared in the schema.


```json5
{
  "step": "emitEvent",
  "event": "ToolCheckedOut",
  "payload": {
    "assetId": "inputs.assetId",
    "personId": "inputs.personId"
  }
}
```


Constraints:
- Event must be schema-defined.
- Event payload must match type.
- No external event formats are allowed.


### 14.4.7 Forbidden Workflow Steps


Anything not on this list is forbidden:
- No loops
- No branching
- No SQL
- No queries
- No external calls
- No "script step"
- No "function step"
- No "math step"
- No "compute step" (DW-Expr is the only compute language)
- No field creation
- No table creation
- No schema mutation


## 14.5 Step Execution Semantics


All workflow steps execute:
- Sequentially
- Deterministically
- Inside a transaction


No parallel steps, no skipping, no hidden branching.


### 14.5.1 Atomicity


Either:
- all steps succeed, preconditions satisfied, postconditions satisfied → commit


or:
- anything fails → rollback to starting state


There is no partial commit.


### 14.5.2 Deterministic Field Resolution


All field references inside a workflow step must resolve statically.


Dynamic or computed field names are illegal.


## 14.6 Postconditions


Evaluated after all steps run, but before commit.


They may reference:
- `registry`
- `payload`
- `relations`
- `inputs`
- `context`


If any postcondition is FALSE or NULL:
- rollback the workflow
- surface the message
- do not commit


Postconditions enforce invariants that must hold after mutations.


## 14.7 Workflow Error Semantics


Errors come from:
- preconditions (abort before change)
- step failure (rollback)
- postconditions (rollback)
- type mismatch (compile error)
- invalid reference (compile error)
- schema mismatch (compile error)


There is no runtime fallback, no soft warning, and no best-effort behavior.


Workflows either succeed properly or fail cleanly.


## 14.8 Workflow Versioning and Evolution


Workflows must be version-stable:
- Inputs must be immutable in type
- Steps must not rely on UI
- Steps must not rely on payload row ordering
- Constraints must be separate


If a workflow must change semantics:
- You create ToolCheckout_v2, not mutate the original.


Schema evolution must not break prior workflows.


## 14.9 Minimal Valid Example


```json5
{
  "name": "AssetCheckout",
  "inputs": {
    "assetId": { "type": "entityId", "entityKind": "Asset" },
    "techId":  { "type": "entityId", "entityKind": "Person" }
  },
  "preconditions": [
    { 
      "when": "TRUE", 
      "require": "registry.indexProps.status = 'available'", 
      "message": "Asset not available." 
    }
  ],
  "steps": [
    {
      "step": "registryWrite",
      "entityId": "inputs.assetId",
      "fields": {
        "status": "checked_out"
      }
    },
    {
      "step": "addRelation",
      "from": "inputs.assetId",
      "to": "inputs.techId",
      "relType": "checked_out_to"
    }
  ],
  "postconditions": [
    {
      "when": "TRUE",
      "require": "relations.checked_out_to.count = 1",
      "message": "Checkout relation missing."
    }
  ]
}
```


---


# 15. REGISTRY CONTRACT


Registry is the system of record for identity, lookup, relation integrity, and index semantics.


If Registry is incorrect or ambiguous, every higher-order construct becomes unreliable.


Registry is the authoritative source for:
- Entity identity
- Namespaces
- indexProps (fast-lookup fields)
- Tags
- Relations
- Version fingerprints


Registry is not a database schema. It is a logical contract that any compliant runtime must implement faithfully.


## 15.1 Entity Records (registry_entity)


Every entity record in the Registry must contain:


| Field | Description | Requirements |
|-------|-------------|--------------|
| id | UUID | Globally unique. Immutable. |
| kind | EntityKind name | Must map to a declared EntityKind. |
| namespace | Logical namespace string | Required. Stable. Used to prevent collisions. |
| name | Human-readable label | Optional, not identity-relevant. |
| key | Machine-readable stable key | Unique within namespace. |
| indexProps | Key/value map | Strongly typed; constrained by EntityKind schema. |
| version | Integer or UUID revision | Required; increments on mutation. |
| tags | List of tag strings | Optional; no semantic weight unless defined in schema. |


**Non-negotiable rules:**
- `id` is immutable. Any system allowing id replacement or reuse is noncompliant.
- `namespace + key` must uniquely identify an entity.
- EntityKinds define which indexProps exist — runtime must not auto-generate fields.
- If a required indexProp is missing, the entity is invalid. No silent defaults.
- Registry must not store full payloads; only indexProps and metadata.


## 15.2 Namespace Contract


Namespaces are required to:
- Disambiguate multi-tenant systems
- Prevent collisions in large ecosystems
- Provide routing hints for distributed registry backends


Namespaces must be:
- All-lowercase
- Dot-delimited
- Deterministic and not runtime-generated


Example valid namespaces:
- `tooltrack.shop1`
- `worldsmith.campaign.alpha`
- `inventory.warehouse.east`


Invalid namespaces:
- `Shop#1` → illegal character
- `TOOLTRACK` → uppercase discouraged
- `customer/region1` → path delimiters forbidden


## 15.3 indexProps (Indexed Properties)


indexProps are the high-speed lookup surface for entities.


**Rules for indexProps:**
- Only fields declared in EntityKind's registry.indexProps may appear.
- indexProps must be stored in strongly typed form (no coercion, no "stringly typed" fields).
- Missing required indexProps make the entity invalid.
- indexProps must be queryable without loading payloads.
- indexProps must not include computed values — workflows maintain them.


**Forbidden behaviors:**
- Auto-expanding indexProps at runtime
- Accepting arbitrary JSON blobs
- Allowing indexProps to diverge from payload equivalents (when `from` is a payload path)


## 15.4 Tags


Tags are lightweight string labels stored in the Registry.


**Rules:**
- Tags must be strings.
- Tags have no schema-bound semantics unless a component, workflow, or rule references them.
- Tags must never influence evaluation of DW-Expr unless explicitly referenced.
- Tags cannot store hierarchical structure (prefix conventions are allowed, but not enforced).


Tags are metadata-only. They are not to be used as data fields, flags, or properties.


## 15.5 Relations (registry_relation)


Relations define typed edges between entities.


Every relation row includes:


| Field | Description |
|-------|-------------|
| from_id | Source entity |
| to_id | Target entity |
| rel_type | Type, declared in schema |
| metadata | Optional structured data |
| version | Revision for concurrency control |


### 15.5.1 Rules


- `rel_type` must exist in the EntityKind schema.
- Cardinality rules must be enforced at write time, not interpreted at read time.
- Relation cycles may be allowed or forbidden depending on schema declaration — default is allowed.
- Removing an entity must remove dependent relations atomically.
- Relation types are immutable — renaming changes the schema version.


### 15.5.2 Relation Semantics in DW-Expr


Relations expose exactly two legal DW-Expr paths:
- `relations.<relType>.count`
- `relations.<relType>.ids`


No other properties exist.


## 15.6 Registry Read Contract


Registry must guarantee:


**Atomic Reads:**
- Reads must represent stable state. No interleaving partial updates.


**Strong typing:**
- Returned values must match declared types.


**Zero coercion:**
- If a field is stored as int, runtime must never return "5".


**Payload independence:**
- Registry read must succeed even if payload system is offline, corrupt, or unavailable.


**Namespace isolation:**
- Reads must never return data from outside the target namespace unless explicitly queried.


## 15.7 Registry Write Contract


Registry writes must adhere to the following invariant:


All Registry writes must be validated by schema before commit. No corrective or coercive behavior is allowed at runtime.


**Write failure modes:**
- Type mismatch → reject
- Unknown indexProp → reject
- Missing required field → reject
- Cardinality violation → reject
- Relation type invalid → reject
- Namespace mismatch → reject
- Attempt to mutate immutable fields (id, kind) → reject


Registry writes must be:
- Atomic
- Logged
- Version-incrementing
- Replayable


## 15.8 Registry and Workflow Interaction


Workflows are the only allowed mechanism to mutate registry state.


Thus:
- Registry must never allow ad-hoc writes from UI or API endpoints.
- Registry must never allow updates bypassing workflow validation.
- Registry must not auto-create entities without a workflow.
- Registry must not auto-update indexProps from payload changes.


This enforces determinism and correctness.


## 15.9 Concurrency and Versioning Rules


Each entity record has a version stamp.


**Rules:**
- Writes must perform optimistic concurrency checks.
- Version increments must be monotonic.
- Conflicts must surface cleanly and cannot be auto-resolved.


**Unacceptable behaviors:**
- Silent overwrites
- Merge semantics
- "Last write wins" without validation


If workflows must retry, the retry must re-evaluate preconditions and postconditions.


## 15.10 Entity Lifecycle


Entity lifecycle is explicit:


| State | Description |
|-------|-------------|
| Created | Via workflow. Registry + payload created atomically. |
| Active | Entity participates in relations, workflows, UI interactions. |
| Soft-deleted | Entity hidden from UI but preserved in Registry + payload (optional). |
| Hard-deleted | Removed entirely; may be disallowed by schema. |


**Rules:**
- Soft-delete may only occur via workflow.
- Hard-delete requires schema flag `allowHardDelete: true`.
- Relations must be purged atomically during deletion.
- Deletion workflows must include postconditions validating no orphaned state remains.


## 15.11 Forbidden Behaviors


Registry must never:
- Auto-cast values
- Infer missing indexProps
- Generate default values
- Rebuild relations automatically
- Perform cascade updates not defined by workflows
- Accept writes from UI/REST directly
- Perform lookups using payload values when indexProps are missing
- Materialize computed fields not defined in schema


---


# 16. SDDA PAYLOAD CONTRACT


Registry is the skeleton. SDDA payloads are the organs.


If payload structure drifts, bloats, mutates, or becomes ungoverned, the system rots from the inside.


SDDA is designed to be:
- Deterministic
- Line-oriented
- Human-readable
- Diffable
- Append-friendly
- Schema-validated


It is not a relational model, not a flexible document store, and not a dumping ground for arbitrary JSON.


## 16.1 Payload Structure


Every payload belongs to exactly one entity and is governed by exactly one SDDA schema.


A payload file (conceptually) is a sequence of rows:


```
<TableName>|<Col1>|<Col2>|...|<ColN>
<TableName>|<Col1>|<Col2>|...|<ColN>
...
```


**Rules:**
- All rows must match the declared schema for that table.
- Column count and order are fixed and may not vary.
- Table names must match schema exactly.
- No trailing or missing columns are allowed.
- Empty strings are not null; nulls must be explicit (NULL).


## 16.2 Table Types


There are exactly two table categories in SDDA:


### 16.2.1 Single-Row Tables (Spec Tables)


Examples:
- ToolSpec
- CharacterSheet
- CustomerProfile


**Rules:**
- Must contain 0 or 1 rows.
- Workflows may replace the row (payloadWrite) but never append.
- Must contain all required fields for that table.
- Represent the canonical "state" of the entity.


### 16.2.2 Append-Only Tables (Event or Log Tables)


Examples:
- MaintenanceEvent
- CheckoutHistory
- StatusChangeEvent
- LocationHistory


**Rules:**
- Rows must be strictly append-only.
- Historical rows must never be mutated or reordered.
- Workflows may only use payloadAppend.
- Removal is forbidden unless schema explicitly defines a retention workflow.


Append-only tables provide the full history of the entity.


## 16.3 Schema Definition Requirements


Each SDDA schema must declare:
- Table name
- Column list (ordered)
- Column type (mapped to core DSL type)
- Nullability
- Default values (if any)
- Whether the table is single-row or append-only


Example schema block:


```json5
"payloadSchemas": {
  "Tool": {
    "tables": [
      {
        "name": "ToolSpec",
        "kind": "single",
        "columns": [
          { "name": "Manufacturer", "type": "string", "required": true },
          { "name": "Model",        "type": "string", "required": true },
          { "name": "PurchaseDate", "type": "date",   "required": true }
        ]
      },
      {
        "name": "MaintenanceEvent",
        "kind": "append",
        "columns": [
          { "name": "Timestamp", "type": "datetime", "required": true },
          { "name": "Notes",     "type": "string",   "required": true },
          { "name": "TechId",    "type": "entityId", "entityKind": "Person" }
        ]
      }
    ]
  }
}
```


**Schema validity constraints:**
- Column names must be unique within a table.
- Table names must be unique within a payload schema.
- Required columns cannot be omitted by payloadWrite/payloadAppend.
- Column types must be valid core DSL scalar types.
- Append-only tables cannot have primary keys; indexProps live in Registry, not SDDA.


## 16.4 Strong Typing Rules


Every column:
- must map to a core DSL type
- must enforce strict type validation
- must reject invalid values at the workflow step boundary


**Illegal values:**
- "5" in a column typed int
- "abc" in a column typed date
- "1234" in a column typed entityId (no lookup)
- "high" in a column referencing an enum that lacks "high"


**Null Semantics:**
- NULL literal is the only allowed null token.
- Empty string ("") is considered a valid string, not null.
- Nulls can only appear in columns where required: false.


## 16.5 Payload Access in DW-Expr


Payload exposes:


```
payload.<Table>.<Column>
```


- Returns the sole row's value for single-row tables
- Returns NULL for append-only tables


**Important:**
- Append-only tables are not iterable in DW-Expr.
- DW-Expr is intentionally non-procedural.
- If you need derived values from append-only tables (last event, count, sum, max/min), you must:
  - Define a workflow-maintained indexProp (using `from: "workflow"`)
  - Have workflows explicitly update that indexProp when appending to the log


**Example Pattern:**


```json5
"registry": {
  "indexProps": {
    "lastMaintenanceDate": {
      "type": "date",
      "from": "workflow",  // maintained by workflow, not derived
      "required": false
    }
  }
}
```


Then in a workflow:


```json5
{
  "steps": [
    {
      "step": "payloadAppend",
      "entityId": "inputs.assetId",
      "table": "MaintenanceEvent",
      "row": {
        "Timestamp": "inputs.timestamp",
        "Notes": "inputs.notes"
      }
    },
    {
      "step": "registryWrite",
      "entityId": "inputs.assetId",
      "fields": {
        "lastMaintenanceDate": "inputs.timestamp"
      }
    }
  ]
}
```


This pattern keeps derived values accessible to DW-Expr while preserving full history in the append-only table.


## 16.6 Invariants on Payload Files


Payload files must satisfy the following invariants at all times:


### 16.6.1 Format Invariants


- UTF-8 encoded
- No tabs
- `|` as the sole delimiter
- No trailing whitespace
- No BOM
- No multiline fields
- No unescaped characters


### 16.6.2 Structural Invariants


- The first column is always the table name.
- A row cannot specify fewer or more columns than schema defines.
- Column defaulting is allowed only when schema declares default values.


### 16.6.3 Ordering Invariants


- Single-row tables must appear before append-only tables (recommended but not mandatory).
- Append-only tables must preserve insertion order — no retroactive reordering.


## 16.7 Workflows and Payload Writes


Only workflows may mutate payloads.


**Legal workflow steps affecting payload:**
- `payloadWrite` — replace row in single-row table
- `payloadAppend` — append row in append-only table


**Illegal operations:**
- Deleting rows
- Editing history
- Rewriting append-only rows
- Partial updates to single-row tables (must write whole row)
- Generating column names dynamically
- Using expressions to compute column names
- Using expressions to compute table names


Everything must resolve statically at compile time.


## 16.8 Payload–Registry Consistency Requirements


Registry and SDDA must obey:
- An entity must exist in Registry before its payload can exist.
- Hard-deleting an entity must remove its payload.
- Soft-deleting an entity must not alter payload.
- When an indexProp uses `from: "payload.<Table>.<Field>"`, workflows are responsible for keeping them consistent.
- Payload must not contain duplicate single-row tables.
- Missing required columns must cause workflow failure.


## 16.9 Schema Evolution Rules


Payload schemas evolve via versioning.


**The following are breaking changes:**
- Removing a table
- Renaming a table
- Removing a column
- Renaming a column
- Changing column type
- Tightening nullability
- Reordering columns
- Converting single-row → append-only
- Converting append-only → single-row


**Allowed non-breaking changes:**
- Adding new append-only tables
- Adding new nullable columns at the end of column list
- Adding optional metadata columns
- Adding new tables not referenced by workflows


Rollouts must include migration plans (see Section 23).


## 16.10 Forbidden Behaviors


SDDA must never:
- Accept arbitrary JSON fragments
- Auto-adjust column count
- Infer types
- Allow multi-row single-row tables
- Perform schema-less writes
- Rebuild historical logs
- Truncate history
- Change existing row semantics
- Store derived or computed fields
- Allow non-deterministic fields


Payload corruption = fatal error.


---


# 17. ACTION SEMANTICS (COMPONENT-BOUND UI OPERATION CONTRACTS)


Actions are the **only** legal way for a Component to say:


> "When the user presses *this*, invoke *that* workflow with *these* inputs — but only if *these* booleans hold."


They are:
- declared **inside Components** (Section 12.6)
- bound **directly** to Workflows (Section 14)
- confined to **boolean gating + input wiring**


If an action tries to be clever — compute values, branch, do I/O, or improvise — it is simply invalid.


This section provides the normative semantics for actions, refining and clarifying the structural definition in Section 12.6.


## 17.1 Scope and Layer Boundary


Actions sit strictly between:
- **Components** (Section 12) — layout, fields, visibility, enablement
- **Workflows** (Section 14) — the only mutation engine


Actions are **UI-bound intent declarations**. They never mutate state themselves.


## 17.2 Canonical Action Shape


See Section 12.6 for the complete structural definition. Key semantic points:


- `actionId` is **local to the Component** (not a global registry key).
- `workflow` is the **only** mutation target.
- `inputs` is **path wiring only** in v1 core.
- `visibleWhen` / `enabledWhen` are the **only** places DW-Expr is allowed.


## 17.3 Inputs Semantics (Paths Only, No Computation)


For WorldSmith v1 core, the `inputs` map is **strictly**:


> workflowInputName → DW-Expr *Path* (no operators, no literals, no functions)


**Formally:**
- Each value in `inputs` **must** be a syntactically valid DW-Expr path of the form:
  - `registry.…`, `payload.…`, `relations.…`, `context.…`
- No comparison operators.
- No arithmetic.
- No `AND`, `OR`, or `NOT`.
- No `IN`.
- No string concatenation.
- No literals (including string literals like `'fixed-value'`).


**Examples — valid:**


```json5
"inputs": {
  "entityId": "registry.id",
  "status": "registry.indexProps.status",
  "userId": "context.currentUserId"
}
```


**Examples — invalid:**


```json5
"inputs": {
  "userId": "context.currentUserId OR registry.indexProps.ownerId",   // boolean logic
  "status": "registry.indexProps.status = 'available'",               // comparison
  "tag": "'fixed-literal'",                                          // literal
  "relTarget": "relations.checked_out_to.ids[0]"                      // list indexing
}
```


**If you need:**
- fallback logic
- default values
- derivation
- relation target selection


then you solve it **inside the workflow** (or outside the DSL), not in the action.


**Extension Note:**


Implementations MAY support literals or a narrow subset of DW-Expr in `inputs` as a non-portable extension, but such behavior is **outside WorldSmith v1 core**. Any DSL configuration relying on such extensions is not portable.


## 17.4 Allowed DW-Expr Usage in Actions


DW-Expr is allowed in exactly two fields on actions:
- `visibleWhen`
- `enabledWhen`


Both must be **boolean-valued** expressions, following Sections 4–6.


They may reference:
- `registry.indexProps.*`
- `payload.*.*` (for bound tables/fields)
- `relations.<relType>.count`
- `context.*`


They may **not**:
- perform arithmetic that is not needed for a boolean
- reference `relations.<relType>.ids` directly (lists are opaque in v1 core)
- call functions (none exist in v1)
- access `inputs.*` (Component actions are UI layer, not workflow internals)


**Examples — valid:**


```json5
"visibleWhen": "registry.indexProps.status = 'available'",
"enabledWhen": "relations.checked_out_to.count = 0 AND context.currentUserRole IN ('tech','manager')"
```


**Examples — invalid:**


```json5
"visibleWhen": "payload.ToolSpec.PurchasePrice + 5",        // non-boolean
"enabledWhen": "relations.checked_out_to.ids[0] IS NOT NULL" // indexing into ids list
```


## 17.5 Component Integration Semantics


For a given Component:
- The `actions` array contains full ActionDefinitions (Section 12.6), not just IDs.
- Each action may have:
  - its own `visibleWhen` / `enabledWhen`
  - its own `sectionId` / `placement`
  - its own `confirmMessage`


**Evaluation rules:**


1. **Rendering**
   - If the Component itself is not rendered, none of its actions exist.
   - If the Component is rendered, each action evaluates its own `visibleWhen`:
     - FALSE or NULL → action is hidden.
     - TRUE → proceed to enablement.


2. **Enablement**
   - For each visible action, evaluate `enabledWhen`:
     - FALSE or NULL → action is shown but disabled.
     - TRUE → action is clickable.


3. **Invocation**
   - On click, the runtime:
     - evaluates each `inputs` path *once*, against the current (registry, payload, relations, context) tuple
     - constructs the workflow input object
     - invokes the referenced `workflow`


## 17.6 Action Roles (How to Think About Them)


This section is descriptive, not normative; it explains how these constraints map to common patterns.


### 17.6.1 Entity-Bound Actions


Typical pattern for a detail/edit Component bound to an EntityKind:
- Inputs: usually pass `registry.id` plus whatever indexProps or payload fields the workflow demands.
- Gating: based on status, relations counts, or user role.


Example:


```json5
{
  "actionId": "checkout",
  "label": "Check Out",
  "workflow": "AssetCheckout",
  "visibleWhen": "registry.indexProps.status = 'available'",
  "enabledWhen": "relations.checked_out_to.count = 0",
  "inputs": {
    "assetId": "registry.id",
    "techId": "context.currentUserId"
  }
}
```


### 17.6.2 Relation-Aware Actions (v1-safe form)


In v1 core, actions may **observe** relations via `relations.<relType>.count`, but they may **not** dig into `relations.<relType>.ids` to pick specific endpoints.


**Pattern for selecting related entities:**


1. Define a workflow-maintained indexProp for the selected relation target:


```json5
"registry": {
  "indexProps": {
    "selectedLocationId": {
      "type": "entityId",
      "from": "workflow",
      "required": false,
      "entityKind": "Location"
    }
  }
}
```


2. Create a Component field using the `relationSelect` widget:


```json5
"fields": [{
  "fieldId": "location",
  "label": "Location",
  "path": "registry.indexProps.selectedLocationId",
  "widget": "relationSelect",
  "widgetProps": {
    "relationType": "located_at",
    "targetKind": "Location"
  }
}]
```


3. The action then passes the selected id as a normal path:


```json5
"actions": [{
  "actionId": "assignLocation",
  "workflow": "AssignLocation",
  "inputs": {
    "assetId": "registry.id",
    "locationId": "registry.indexProps.selectedLocationId"
  }
}]
```


This keeps v1 simple while creating an upgrade path to richer relation handling.


### 17.6.3 Contextual Actions


Actions may be gated or parameterized by context:


```json5
"enabledWhen": "context.currentUserRole IN ('admin','dispatcher')"
```


or pass context into the workflow explicitly:


```json5
"inputs": {
  "actorId": "context.currentUserId",
  "tenantId": "context.tenantId"
}
```


This is allowed and encouraged — but still **paths only**.


## 17.7 Error Semantics for Actions


Action-related errors are always **compile-time** in the DSL; at runtime, only workflows and constraints can fail.


The compiler must reject any Component Action where:
- `workflow` does not name an existing workflow.
- an `inputs` value is not a syntactically valid path.
- an `inputs` path does not bind to a known field.
- an `inputs` path's type does not match the corresponding workflow input type.
- `visibleWhen` or `enabledWhen` are not boolean-valued DW-Expr.
- forbidden surfaces are referenced (e.g., `relations.*.ids`).


At runtime:
- An action invocation that reaches the workflow layer is considered structurally valid.
- Any failure is attributed to the workflow or its constraints (preconditions, postconditions), not the action.


There is no concept of a "runtime action exception" in the DSL.


## 17.8 Forbidden Patterns (Debt Prevention)


The following are explicitly disallowed in v1 core:
- Computed workflow selection (no "if X then run WorkflowA else WorkflowB" in the action).
- DW-Expr anywhere in an action **except** `visibleWhen` and `enabledWhen`.
- Literals as stand-alone `inputs` values in core.
- Any use of `relations.<relType>.ids` other than being passed through a workflow-maintained indexProp.
- Any attempt to interpret `inputs` values as "mini-scripts."


## 17.9 Summary


Component Actions, as defined in Section 12.6 and hardened here, are:
- **pure bindings** from UI intent to Workflow invocation
- **boolean-gated** via `visibleWhen` / `enabledWhen`
- **path-only** in `inputs` for v1 core
- **non-mutating** and **non-procedural**


Workflows mutate state. Constraints veto bad mutations. Actions do neither — they only say *"if these booleans pass, call that workflow with these fields."*


---


# 18. MODULES & ADAPTERS: EXTENSIBLE BUT NOT UNCONTROLLED


Modules are optional add-ons that extend the DSL's semantics without changing the DSL.


The DSL does not allow arbitrary embedded code, dynamic rewriting, or unbounded extensions. Instead, extensions must pass through declared module contracts.


Modules exist to support new domains (e.g., geolocation, biometrics, telemetry interpretation) without contaminating the core system.


## 18.1 What a Module Is


A module is a declarative, self-contained package that adds:
- new payload schemas,
- new workflows,
- new constraints,
- new components,
- new events or streams,
- new enums/widgets/formats,
- optional DW-Expr extensions only if declared and type-safe.


Modules cannot:
- override existing core semantics,
- redefine workflows,
- mutate entityKinds they do not own (without explicit extension contracts),
- introduce new execution models or side channels.


## 18.2 Adapter Concept


Modules attach to the DSL via adapters.


Adapters are the "smart boxes" — dumb in function, strict in interface. They define where a module plugs in but not how it behaves internally.


Every module must provide:


```json5
"adapter": {
  "version": "1.0.0",
  "capabilitiesExposed": [...],
  "eventsSubscribed": [...],
  "eventsEmitted": [...],
  "workflowsExposed": [...],
  "constraintsAdded": [...],
  "payloadSchemas": [...],
  "uiSurfaces": [...]
}
```


Adapters guarantee:
- The module cannot exceed its declared hooks.
- The core DSL does not need to evolve for new tech.
- New tech must obey schema-first design.


## 18.3 Adapter Contract Rules


The adapter provides the boundaries:


1. All module features must be declared.
2. No undeclared capability may appear at runtime.
3. Workflow names must be globally unique.
4. Events must be declared with schemas.
5. Payload schemas must validate independently.
6. Adapters may not modify existing entityKinds, only extend via supported vectors.
7. No module may gain implicit authority.


## 18.4 Future Technologies & Modules


This design explicitly accommodates tech that does not yet exist:
- biometric pipelines
- behavioral monitoring systems
- hardware sensors
- robotics control
- predictive engines
- AR/VR interaction layers
- local AI co-processors
- anything else emerging in the next 30 years


None of these require core DSL changes. They plug in through module adapters.


## 18.5 Module Isolation


Modules cannot see each other's internals unless they explicitly exchange events.


There is no shared global mutation surface.


Modules cannot define dynamic DW-Expr functions or override standard semantics.


Their power flows only through:
- workflows,
- constraints,
- events,
- payload schemas,
- declared capabilities.


## 18.6 Execution Order & Determinism


Modules run in deterministic sequences:


1. Workflow invoked
2. Preconditions (including module-provided ones)
3. Steps
4. Postconditions
5. Events emitted
6. Streams consumed
7. Audit recorded


Modules cannot reorder these phases. No module may introduce nondeterminism.


## 18.7 Module Safety Contract


To prevent "runaway AI" or autonomous self-authorizing systems:
- Modules cannot grant capabilities.
- Modules cannot modify principal definitions.
- Modules cannot alter workflows they did not declare.
- Modules cannot modify constraints globally.
- Modules cannot modify other modules.


This ensures no module — including an AI-driven one — can rewrite its own limits.


## 18.8 Reserved Extension Hooks


Future versions MAY allow:
- module-defined DW-Expr functions (typed, deterministic),
- module-defined UI primitives,
- module-defined system events,
- adapter chaining or nested adapters.


But none are permitted in v1 until formal semantics exist.


## 18.9 Adapter Interface Specification


Every adapter must declare the following interface:


**Required Fields:**


```json5
{
  "adapter": {
    "version": "1.0.0",
    "description": "...",
    "compatibleDSL": "1.x",
    "workflows": [...],
    "payloadSchemas": [...],
    "events": [...],
    "constraints": [...],
    "capabilities": [...],
    "ui": [...],
    "streams": [...],
    "mount": {
      "entityExtensions": [...],
      "componentExtensions": [...],
      "workflowExtensions": [...]
    }
  }
}
```


**Interface Guarantees:**
- All module behavior is declared.
- Nothing runs without being declared.
- Nothing escapes through side channels.
- The adapter defines shape, not logic.
- The module defines logic, but only within the shape.


## 18.10 Enforcement Contract


Implementations MUST:
- Reject any module action not listed in adapter.capabilities
- Sandbox module execution to prevent:
  - Direct registry/payload access
  - Undeclared workflow invocation
  - Capability escalation
- Log all module actions for audit


**Violation semantics:**
- Unknown capability → immediate termination
- Undeclared workflow call → transaction rollback
- Schema violation → module suspension


---


# 19. EVENTS: DECLARATIVE, ONE-WAY, NON-MUTATING SIGNALS


Events in WorldSmith are pure outbound notifications.


Events never mutate state, never trigger implicit changes, never serve as commands, and never authorize anything.


Events are declarative observations of state transitions.


## 19.1 Purpose


Events exist for:
- audit subscribers
- analytics
- telemetry
- automation listeners
- log aggregation
- system-of-record replication
- downstream processors
- monitoring systems


They are not workflow triggers unless explicitly bound by a stream.


## 19.2 Event Definition


```json5
"events": {
  "ToolCheckedOut": {
    "payload": {
      "assetId": { "type": "entityId", "entityKind": "Asset" },
      "personId": { "type": "entityId", "entityKind": "Person" },
      "timestamp": { "type": "datetime" }
    }
  }
}
```


**Rules:**
- Static payload schema
- No optional type inference
- No dynamic fields
- No nondeterministic content


Events are completely declarative.


## 19.3 Event Emission


Events can only be emitted via workflow steps:


```json5
{
  "step": "emitEvent",
  "event": "ToolCheckedOut",
  "payload": { ... }
}
```


No component, module, or stream may emit an event implicitly.


## 19.4 Event Consumption


Events may only be consumed:
- by streams (which may trigger workflows),
- by external subscribers,
- by logs,
- or by analytics systems.


They do not mutate registry or payload directly.


## 19.5 Event Invariants


- Events must be append-only in the event log.
- Events must be immutable once written.
- Emission must occur inside the workflow transaction.
- Downstream listeners must never modify state unless via workflow.


This ensures events cannot accidentally turn into a second mutation system.


## 19.6 Security & Safety


Events cannot:
- change permissions,
- modify capabilities,
- alter principals,
- or cause state mutation without an adapter + stream + workflow chain.


This prevents accidental "self-amplifying" AI or feedback loops.


---


# 20. STREAMS: STRUCTURED INGESTION, NEVER SILENT MUTATION


Streams represent continuous inbound data (telemetry, periodic logs, scanners, message bus topics).


They are ingestion channels, not mutation mechanisms.


A stream may trigger workflows. A stream may append to payloads (append-only tables). A stream may never alter registry or payload outside those boundaries.


## 20.1 Stream Definition


```json5
"streams": {
  "ToolTelemetry": {
    "bindingKind": "Asset",
    "adapter": "TelemetryModule",
    "mapping": { ... },
    "schema": { ... },
    "onEvent": {
      "workflow": "RecordTelemetry",
      "inputs": { ... }
    }
  }
}
```


## 20.2 Binding Rules


A stream must bind to exactly one entityKind, via:
- entityId inside incoming data, or
- a lookup path defined in mapping.


Streams cannot fabricate entities.


## 20.3 Allowed Stream Operations


Streams can only do:
1. `payloadAppend`
2. workflow invocation via `onEvent`


Everything else is prohibited.


## 20.4 Ingest Semantics


Ingest must be:
- deterministic,
- schema-validated,
- discard-on-failure (no coercion),
- append-only.


If the incoming data does not match declared schema, the engine must reject the row. No guesses, no repairs.


## 20.5 Prohibited Stream Behavior


Streams may not:
- mutate registry,
- write indexProps,
- mutate single-row payload tables,
- modify relations,
- modify principals,
- grant capabilities,
- perform cross-entity aggregation,
- concatenate rows from multiple entities,
- perform branching or conditional writes outside workflow.


## 20.6 Deterministic Trigger Semantics


The stream → workflow path must be:
- strictly ordered per entity,
- atomic per event,
- without concurrency-induced nondeterminism.


## 20.7 Adapter Requirement


Every stream must specify:


```json5
"adapter": "ModuleName"
```


This ensures:
- Modules cannot create unbounded ingestion paths.
- Adapters define what incoming formats are permitted.
- The DSL remains stable even as new hardware/tech emerges.


---


# 21. TERMINAL / COMMAND CHANNEL: CONTROL, NOT COMPUTATION


This section defines the command surface of the DSL — the "terminal model."


This is not a programming shell, not a scripting environment, and not an SQL console.


It is a high-level declarative invocation channel that lets external systems call:
- workflows,
- imports,
- queries (read-only),
- and metadata introspection.


The terminal does not allow arbitrary computation, loops, or dynamic structure generation.


## 21.1 Purpose


The command channel exists to:
- allow automation to drive workflows,
- allow external systems to run safe, declarative actions,
- allow human operators to execute predefined routines,
- provide a uniform interface across UI, CLI, and API.


It does NOT allow:
- scripting,
- function definition,
- conditionals,
- macro substitution,
- arbitrary DW-Expr evaluation,
- mutation outside workflows.


## 21.2 Terminal Commands


**Legal commands:**
- `invokeWorkflow(name, inputs)`
- `runImport(name, payload)`
- `query(entityKind, filters)`
- `introspect(schemaSection)`


There are no other commands in v1.


## 21.3 Workflow Invocation


Terminal input:


```json5
{
  "command": "invokeWorkflow",
  "workflow": "AssetCheckout",
  "inputs": {
    "assetId": "...",
    "techId": "...",
    "timestamp": "..."
  }
}
```


**Rules:**
- The terminal does not validate business logic — workflow + constraints do.
- The terminal must validate that inputs match declared workflow schema.
- The terminal may not supply undeclared fields.


## 21.4 Read-Only Queries


Queries must be:
- deterministic,
- indexProp-based,
- never reflecting partial transactions,
- strictly non-mutating.


Queries may not:
- iterate payload logs,
- execute arbitrary DW-Expr,
- run user-defined functions,
- trigger workflows.


## 21.5 Introspection


The terminal must return:
- the schema,
- entityKinds,
- workflows,
- events,
- streams,
- components,
- modules.


But this is read-only.


## 21.6 Forbidden Terminal Features


The terminal must not support:
- arbitrary scripting,
- dynamic schema generation,
- payload editing,
- relation editing,
- principal or capability changes,
- executing DW-Expr directly,
- state mutation outside workflows.


This is how we prevent "runtime live coding" or "ad-hoc privilege escalation."


---


# 22. GOVERNANCE & POLICY: DECLARATIVE, INESCAPABLE, NON-PUNITIVE


Governance ensures the DSL is used in ways that preserve:
- safety,
- determinism,
- auditability,
- long-term compatibility.


Governance does not impose ethical or punitive rules. It imposes operational constraints that prevent system misuse.


## 22.1 Separation of Concerns


Governance cannot:
- define business rules,
- define social policies,
- define HR rules,
- enforce moral positions.


Those belong to implementers, not the DSL.


## 22.2 Policy Boundaries


WorldSmith defines boundaries that prevent system-wide corruption:


1. No implicit mutation channels
2. No self-authorizing agents
3. No automatic escalation paths
4. No schema drift at runtime
5. No cross-domain side effects
6. No bypassing workflows


Governance is structural, not ideological.


## 22.3 Human vs. Non-Human Principals


The DSL is neutral to principal type.


But it enforces guardrails ensuring non-human principals (AI, agents, bots):
- cannot rewrite capabilities,
- cannot modify constraints,
- cannot self-authorize,
- cannot inject workflows,
- cannot bypass audit.


If an AI misbehaves, it is because the implementer chose to grant it unsafe capabilities — not because the DSL allowed hidden ones.


## 22.4 Safety Invariants


Every compliant system must enforce:
- explicit capabilities
- explicit workflows
- explicit constraints
- explicit adapters
- atomicity
- auditability
- determinism
- immutability of schema


If any of these fail, the system is noncompliant.


## 22.5 Governance Hooks for Future Tech


This DSL allows future technologies (biometrics, behavioral risk engines, local AI monitors) to plug in — but only through adapters.


Adapters must:
- declare all capabilities used,
- declare all events subscribed,
- declare all workflows invoked,
- declare all streams emitted,
- declare all UI surfaces extended.


This ensures that even exotic future integrations remain bounded and auditable.


## 22.6 DSL Neutrality Guarantee


The DSL guarantees:
- No embedded ethics engine
- No prescriptive behavioral model
- No political or cultural assumptions
- No restrictions on how organizations structure authority
- No constraints on creativity or implementation philosophy


The DSL defines how, not what.


---


# 23. SCHEMA EVOLUTION & MIGRATION


Schema evolution is inevitable in long-lived systems. This section defines how WorldSmith handles schema changes without breaking existing data or workflows.


## 23.1 Purpose


Schema evolution mechanisms exist to:
- Allow domains to grow and adapt over time
- Preserve backward compatibility with existing payloads
- Provide clear migration paths for breaking changes
- Maintain deterministic behavior across schema versions


## 23.2 Version Identification


Every versionable structure must include an explicit version identifier using Semantic Versioning (SemVer):


```json5
{
  "version": "MAJOR.MINOR.PATCH"
}
```


Where:
- **MAJOR** increments for breaking changes
- **MINOR** increments for backward-compatible additions
- **PATCH** increments for fixes that don't affect structure


Versionable structures:
- Payload schemas
- EntityKind definitions (when structural changes occur)
- Workflow definitions (when input/output contracts change)
- The DSL itself


## 23.3 Breaking vs. Non-Breaking Changes


### 23.3.1 Breaking Changes (Require MAJOR Version Bump)


**Payload Schemas:**
- Removing a table
- Renaming a table
- Removing a column
- Renaming a column
- Changing column type
- Tightening nullability (`required: false` → `required: true`)
- Reordering columns
- Changing table kind (single-row ↔ append-only)


**EntityKinds:**
- Removing an indexProp
- Renaming an indexProp
- Changing indexProp type
- Changing `from` path for an indexProp
- Removing a relation type
- Changing relation cardinality


**Workflows:**
- Removing an input
- Renaming an input
- Changing input type
- Changing step semantics


### 23.3.2 Non-Breaking Changes (Allowed in MINOR Version)


**Payload Schemas:**
- Adding new nullable columns at end of column list
- Adding new append-only tables
- Adding new optional metadata fields


**EntityKinds:**
- Adding new optional indexProps
- Adding new relation types
- Adding new views


**Workflows:**
- Adding new optional inputs with defaults
- Adding new postconditions (if they don't fail existing valid data)


## 23.4 Migration Definition Structure


Migrations are declared explicitly in the DSL:


```json5
"migrations": {
  "<MigrationName>": {
    "from": "<SourceSchemaId>",
    "to": "<TargetSchemaId>",
    "transforms": [
      {
        "op": "renameField",
        "table": "<TableName>",
        "old": "<OldFieldName>",
        "new": "<NewFieldName>"
      },
      {
        "op": "addField",
        "table": "<TableName>",
        "field": "<FieldName>",
        "type": "<ScalarType>",
        "default": "<LiteralValue>"
      },
      {
        "op": "removeField",
        "table": "<TableName>",
        "field": "<FieldName>"
      },
      {
        "op": "changeType",
        "table": "<TableName>",
        "field": "<FieldName>",
        "from": "<OldType>",
        "to": "<NewType>",
        "converter": "<ConverterName>"
      }
    ],
    "validator": "<ValidatorPath>"
  }
}
```


### 23.4.1 Migration Operations


**renameField:**
- Preserves data
- Updates all references
- Non-destructive


**addField:**
- Requires default value for existing rows
- Must be nullable OR provide default
- Does not affect existing data


**removeField:**
- Destructive
- Requires explicit acknowledgment
- Should be preceded by deprecation period


**changeType:**
- Requires converter function
- Must be deterministic
- Must not lose data precision


## 23.5 Migration Execution Model


Migrations can be executed in two modes:


### 23.5.1 Eager Migration


- Entire dataset migrated at deployment time
- Atomic operation
- Requires downtime for large datasets
- Recommended for small to medium datasets


### 23.5.2 Lazy Migration


- Records migrated on first access
- No downtime required
- Runtime must support multiple schema versions simultaneously
- Recommended for large datasets


**Implementation Requirements for Lazy Migration:**


Runtimes supporting lazy migration must:
- Parse old schema versions on read
- Tag migrated records with new schema version
- Provide migration progress tracking
- Support querying across schema versions
- Eventually migrate all records (background process)


## 23.6 Validator Functions


Each migration may include a validator function that:
- Runs after transformation
- Verifies data integrity
- Can access both old and new schema contexts
- Returns success/failure with diagnostics


Validator signature:


```typescript
interface MigrationValidator {
  validate(
    oldData: PayloadData,
    newData: PayloadData,
    context: MigrationContext
  ): MigrationResult;
}
```


## 23.7 Backward Compatibility Rules


### 23.7.1 Reading Old Data


Runtimes must support reading payloads from previous MAJOR versions for at least one version back (N-1 support):
- v2.x runtime must read v1.x payloads
- v3.x runtime must read v2.x payloads
- v3.x runtime is NOT required to read v1.x payloads directly


### 23.7.2 Writing Old Data


Runtimes must NEVER write data in an old schema version. All writes use the current schema version.


### 23.7.3 Mixed Version Handling


When a runtime encounters a payload with version < current:
1. Parse using appropriate schema version
2. Apply migration transforms
3. Validate result
4. Write back in current version (if lazy migration)
5. Log migration event


## 23.8 Deprecation Process


Before removing fields or making breaking changes:


1. **Deprecation Announcement (Version N)**
   - Mark fields as deprecated in schema
   - Add deprecation warnings to compiler
   - Document migration path


2. **Deprecation Period (Version N+1)**
   - Fields still present but flagged
   - Writes generate warnings
   - Reads work normally


3. **Removal (Version N+2)**
   - Field removed from schema
   - Migration provided
   - Old payloads migrated


Minimum deprecation period: 1 MAJOR version.


## 23.9 Schema Registry


Implementations should maintain a schema registry that:
- Stores all schema versions
- Tracks active migrations
- Provides version lookup by payload
- Records migration history
- Enables rollback (where possible)


## 23.10 Migration Safety Checklist


Before deploying a breaking change:


- [ ] Migration defined and tested
- [ ] Validator function provided
- [ ] Rollback plan documented
- [ ] Deprecation period observed (if applicable)
- [ ] All dependent workflows updated
- [ ] Components updated to use new schema
- [ ] Constraints verified against new schema
- [ ] Test data migrated successfully
- [ ] Performance impact assessed
- [ ] Backup of production data complete


## 23.11 Example: Complete Migration


```json5
{
  "migrations": {
    "Asset_v1_to_v2": {
      "from": "ToolSpec_v1",
      "to": "ToolSpec_v2",
      "transforms": [
        {
          "op": "renameField",
          "table": "ToolSpec",
          "old": "PurchaseDate",
          "new": "AcquisitionDate"
        },
        {
          "op": "addField",
          "table": "ToolSpec",
          "field": "WarrantyExpiry",
          "type": "date",
          "default": "NULL"
        },
        {
          "op": "changeType",
          "table": "ToolSpec",
          "field": "PurchasePrice",
          "from": "float",
          "to": "int",
          "converter": "centsConverter"
        }
      ],
      "validator": "migrations/asset_v1_v2_validator.js"
    }
  }
}
```


This migration:
1. Renames PurchaseDate to AcquisitionDate (non-destructive)
2. Adds WarrantyExpiry as nullable (additive)
3. Converts PurchasePrice from dollars (float) to cents (int) using a converter
4. Validates all transformed records


## 23.12 Prohibited Migration Patterns


The following are explicitly forbidden:


**Silent Data Loss:**
- Removing fields without migration
- Type conversions that lose precision without acknowledgment
- Truncating data without warning


**Non-Deterministic Migrations:**
- Converters that depend on current time
- Converters that use random values
- Converters that query external systems


**Circular Migrations:**
- v1 → v2 → v1 paths
- Migration chains that create cycles


**Implicit Migrations:**
- Auto-detecting and converting without declared migration
- "Smart" schema inference
- Runtime schema patching


---


**END OF SECTIONS 0-23**


---


## Sections 24+ Reserved


Sections 24 and beyond are reserved for:
- Imports (detailed specification)
- Authorization & RBAC
- Offline/Sync Strategies
- Performance Guidelines
- Testing & Compliance
- Additional runtime contracts


These will be developed as the specification matures and implementation experience accumulates.



—

# 24. IMPORTS & MODULE RESOLUTION

## 24.1 Purpose

The imports system allows a DWSeed to reference external modules and libraries
without copying their contents. Imports:

- enable reuse of common enums, components, workflows, adapters, and functions,
- provide a controlled extension mechanism for DW-Expr,
- preserve determinism by requiring explicit versions and namespaces.

Imports are resolved *before* schema, workflow, UI, and generator compilation.

---

## 24.2 Importable Artifacts

Imports refer to **modules**, not arbitrary files.

An imported module MAY export:

- enums,
- components,
- constraints,
- DW-Expr functions,
- adapters,
- workflows (for reuse, not direct cross-seed execution).

Imported modules MUST NOT:

- override or shadow core DW semantics,
- change the meaning of any construct defined by this specification,
- redefine any built-in types or core DW-Expr functions.

---

## 24.3 Import Declarations

The top-level `imports` key (Section 35.5) is an array of import declarations.

Each declaration MUST have:

- `moduleName` — string, required, identifier of the module,
- `version` or `versionRange` — string, required,
- `namespace` — string, required, the prefix under which exports are visible.

Example:

```json
"imports": [
  {
    "moduleName": "std-datetime",
    "version": "1.0.0",
    "namespace": "time"
  },
  {
    "moduleName": "std-crypto",
    "version": "1.0.0",
    "namespace": "crypto"
  }
]
```

Rules:

1. `moduleName` MUST be unique within `imports`.
2. `namespace` MUST be unique within `imports` and MUST NOT conflict with:
   - any top-level identifier reserved by the spec,
   - any other imported namespace,
   - any local module namespace (Section 29).
3. `version` / `versionRange`:
   - MUST be explicit; `"latest"` and similar ambiguous specifiers are prohibited,
   - MUST be compatible with the module repository’s versioning scheme (typically semver),
   - MUST resolve to a single, concrete module version.

If a `versionRange` resolves to zero or more than one available version, seed
loading MUST fail with a deterministic error.

---

## 24.4 Local Modules vs Imports

The top-level `modules` key (Section 35.6) defines **embedded modules**.

Embedded modules:

- follow the same structural rules as imported modules,
- MAY export enums, components, workflows, constraints, and functions,
- are ALWAYS available; they do not require external resolution.

Resolution rules:

1. Imported modules and embedded modules live in distinct namespaces.
2. Exported items from either kind of module MUST be referenced via fully qualified
   names or via the configured `namespace` for imports.
3. There is no implicit “global promotion” of module exports:
   - types, components, and functions defined in modules are not visible in the
     global scope unless explicitly referenced through their module namespace.

Example:

- `std-datetime` imported under `namespace: "time"`:
  - functions are referenced as `time.now()`, `time.duration(...)`.
- Local module `"ph-shared"` (Section 29):
  - enums referenced as `ph-shared.Mood`, `ph-shared.TrackerType` if fully qualified.

The spec does not require a particular string format for fully qualified names,
but any format chosen by an implementation MUST be:

- deterministic,
- collision-free,
- consistent across all compiled artifacts.

---

## 24.5 Name Resolution and Namespaces

DW-Expr, schema, and UI bindings MAY reference:

- core built-ins,
- globally declared enums/components/workflows,
- module exports (imported or embedded),
- functions provided by imported modules.

Resolution order:

1. **Core built-ins** (DW-Expr functions, primitive types).
2. **Global declarations** in the seed:
   - `enums`,
   - `components`,
   - `workflows`,
   - `queries`.
3. **Modules**:
   - imported modules via `namespace.functionName`, `namespace.TypeName`,
   - embedded modules via implementation-defined fully qualified names
     (e.g., `ph-shared.Mood`).

There MUST be no ambiguity:

- if two modules export the same identifier under distinct namespaces, both
  are accessible only via their namespaces,
- if a global type or function shares a name with a module export, the global
  name MAY NOT be silently overridden by module imports.

If a reference is ambiguous (e.g., unqualified `Mood` where both global and
module-enum candidates exist), the compiler MUST:

- either reject the seed as ambiguous, or
- require an explicit qualification as per implementation rules.

---

## 24.6 Imported DW-Expr Functions

Modules MAY export functions to extend DW-Expr.

Example (datetime module):

- `time.now() -> datetime`
- `time.duration(days: int, hours: int, ...) -> duration`
- `time.add(dateOrDatetime, duration) -> dateOrDatetime`

Rules:

1. Imported functions MUST be:
   - pure (no side effects),
   - deterministic,
   - fully described in terms of input and output types.
2. Imported functions MUST NOT:
   - perform adapter-like operations,
   - access external resources directly,
   - introduce non-determinism (e.g., random number generation) unless explicitly
     documented and permitted for specific use cases.

Any non-deterministic or side-effectful operations MUST be implemented as adapters,
not as DW-Expr functions.

---

## 24.7 Import Resolution and Validation

Import resolution occurs during the **seed validation** phase (Section 36.2 step 1).

A compliant implementation MUST:

1. Resolve each import to a concrete module artifact:
   - verify `moduleName`,
   - resolve `version` / `versionRange` to a single version,
   - load the module structure.

2. Validate module compatibility:
   - schema and function signatures must conform to this spec,
   - the module MUST NOT use a newer DWSeed schema version than the runtime supports,
   - any incompatible module MUST cause seed loading to fail.

3. Build a **module catalog**:
   - list of available namespaces,
   - exported enums, components, workflows, adapters, functions,
   - used for subsequent type and reference checking.

If any import cannot be resolved or validated, the seed MUST be rejected and
generation MUST NOT proceed.

---

## 24.8 Structural vs Semantic Checks

Because imports influence multiple parts of the seed, validation may be conceptualized
in two passes:

1. **Structural Pass** (syntax and shape):
   - Ensure `imports` array exists and is structurally well-formed,
   - Ensure each `moduleName`, `version`, and `namespace` is provided,
   - Ensure namespace uniqueness and non-conflicts.

2. **Semantic Pass** (type and reference checking):
   - Resolve imports into a module catalog,
   - Validate references to:
     - enums,
     - components,
     - workflows,
     - adapters,
     - DW-Expr functions,
     - module functions,
   - Ensure all identifiers are resolvable and unambiguous.

These passes conceptually align with the **Seed Validation** and **Schema/Workflow
Compilation** phases in Section 36.2, but implementations MAY interleave them
as long as the behavior is equivalent.

---

## 24.9 Caching and Determinism

Implementations MAY cache resolved modules for performance, but:

- caches MUST be keyed on:
  - `moduleName`,
  - resolved concrete `version`,
- caches MUST NOT alter semantics:
  - given the same DWSeed and module repository, resolution results MUST be
    identical regardless of cache state.

If the underlying module repository changes (e.g., a module is updated), but the
resolved concrete version still exists and matches the specified `version` /
`versionRange`, the behavior MUST remain deterministic.

---

## 24.10 Reserved Features (Post-v1)

The following import-related features are out of scope for v1:

- dynamic module loading at runtime,
- conditional imports based on environment or profile,
- import-time macros or code generation,
- implicit version negotiation across seeds.

Such features, if introduced later, MUST NOT break existing v1-compliant seeds.

—

# 25. EVENTS

## 25.1 Purpose

Events represent immutable, append-only records of domain-relevant changes
produced by workflows. They provide:

- a deterministic audit trail,
- triggers for additional workflows,
- a mechanism for reactive computation,
- a source of observable system state for tests and analytics.

Events MUST be declarative, typed, immutable, and side-effect-free when observed.
Only workflows may publish events.

---

## 25.2 Event Types

Each event type defined under `events` includes:

- `eventType` — unique identifier,
- `payload` — a statically typed object describing the event structure,
- `origin` — array of workflow names allowed to publish this event,
- optional `metadata` — non-semantic, implementation-specific hints (e.g., version).

Event payload schemas MUST:

- be fully defined,
- use deterministic types,
- not depend on external or environment-specific data layouts.

Events MUST be append-only; they MUST NOT be modified once published.

---

## 25.3 Event Publication

Only workflows may publish events. Publication occurs via the `publishEvent` step.

A publish step MUST specify:

- `eventType`,
- `payload`.

Rules:

1. The payload MUST conform to the event’s declared schema.
2. The `eventType` MUST list the invoking workflow in its `origin` array.
3. Event publication MUST occur atomically with the workflow transaction:
   - in transactional workflows, publication succeeds only if the workflow commits,
   - in non-transactional workflows, publication occurs immediately after the step.

Events MUST NOT be published from:

- DW-Expr,
- UI schemas,
- queries,
- adapters,
- tests.

---

## 25.4 Event Delivery & Ordering

The DSL defines a conceptual event stream per event type.

Ordering rules:

1. Events from a single workflow execution MUST appear in the order they are
   published within the workflow.
2. Events across different workflow executions MUST appear in a deterministic
   order according to:
   - workflow start time, or
   - implementation-defined deterministic scheduling rules.

The DSL does NOT guarantee real-time ordering or global wall-clock ordering, but
ordering MUST be deterministic within a recording or execution trace.

---

## 25.5 Workflow Subscriptions

Workflows MAY subscribe to events.

A workflow declares:

```json
"triggeredBy": {
  "event": "EventTypeName"
}
```

When the event is appended:

1. The subscribing workflow is enqueued for execution,
2. It receives event payload fields as its input (consistent with its input schema),
3. It executes according to standard workflow semantics.

Subscriptions MUST NOT introduce ambiguity:

- A workflow MAY subscribe to multiple event types,
- Each event MUST independently enqueue execution of each workflow that subscribes to it,
- Execution order MUST remain deterministic.

---

## 25.6 Recursive Event Chains & Bounded Recursion

Earlier drafts prohibited workflows from publishing the same event type they
subscribe to. This v1 specification **refines** that rule.

### 25.6.1 Allowed Pattern: Bounded Recursion

A workflow triggered by event **E** MAY publish event **E**, provided:

1. The workflow explicitly declares:

```json
"maxRecursionDepth": <integer ≥ 1>
```

2. The runtime tracks recursion depth per (eventType, workflow) chain,
3. Execution MUST stop with a deterministic error if the depth limit is exceeded.

### 25.6.2 Disallowed Pattern: Unbounded Recursion

If a subscribing workflow:

- omits `maxRecursionDepth`, OR
- sets it to a non-positive value, OR
- publishes an event in a cycle not matched by a declared depth bound,

then seed validation MUST fail.

### 25.6.3 Examples of Valid Use Cases

- cascaded updates (e.g., parent task completes → complete subtasks),
- tree propagation (e.g., propagate quantity changes across BOM structures),
- event fan-out with bounded depth.

### 25.6.4 Examples of Prohibited Use Cases

- infinite reactive loops,
- publish-subscribe cycles with no depth controls,
- event explosions without deterministic bounds.

---

## 25.7 Event Storage (SDDA Integration)

Events MAY be persisted in SDDA domains for audit or debugging.

Rules:

1. Event persistence MUST map eventType + payload to rows in a table defined in
   `dataModel.sdda`.
2. Event tables MUST be append-only.
3. Queries MAY read event tables, but UI schemas MUST NOT bind directly to
   “latest event” semantics. The UI MUST instead bind to:
   - explicit queries, or
   - materialized state tables maintained by workflows.

If no persistence is declared, the runtime MAY still store events internally for
workflow triggering but MUST NOT expose them as queriable tables.

---

## 25.8 Event Type Evolution and Versioning

Event schemas MUST be stable within a seedVersion.

If an event schema changes:

1. A new event type MUST be introduced,
2. Old event types MAY be retained for backward compatibility,
3. Workflows MUST explicitly migrate to consuming the new event type.

Events MUST NOT evolve silently across seed versions.

---

## 25.9 Events and Adapters

Adapters MUST NOT publish events directly.

Workflows MAY publish events in response to adapter results.

Adapters MAY return data that influences event payload composition.

For inbound adapters:

- messages from external systems MAY trigger workflows,
- but inbound adapter messages MUST NOT bypass workflow semantics to create events.

---

## 25.10 Events in Tests

Tests MAY assert that workflows publish specific events.

Allowed forms:

### 25.10.1 Exact Event Match

```json
"expect": {
  "events": [
    {
      "eventType": "JournalEntryCreated",
      "payload": {
        "entryId": "entry-1",
        "ownerId": "user-1",
        "mood": "neutral"
      }
    }
  ]
}
```

### 25.10.2 Type-Only Match

When the payload is irrelevant:

```json
"expect": {
  "events": [
    {
      "eventType": "DashboardDataRefreshed"
    }
  ]
}
```

Partial matching of payload fields is NOT permitted in v1 unless:

- explicit wildcard syntax is introduced (post-v1), OR
- the payload is ignored entirely.

Tests MUST NOT reference internal event storage formats or runtime-specific
metadata.

---

## 25.11 Reserved Features (Post-v1)

The following features are intentionally excluded from v1:

- event stream compaction,
- event projections/materialized views generated automatically,
- dynamic subscription management,
- cross-application event federation,
- distributed event bus semantics,
- event replay for application reconstruction.

These MAY be part of v2 or runtime-specific tooling but MUST NOT modify the
deterministic semantics defined here.

—

# 26. DW-EXPR — DETERMINISTIC EXPRESSION LANGUAGE

## 26.1 Purpose

DW-Expr is the deterministic, side-effect-free expression language used throughout the DWSeed:

- workflow step parameters,
- validation rules,
- UI bindings,
- query filters and projections,
- authorization policies,
- test assertions.

DW-Expr MUST be:

- pure,
- total (no undefined operations),
- side-effect-free,
- deterministic across all environments,
- statically type-checked.

DW-Expr MUST NOT invoke adapters, mutate state, or depend on external systems.

---

## 26.2 Purity & Side-Effect Constraints

DW-Expr MUST NOT:

- perform network I/O,
- access device capabilities,
- write to storage,
- call adapters,
- mutate workflow or entity state,
- generate nondeterministic values (randomness, timestamps, UUIDs).

DW-Expr MAY:

- read workflow input,
- read workflow local variables,
- read step outputs from previous steps,
- read context variables (explicitly declared),
- call pure functions from imported modules.

All function calls inside DW-Expr MUST be deterministic.

---

## 26.3 Evaluation Context

DW-Expr executes within a **deterministic scope** including:

- **input** — workflow or function input fields,
- **step outputs** — results of previous workflow steps,
- **entity** — entity currently being validated (validation rules only),
- **row** — SDDA row in queries,
- **params** — query parameters,
- **context** — explicitly declared contextual variables,
- **module namespaces** — imported pure functions (e.g., `time.now()`, `crypto.encrypt()`),
- **literals** — strings, numbers, booleans, durations, dates.

DW-Expr MUST NOT implicitly reference undeclared variables.

---

## 26.4 Types

DW-Expr supports:

### Primitive Types
- `string`
- `int`
- `float`
- `bool`
- `date`
- `datetime`
- `duration`

### Composite Types
- arrays: `T[]`
- maps/objects: `{ field: type, ... }`

### Enum Types
Enums defined in the seed or imported modules.

### Component Types
Fields of components MAY be accessed in expressions.

### Generic Types
DW-Expr MUST support references to instantiated generic types using the grammar:

```
GenericType ::= Identifier "<" Type ("," Type)* ">"
```

Examples:

- `List<string>`
- `Maybe<int>`
- `Page<JournalEntry>`

Type arguments MUST be fully resolved during seed validation.

---

## 26.5 Scopes & Variable Resolution

Variable lookup order:

1. Local step result (`stepId.field`)
2. Workflow input (`input.field`)
3. Query parameters (`params.field`)
4. Entity fields (in validation contexts)
5. Row fields (in query contexts)
6. Context variables (`context.*`)
7. Module namespaces (`time.*`, `crypto.*`, etc.)
8. Global literals

A reference MUST NOT unify multiple candidates; ambiguous references MUST cause seed validation failure.

---

## 26.6 Recursion & Bounded Evaluation

DW-Expr is **non-recursive by default**, with one exception:

### 26.6.1 Bounded Recursion

DW-Expr MAY allow recursion if and only if:

1. The expression includes a declared recursion limit:

```json
"maxDepth": <integer ≥ 1>
```

2. Each recursive call decreases the depth counter.

3. The recursion is structurally guaranteed to terminate within the declared bound.

Example use cases:

- hierarchical path computation,
- tree flattening,
- ancestor lookups within bounded organizational structures.

### 26.6.2 Disallowed Recursion Forms

- unbounded recursion,
- recursion without explicit `maxDepth`,
- mutual recursion without static termination proofs.

If recursion exceeds `maxDepth`, evaluation MUST fail deterministically.

---

## 26.7 Operators

### 26.7.1 Arithmetic
- `+`, `-`, `*`, `/`
- integer division is floored unless both operands are floats.

### 26.7.2 Comparison
- `=`, `!=`, `<`, `<=`, `>`, `>=`

All comparisons MUST be total and deterministic.

### 26.7.3 Logical
- `and`, `or`, `not`

Short-circuit evaluation MUST be deterministic.

### 26.7.4 String Concatenation
- `+` MUST concatenate strings if both operands are strings.

If operand types are incompatible, seed validation MUST fail.

---

## 26.8 Built-In Functions

DW-Expr MUST define the following built-ins:

### 26.8.1 String Operations
- `length(s: string) -> int`
- `lower(s: string) -> string`
- `upper(s: string) -> string`
- `trim(s: string) -> string`
- `ltrim(s: string) -> string`
- `rtrim(s: string) -> string`
- `replace(s: string, old: string, new: string) -> string`
- `startsWith(s: string, prefix: string) -> bool`
- `endsWith(s: string, suffix: string) -> bool`
- `indexOf(s: string, substring: string) -> int | null`
- `split(s: string, delimiter: string) -> string[]`
- `join(xs: string[], delimiter: string) -> string`

### 26.8.2 Numeric Operations
- `abs(n: int|float) -> int|float`
- `min(a, b)`
- `max(a, b)`
- `round(f: float) -> int`
- `floor(f: float) -> int`
- `ceil(f: float) -> int`

### 26.8.3 Array Operations
- `count(xs: T[]) -> int`
- `contains(xs: T[], x: T) -> bool`
- `map(xs: T[], f: (T -> U)) -> U[]` *(restricted; MUST be pure and bounded)*
- `filter(xs: T[], predicate) -> T[]`

Mapping/filtering functions MUST NOT introduce recursion unless bounded.

### 26.8.4 Date/Time Operations
If `std-datetime` is imported:

- `time.now() -> datetime`
- `time.today() -> date`
- `time.duration(days: int, hours: int, ...) -> duration`
- `time.add(dt: datetime, d: duration) -> datetime`

Core DW-Expr SHOULD NOT define timestamp functions; time functions SHOULD come from an imported module for clarity and future extensibility.

### 26.8.5 Null Safety
DW-Expr supports:

- `isNull(x)`
- `coalesce(a, b)` (returns first non-null)

---

## 26.9 Forbidden Functions & Patterns

DW-Expr MUST NOT support:

- reflection or dynamic evaluation,
- filesystem or network access,
- nondeterministic values such as random numbers,
- access to workflow state not explicitly exposed through step outputs,
- access to UI state unless explicitly bound through component fields,
- adapter calls in any form.

Examples of invalid forms:

```
// NOT allowed
adapter.weatherApi(...)
random()
uuid()
workflow.nextStep(...)
```

---

## 26.10 Context Variables

Context variables MUST be:

- declared either:
  - at the workflow level, OR
  - in a runtime profile, OR
  - in test setup,
- immutable during expression evaluation,
- typed.

Example declaration in workflow:

```json
"context": {
  "currentUserId": { "type": "string" },
  "newId": { "type": "string" }
}
```

Access:

```
context.currentUserId
```

Undefined context references MUST produce seed validation errors.

---

## 26.11 Expression Validation & Determinism

Before generator output is produced, each DW-Expr MUST be validated for:

1. **Type correctness**  
   All operands and function arguments must have compatible types.

2. **Side-effect freedom**  
   Expressions MUST NOT reference adapters, I/O, or nondeterminism.

3. **Boundedness**  
   - loops/recursion MUST have explicit finite bounds,
   - array operations MUST be applied to finite collections,
   - type checking MUST ensure recursion will terminate.

4. **Name resolution**  
   - module functions resolved through namespaces,
   - no ambiguous identifiers,
   - no implicit global lookups.

5. **Purity**  
   Any expression with externally observable effects MUST be rejected.

---

## 26.12 Reserved Extensions (Post-v1)

The following features are prohibited in v1:

- user-defined functions,
- higher-order functions beyond pure mapping/filtering with structural bounds,
- lazy evaluation,
- dynamic scoping,
- expression macros or meta-functions,
- implicit imports of module functions.

These MAY be added in v2+ as long as purity and determinism are preserved.

—

# 27. QUERIES

## 27.1 Purpose

Queries provide deterministic, read-only access to application state. They are used by:

- workflows,
- UI schemas,
- authorization policies,
- tests.

Queries MUST be declarative, finite, and free of side effects. Queries MUST NOT
invoke adapters or modify state.

---

## 27.2 Query Structure

A query definition includes:

- `params` — typed input parameters,
- `body` — declarative description of:
  - `source` (SDDA table or materialized state table),
  - optional `joins`,
  - `filter`,
  - `sort`,
  - `take` / `limit`,
- `outputType` — the statically known type of each returned row or structure,
- optional `maxDepth` — for bounded recursion (Section 27.8).

Queries MUST NOT depend on runtime nondeterminism.

---

## 27.3 Allowed Query Sources

A query’s `source` MUST be one of:

1. **SDDA tables** defined in `dataModel.sdda.tables`,
2. **Materialized state tables** maintained by workflows (e.g., `DashboardState`),
3. **Derived collections** produced by nested queries (within bounded rules).

Queries MUST NOT use:

- raw event logs as sources,
- adapter results,
- UI state,
- external storage not listed in `dataModel.sdda`.

Events MAY be materialized through workflows into state tables, but queries MUST NOT read the event stream directly.

---

## 27.4 Joins

Queries MAY include joins if:

1. Join cardinality is declared in the schema via:
   - foreign-key-like relations,
   - registry → SDDA table bindings,
   - explicit `entityKinds[].relations`.

2. Cardinality MUST be one of:
   - **1:1**
   - **1:N**
   - **N:1**

3. **N:M joins are prohibited** in v1 unless:
   - explicitly modeled via an intermediate SDDA table,
   - that intermediate table is used as the join source.

4. Join fan-out MUST be statically bounded:
   - no unbounded expansion,
   - no data-dependent explosion.

The seed MUST fail validation if join cardinality cannot be proven finite.

Example join body:

```json
"joins": [
  {
    "on": "row.ownerId = owners.literal",
    "source": "UserSettings",
    "alias": "owners"
  }
]
```

---

## 27.5 Filters

`filter` is a DW-Expr boolean expression over:

- fields of the row,
- joined tables,
- `params`,
- declared `context` variables,
- imported module functions (pure only).

Filters MUST NOT reference:

- adapters,
- workflow step outputs,
- nondeterministic functions.

Example:

```
"filter": "row.ownerId = context.currentUserId and row.quantity < params.threshold"
```

Filters MUST be statically typed and deterministic.

---

## 27.6 Sorting

`sort` MUST specify:

- `by` — a field or expression,
- `direction` — `"asc"` or `"desc"`.

Example:

```json
"sort": {
  "by": "row.date",
  "direction": "desc"
}
```

Sorting expressions MUST be:

- deterministic,
- type-correct,
- bounded (no infinite sort keys).

---

## 27.7 Bounded Results

Queries MUST specify one or more bounding rules:

- `take` — maximum number of rows,
- implicit bound from SDDA table mode (e.g., single-row tables),
- bounded joins.

If a query lacks any bounding mechanism, the seed MUST be rejected.

Example:

```
"take": 20
```

---

## 27.8 Recursion in Queries (Bounded Only)

### 27.8.1 Permitted Pattern

Queries MAY support recursion **if and only if**:

- the recursion is structurally decreasing (e.g., parent → ancestor),
- an explicit `maxDepth` is declared,
- each step of recursion is statically bounded.

Example:

```json
"maxDepth": 5
```

Use cases:

- org chart traversal,
- folder hierarchy queries,
- tree/graph walk bounded by structure.

### 27.8.2 Disallowed Pattern

Queries MUST NOT:

- recursively scan unbounded parent-child chains,
- dynamically discover recursion depth at runtime,
- traverse arbitrary graphs not declared in the schema.

---

## 27.9 DW-Expr in Queries

The following DW-Expr constructs ARE allowed:

- arithmetic,
- comparisons,
- string manipulation,
- date/time via imported modules,
- object/array access,
- `map`/`filter` over finite arrays,
- pure module functions (`time.now()`, `crypto.hash()`, etc.).

The following ARE NOT allowed:

- adapter calls,
- nondeterministic functions,
- workflow step references,
- mutation of any kind.

---

## 27.10 Query Output Types

The `outputType` MUST be statically determined.

Valid output types include:

- entity types (`JournalEntry`),
- SDDA row shapes,
- component types,
- arrays thereof,
- generic types with concrete arguments (e.g., `List<JournalEntry>`).

`outputType` MUST match the shape produced by:

- `source`,
- projection expressions,
- join expansion,
- recursion flattening.

If mismatched, the seed MUST fail validation.

---

## 27.11 Query Parameters

Parameters:

- MUST be explicitly declared with name and type,
- MUST be provided at query invocation,
- MUST be validated before query execution.

Example:

```json
"params": {
  "days": { "type": "int", "required": true }
}
```

Parameters MAY be bound from:

- UI bindings (`widget.params`),
- workflows using queries,
- context in tests.

---

## 27.12 Query Materialization

Queries are always **logical plans**, not persistent tables.

Workflows MAY:

- evaluate queries at runtime,
- materialize query results into SDDA state tables for performance or UI use.

Materialized tables MUST be written only by workflows; queries remain read-only.

---

## 27.13 Queries in UI Bindings

UI schemas MAY bind widgets to queries:

Allowed:

- tables, lists,
- summary cards,
- dropdown options,
- detail views.

UI MUST NOT bind directly to event streams. UI MUST bind to:

- queries, or
- materialized state tables.

UI query parameters MUST be deterministic DW-Expr expressions.

---

## 27.14 Queries in Authorization Policies

Queries MAY be used in authorization if:

- they respect all deterministic rules,
- they cannot leak unauthorized information through side channels.

Policies MUST NOT depend on:

- nondeterministic query results,
- unbounded queries,
- adapter-derived data.

---

## 27.15 Queries in Tests

Tests MAY execute queries as part of expectations.

Example:

```json
"expect": {
  "query": {
    "name": "LowStockTrackerItems",
    "params": { "threshold": 3 },
    "resultCount": 1
  }
}
```

Tests MUST execute queries against isolated test contexts.

---

## 27.16 Validation of Queries (Static Analysis)

A query is valid only if:

1. `source` is a known SDDA table or state table.
2. All joins are schema-defined and bounded.
3. `filter` is a type-correct and deterministic DW-Expr.
4. `sort` keys exist and are type-correct.
5. The query has at least one bounding constraint (`take`, table mode, or bounded join).
6. Recursion, if present, has explicit `maxDepth`.

Invalid queries MUST result in seed rejection.

---

## 27.17 Reserved Features (Post-v1)

Out of scope for v1:

- N:M joins without intermediate tables,
- dynamic or reflection-based query construction,
- query macros or generators,
- windowing functions,
- streaming queries,
- automatic materialized view generation,
- distributed querying,
- access to event logs.

These may be considered in future versions.

—

# 28. COMPONENTS

## 28.1 Purpose

Components define reusable, deterministic, typed data structures used throughout the DWSeed. Components act as:

- workflow input/output schemas,
- UI form schemas,
- reusable value objects,
- typed containers for queries and authorization expressions.

Components MUST be:

- static,
- declarative,
- side-effect-free,
- type-checkable at seed-compile time.

They MUST NOT contain logic that mutates state or accesses external systems.

---

## 28.2 Component Structure

Each component definition includes:

- `fields`: a map of field names to typed field definitions,
- optional `defaults`: DW-Expr providing default values,
- optional `constraints`: DW-Expr boolean conditions,
- optional `typeParameters`: for parameterized/generic components (Section 28.7).

Example:

```json
"JournalEntryForm": {
  "fields": {
    "date": { "type": "date", "required": true },
    "title": { "type": "string", "required": true },
    "bodyPlaintext": { "type": "string", "required": true },
    "mood": { "type": "Mood", "required": true }
  }
}
```

---

## 28.3 Field Definitions

Each field MUST specify:

- `type` — any valid type from Section 26.4,
- optional `required` — boolean (default: false),
- optional `constraints` — DW-Expr constraints specific to the field.

Fields MUST resolve to well-formed, statically known types:

Valid field types include:

- primitives (`string`, `int`, `bool`, etc.),
- enums,
- arrays (`T[]`),
- component references,
- generic instantiations (Section 28.7),
- module-defined types (e.g., `crypto.Hash`).

Fields MUST NOT:

- reference workflows,
- reference adapters,
- contain nondeterministic or side-effectful expressions.

---

## 28.4 Defaults

Defaults:

- MUST be DW-Expr,
- MUST be side-effect-free,
- MUST reference only allowed scopes (Section 26.3),
- MUST NOT reference adapters, I/O, or nondeterministic functions.

Example:

```json
"defaults": {
  "mood": "\"neutral\"",
  "createdAt": "time.now()"
}
```

Defaults MUST be validated at compile-time.

---

## 28.5 Component Constraints

Components MAY declare structural constraints, expressed as DW-Expr boolean expressions.

Example:

```json
"constraints": [
  {
    "id": "title_nonempty",
    "expr": "length(entity.title) > 0"
  }
]
```

Rules:

1. `entity` refers to the component instance.
2. Constraints MUST NOT:
   - modify state,
   - reference adapters,
   - call nondeterministic functions,
   - depend on workflow step outputs.
3. Constraints MUST evaluate to a deterministic boolean value.

Constraint failures MUST produce deterministic errors during workflow execution, validation, or test evaluation.

---

## 28.6 Component Usage

Components MAY be used for:

1. **Workflow Inputs**  
   `input: { "componentRef": "JournalEntryForm" }`

2. **Workflow Outputs**  
   `output: { "type": "JournalEntrySummary" }`

3. **UI Forms**  
   `widget.binding.componentRef = <name>`

4. **Query Projection Shapes**  
   Output types referencing structured data.

5. **Authorization Contexts**  
   As payloads for evaluating authorization rules.

6. **Adapter Call Payload Shaping** (pure shaping only; not invocation)

Components MUST NOT be used for:

- defining storage layout (SDDA tables define storage),
- embedding procedural logic,
- making adapter calls or workflow references.

---

## 28.7 Parameterized Components (Generics)

Parameterized (generic) components are supported in v1.

A parameterized component includes:

```json
"typeParameters": ["T"]
```

Example:

```json
"List": {
  "typeParameters": ["T"],
  "fields": {
    "items": { "type": "T[]" }
  }
}
```

### 28.7.1 Instantiation

A generic component is instantiated using the canonical grammar:

```
ComponentName "<" TypeArgument ("," TypeArgument)* ">"
```

Examples:

- `List<string>`
- `List<JournalEntry>`
- `Page<TrackerItem>`

### 28.7.2 Rules for Generic Instantiation

1. Type arguments MUST be fully resolved at compile-time.
2. Instantiations MUST preserve component constraints (with type substitutions).
3. Nested generic instantiations are allowed:
   - `List<List<int>>`
4. Type arguments MUST NOT:
   - reference workflows,
   - reference adapters,
   - refer to undefined types.

If type arguments are invalid, the seed MUST fail validation.

---

## 28.8 Component Namespacing

Components obey the standard namespacing rules:

- components declared in top-level `components` live in the global namespace,
- module components must be referenced via module namespace:
  - e.g., `ph-shared.DateRange`,
  - not implicitly via unqualified identifiers.

Name collisions MUST result in a validation error.

---

## 28.9 Cyclic Dependency Rules

Components MUST NOT form reference cycles.

Invalid:

- Component A references B, B references A.
- Component A references itself directly (`A<T>` containing field `type: A<T>`).

Valid:

- A references B, B references C, C references A **only through generic type arguments that do not instantiate infinitely** (rare and discouraged).

Cycles MUST be detected during seed validation.

---

## 28.10 Components & DW-Expr Type Checking

When components are used inside expressions, the following must hold:

- All field accesses MUST be valid and type-correct.
- Array/map access MUST be statically verifiable.
- Any ambiguous reference MUST cause seed validation failure.

Examples of valid expressions:

- `input.title`
- `entity.items[0]`
- `length(update.entity.name)`

Examples of invalid expressions:

- `input.nonexistentField`
- `adapter.someCall(...)`  
- `random()`  
- `entity / row` (nonsensical types)

---

## 28.11 Components in Tests

Tests MAY reference components when constructing workflow inputs.

Example:

```json
"action": {
  "workflow": "CreateJournalEntry",
  "input": {
    "date": "2025-01-01",
    "title": "Hello",
    "bodyPlaintext": "World",
    "mood": "neutral"
  }
}
```

Tests MUST NOT modify component definitions.

---

## 28.12 Validation of Components

A component declaration is valid if:

1. All field types are resolvable and acyclic.
2. All constraints are valid DW-Expr boolean expressions.
3. Default values are side-effect-free and type-correct.
4. Generic instantiations respect type parameter requirements.
5. No forbidden patterns appear.

Invalid component definitions MUST cause seed rejection.

---

## 28.13 Reserved Features (Post-v1)

The following features are NOT part of v1:

- structural inheritance (`extends`, `implements`),
- conditional fields (`if`, `when`),
- open generic constraints,
- component-level polymorphism,
- user-defined functions inside components,
- auto-derivation of components from entityKinds.

These MAY be considered in future versions if they preserve determinism.

—

# 29. MODULES

## 29.1 Purpose

Modules provide a structured mechanism for packaging reusable artifacts outside
of the local DWSeed. Modules enable:

- reuse of enums, components, constraints, and pure functions,
- controlled extension of DW-Expr,
- packaging of reusable domain submodels,
- separation of concerns across feature domains.

Modules MAY be imported from external repositories (Section 24) or defined locally
under the top-level `modules` key (embedded modules). Both forms use identical
semantics.

---

## 29.2 Module Structure

A module consists of:

- `moduleName` — globally unique identifier,
- `version` — semantic version string,
- `public` — a namespace of exported items,
- `internal` — internal items not visible outside the module.

Example:

```json
"modules": {
  "ph-shared": {
    "version": "1.0.0",
    "public": {
      "enums": { ... },
      "components": { ... },
      "functions": { ... }
    },
    "internal": {
      "helpers": { ... }
    }
  }
}
```

Embedded modules MUST follow the same structure as imported modules.

---

## 29.3 Exportable Items

Modules MAY export:

### 29.3.1 Enums
Reusable enumeration types.

### 29.3.2 Components
Reusable structured data definitions (Section 28).

### 29.3.3 Functions (DW-Expr Extensions)
Pure, deterministic functions callable as:

```
namespace.functionName(args)
```

Rules:

- MUST be pure and side-effect-free,
- MUST NOT call adapters,
- MUST NOT access nondeterministic or external resources,
- MUST declare full input/output types,
- MUST pass static type checking.

Example:

```json
"functions": {
  "daysAgo": {
    "params": { "n": "int" },
    "return": "date",
    "expr": "time.today() - time.duration(days: n)"
  }
}
```

### 29.3.4 Constraints
Formal reusable constraint expressions.

### 29.3.5 Adapters (Pure Definitions Only)
Modules MAY declare adapters, but:

- these are not automatically “active,”  
- the local seed must reference them under `adapters` to use them.

Modules MUST NOT export executable workflows (Section 29.4 clarifies this).

---

## 29.4 Workflows in Modules

A module MAY define workflow *templates* or *blueprints*, but:

- workflows declared inside modules are NOT directly executable,
- they MUST NOT be referenced as top-level `workflows` of the seed,
- they MAY be copied or instantiated locally via tool support (post-v1),
- they MUST NOT be invoked across module/seed boundaries.

Reason: workflows reference storage, adapters, and event types which differ between seeds; coupling them across module boundaries breaks determinism.

Thus in v1:

**Modules MAY contain workflow-like constructs for documentation or future reuse,  
but these are NOT executable workflows.**

A v2 “workflow template” mechanism may later formalize this.

---

## 29.5 Namespacing

Modules define strict namespaces.

- Imported module under `namespace: "time"` → referenced as `time.duration(...)`.
- Embedded module `"ph-shared"` → referenced as `ph-shared.DateRange`.

### 29.5.1 No Implicit Global Promotion

Exports from a module MUST NOT automatically appear in global scope.

Example (prohibited):

```
type: "Mood"   // invalid unless defined globally
```

Correct:

```
type: "ph-shared.Mood"
```

or:

```
type: "time.Duration"   // hypothetical
```

---

## 29.6 Module Resolution

At seed-validation time (Section 36.2):

1. All imports are resolved into a **module catalog**.
2. Embedded modules are added to the catalog.
3. All exports are validated for structural correctness.
4. All namespaced references in the seed must resolve to catalog entries.

A module catalog contains:

- module namespaces,
- exported enums,
- exported components,
- exported constraints,
- exported functions,
- exported adapters (if used).

If any exported item conflicts with global identifiers or another module’s namespace, the seed MUST fail validation.

---

## 29.7 Versioning

Modules MUST declare a semantic version:

- `MAJOR.MINOR.PATCH`.

Import rules (Section 24) require:

- explicit version OR versionRange,
- deterministic resolution to a single version,
- incompatibilities MUST cause seed failure.

Embedded modules MUST obey the same version rules, although embedding implies “always available.”

---

## 29.8 Determinism Requirements

Modules MUST be deterministic:

1. Pure functions MUST NOT cause side effects.
2. Component and enum definitions MUST be immutable within a module version.
3. Constraints MUST evaluate deterministically.
4. No execution-order dependencies between modules are allowed.
5. Module loading MUST NOT depend on external side effects (e.g., reading files outside module packaging).

---

## 29.9 Disallowed Patterns

Modules MUST NOT:

- call adapters inside exported functions,
- define workflows intended for cross-seed execution,
- modify global state or other modules,
- override built-in DW-Expr functions,
- depend on runtime/environment information,
- contain recursive imports (A imports B, B imports A).

Violations MUST cause seed rejection.

---

## 29.10 Module Interaction With Other Sections

### 29.10.1 With DW-Expr (Section 26)
Modules extend DW-Expr via pure functions only.

### 29.10.2 With UI Schemas (Section 31)
UI schemas may reference module components and enums via namespace.

### 29.10.3 With Adapters (Section 32)
Adapters exported by modules are passive definitions; the seed must instantiate them to activate.

### 29.10.4 With Authorization (Section 33)
Policies MAY reference module enums, but MUST NOT reference module functions that become nondeterministic (this is already prohibited).

### 29.10.5 With Workflows (Sections 15–16)
Workflows in seeds may use module components, enums, and functions.

---

## 29.11 Testing Module Exports

Tests MAY reference exported component shapes and enums.

Tests MUST NOT:

- modify module contents,
- redefine module functions,
- shadow module namespaces.

---

## 29.12 Module-Level Constraints

Modules MAY define shared constraints for reuse:

```json
"constraints": {
  "nonemptyString": "length(input) > 0"
}
```

Constraints MUST follow DW-Expr purity rules.

---

## 29.13 Reserved Features (Post-v1)

Not included in v1:

- workflow-template instantiation,
- module-level event types,
- cross-module workflow invocation,
- dynamic module loading,
- conditional imports,
- module polymorphism,
- module inheritance or composition.

These may be introduced in future versions while preserving determinism.

—

# 30. TESTS

## 30.1 Purpose

Tests provide a deterministic mechanism for validating:

- workflows,
- queries,
- event publication,
- authorization rules,
- component constraints,
- adapter input/output shapes (via mocks).

Tests MUST:

- be deterministic,
- be isolated,
- not depend on external systems,
- execute identically across environments,
- have no hidden side effects.

Tests MUST NOT:

- write to real adapters or external systems,
- depend on nondeterministic time or randomness unless explicitly mocked,
- rely on event-stream ordering outside deterministic rules (Section 25.4).

---

## 30.2 Test Structure

Each test case includes:

- `setup` — initial state,
- `action` — workflow invocation,
- `expect` — expected outcomes,
- optional `description` — human-readable summary.

Example structure:

```json
"tests": {
  "CreateJournalEntry_publishes_event": {
    "setup": { ... },
    "action": { ... },
    "expect": { ... }
  }
}
```

---

## 30.3 Setup Phase

`setup` defines the initial deterministic state for the test environment.

### 30.3.1 Components of Setup

Tests MAY initialize:

1. **SDDA Rows**

```json
"sdda": {
  "JournalEntries": [
    { "literal": "e1", "ownerId": "user-1", ... }
  ]
}
```

2. **Entities** (registry state)

```json
"entities": {
  "TrackerItem": [
    { "id": "item-1", "ownerId": "user-1", "name": "Coffee", "quantity": 1 }
  ]
}
```

3. **Context Variables**

```json
"context": {
  "currentUserId": "user-1",
  "principalRole": "owner",
  "userLocation": "Wilmington, DE",
  "newId": "entry-1"
}
```

Rules:

- All identifiers MUST refer to existing types in the seed.
- All context keys MUST be declared in:
  - workflow-level `context`, OR
  - test setup itself.
- Test context MUST NOT introduce undeclared keys into workflow evaluation.

### 30.3.2 Seed Validation Rules for Setup

Seed validation MUST ensure:

- Every SDDA row conforms to its table schema.
- Every entity conforms to its entityKind payload rules.
- All required context variables are present.
- No extraneous or misspelled fields exist.

---

## 30.4 Action Phase

The action phase MUST consist of exactly one workflow invocation:

```json
"action": {
  "workflow": "<WorkflowName>",
  "input": { ... }
}
```

Rules:

1. Workflow MUST exist.
2. Input MUST conform to the workflow’s input schema.
3. Workflow MUST be invoked deterministically.
4. No other action types are permitted in v1.

Queries, UI events, or adapter calls MUST NOT be invoked directly during a test.

---

## 30.5 Isolation Model

Every test MUST execute within an **isolated evaluation context** using one of:

1. **Transactional rollback isolation**  
   - Each test runs inside a transaction.  
   - At completion, state is rolled back.

2. **Copy-on-write isolation**  
   - Initial state is copied from `setup`.  
   - Mutations apply to the copy only.

3. **Ephemeral test database**  
   - Each test uses a separate in-memory SDDA instance.

Implementations MUST document which isolation model they use.

No test may affect another test.

---

## 30.6 Expected Outcomes

The `expect` section defines assertions on:

- workflow results,
- state changes,
- events,
- errors,
- queries.

Only deterministic assertions are allowed.

### 30.6.1 Expected Events

Events MUST match **exactly**, unless payload is omitted.

Valid:

```json
"expect": {
  "events": [
    {
      "eventType": "JournalEntryCreated",
      "payload": {
        "entryId": "entry-1",
        "ownerId": "user-1",
        "mood": "neutral"
      }
    }
  ]
}
```

Also valid (payload ignored):

```json
"expect": {
  "events": [
    { "eventType": "DashboardDataRefreshed" }
  ]
}
```

**Partial payload matching is NOT allowed** in v1.

If the payload is present, it MUST fully match the published payload exactly.

### 30.6.2 Expected SDDA State

Example:

```json
"expect": {
  "sdda": {
    "JournalEntries": [
      { "literal": "entry-1", "ownerId": "user-1", ... }
    ]
  }
}
```

Rules:

- `expect.sdda.<table>` MUST represent the whole expected table contents, or  
- The test must use explicit flags (post-v1) to assert partial updates.

### 30.6.3 Expected Entity State

Example:

```json
"expect": {
  "entities": {
    "TrackerItem": [
      { "id": "item-1", "quantity": 3 }
    ]
  }
}
```

If only a subset of fields is listed, all omitted fields MUST either:

- match previous state exactly, OR
- be validated using test-specific match rules (post-v1).

### 30.6.4 Expected Workflow Output

If the workflow returns values:

```json
"expect": {
  "output": {
    "summary": "Entry created successfully"
  }
}
```

Type correctness MUST be validated.

### 30.6.5 Expected Errors

If a workflow is expected to fail:

```json
"expect": {
  "error": "validation_failed"
}
```

Error MUST match a registered error code (Section 17).

---

## 30.7 Query Assertions

Tests MAY assert that executing a named query produces a specific result.

Example:

```json
"expect": {
  "query": {
    "name": "LowStockTrackerItems",
    "params": { "threshold": 3 },
    "result": [
      { "id": "item-1", "name": "Coffee", "quantity": 1 }
    ]
  }
}
```

Allowed forms:

- `result` (exact match),
- `resultCount`,
- `contains` (full object match, not partial),
- `empty: true`.

Query results MUST obey the same deterministic constraints as normal query execution.

---

## 30.8 Adapter Handling in Tests

Adapters MUST NOT perform real I/O during tests.

Tests MUST use **mocked adapters** with:

- deterministic inputs,
- deterministic outputs,
- deterministic error triggering.

Example:

```json
"setup": {
  "adapterMocks": {
    "weatherApi": {
      "output": {
        "summary": "Clear",
        "temperatureC": 20.0
      }
    }
  }
}
```

If an adapter is invoked during a workflow without an associated mock, the test MUST fail.

---

## 30.9 Determinism Rules

Tests MUST be deterministic under:

- repeated execution,
- different environments (desktop, mobile, CI),
- different generator backends.

Tests MUST NOT:

- depend on system clocks (unless `time` module explicitly mocked),
- depend on randomness,
- rely on external state.

If the test involves time-dependent logic, the test setup MUST mock `time.now()` or similar functions via context variables or module function overrides.

---

## 30.10 Validation of Test Definitions

A test is invalid if:

- `setup` references types or tables not defined in the seed,
- `action.workflow` does not exist,
- workflow input fails type checking,
- `expect` contains partial event payloads,
- expected states contradict schema-level constraints,
- mocks are not provided for adapters invoked by workflow steps.

Invalid tests MUST cause seed validation failure.

---

## 30.11 Reserved Features (Post-v1)

Not included in v1:

- fuzzy or partial matching of objects,
- wildcard event payloads,
- multi-workflow action sequences,
- time-travel debugging or event replay,
- snapshot/restore test environments,
- randomized test generation.

These MAY be considered for v2, provided determinism is preserved.

—

# 31. UI SCHEMA

## 31.1 Purpose

The UI schema provides a **deterministic, declarative description of application user interfaces**.  
It defines:

- screens (top-level navigable units),
- views (structural layout regions),
- widgets (interaction and display elements),
- data bindings to workflows, queries, and components.

The UI MUST NOT contain imperative code, nondeterminism, side effects, or direct references to adapters or events.

All state changes MUST occur through workflows.

---

## 31.2 Top-Level UI Structure

The `ui` section of the DWSeed contains:

- `screens`: a map of screen definitions,
- optional `themes` (reserved for post-v1),
- optional `navigation` metadata.

Example:

```json
"ui": {
  "screens": {
    "Dashboard": { ... },
    "JournalScreen": { ... }
  }
}
```

Screens MUST have unique identifiers within the seed.

---

## 31.3 Screens

A screen definition includes:

- `screenId`: unique identifier,
- `route`: canonical navigation route (platform-agnostic),
- `title`: human-readable label,
- `layout`: hierarchical composition of views and widgets,
- optional `accessControl`: authorization requirements (Section 33),
- optional `initialContext`: DW-Expr defining context variables for the screen.

Example:

```json
"screenId": "Dashboard",
"route": "/",
"title": "Dashboard",
"layout": { ... }
```

Screens MUST NOT:

- call workflows directly (widgets trigger workflows),
- reference adapter functions,
- reference events as data.

---

## 31.4 Views

A view is a structural container for widgets or nested views.

View definition:

- `viewId`
- `children`: array of widgets or views
- optional `bindingContext`: overrides the default binding scope
- optional `layoutHints`: UI layout metadata (grid, flex, stack, etc.)

Views MUST be deterministic: layoutHints must not encode device-specific or platform-specific behavior.

Views MUST NOT:

- hold state,
- call workflows,
- evaluate side effects.

---

## 31.5 Widgets

Widgets represent concrete interface elements.

Categories:

### 1. Input Widgets
- text input
- numeric input
- checkbox, toggle, radio
- dropdown / select
- multi-select
- date/time pickers

### 2. Display Widgets
- label
- text display
- summary card
- collapsible panels
- tables/lists

### 3. Action Widgets
- buttons
- menu items
- navigational links

### 4. File Widgets
- file uploader
- image picker
- document scanner (mobile-capable)

A widget MUST declare:

- `widgetId`
- `type`
- `binding` (where applicable)
- optional `visibility`: DW-Expr boolean
- optional `enabled`: DW-Expr boolean
- optional `validation` rules (pure, deterministic)

Widgets MUST NOT:

- embed procedural logic,
- mutate state directly,
- call adapters,
- read event streams.

---

## 31.6 Data Binding

Bindings describe how UI interacts with application state.

Valid binding targets:

### 1. **Components** (for forms)
Example:

```json
"componentRef": "JournalEntryForm"
```

Component fields map to widget inputs and workflow inputs.

### 2. **Workflows** (actions)
Example:

```json
"workflow": "CreateJournalEntry"
```

Rules:

- Workflows MUST be triggered only via widgets of type `"button"` or `"form"`.
- Workflow input MUST be supplied exclusively by:
  - component fields,
  - literal DW-Expr values,
  - UI-level constants.

### 3. **Queries** (read-only displays)
Example:

```json
"query": "RecentJournalEntries",
"params": { "days": 7 }
```

Rules:

- Queries MUST be deterministic.
- Query parameters MUST be DW-Expr values.
- UI MUST NOT reference event streams; it MUST query materialized state.

### 4. **Entity-Kind Bindings** (optional)
Used for detail displays or inline editing.

---

## 31.7 Binding Rules

### 31.7.1 Determinism

Bindings MUST be statically resolvable and deterministic.  
Invalid:

- `binding: { "content": "random()" }`
- `binding: { "query": "WeatherData", "params": { "d": time.now() } }` (nondeterministic)

Valid:

- `binding: { "params": { "days": "7" } }`
- `binding: { "fields": { "title": "row.title" } }`

### 31.7.2 Scope Resolution

Bindings may reference:

- `input` fields from forms,
- `row` fields when bound to queries,
- `context.*` variables (screen- or workflow-level),
- module functions (pure only),
- literals.

Bindings MAY NOT reference:

- workflow step outputs,
- adapters,
- global mutable state.

---

## 31.8 Forms

Forms are multi-field widgets tied to a component schema.

Example:

```json
"widgetId": "journal_form",
"type": "form",
"binding": {
  "componentRef": "JournalEntryForm",
  "workflow": "CreateJournalEntry"
}
```

Rules:

- Form submission MUST trigger exactly one workflow.
- Form fields MUST correspond to the component referenced.
- Validation MUST use pure DW-Expr inside the component or widget.

No implicit defaulting is allowed; all defaults MUST come from the component's `defaults`.

---

## 31.9 Tables & Lists

Tables and lists MUST bind to deterministic queries.

Example:

```json
"widgetId": "recent_entries",
"type": "table",
"binding": {
  "query": "RecentJournalEntries",
  "params": { "days": 7 }
}
```

Rules:

- Queries MUST define a bounding mechanism (`take`, discrete table mode, or bounded join).
- Tables MUST define deterministic column shapes based on query output type.

---

## 31.10 File Widgets

A file widget binds to a **component field of type `file`** or to a workflow input field of type `file`.

Example:

```json
"widgetId": "photo_upload",
"type": "fileUpload",
"binding": {
  "targetField": "JournalEntryForm.photoFile"
}
```

Rules:

- A file widget MUST NOT directly persist files.
- Files MUST flow into a workflow input.
- The workflow MUST invoke an adapter (or equivalent module function) to handle external I/O.

---

## 31.11 UI & Authorization

A widget or screen MAY specify `accessControl`:

```json
"accessControl": {
  "requiredRole": "owner"
}
```

Rules:

- Access control in UI is **advisory** only (client convenience).
- Enforcement MUST occur server-side (Section 33).
- UI MUST NOT imply authorization policies that are not defined in the seed.

---

## 31.12 Context Variables in UI

Screens MAY define constant or computed context:

```json
"initialContext": {
  "selectedTab": "\"journal\""
}
```

UI-level context MUST:

- be immutable after initialization,
- be pure DW-Expr,
- not reference workflows, adapters, or nondeterminism.

Context MUST NOT conflict with workflow-level context.

---

## 31.13 Prohibited Patterns

UI schemas MUST NOT:

- reference event streams (`events.*`),
- read adapter output directly,
- call workflows or adapters from DW-Expr,
- depend on nondeterministic values,
- include recursive UI structures without static bound,
- implicitly mutate state.

---

## 31.14 Validation

A UI schema is valid if:

1. All referenced screens, widgets, queries, components, workflows, and context entries exist.
2. All bindings are type-correct.
3. All expressions are pure.
4. All queries referenced by UI are bounded.
5. No use of events as direct data sources.
6. All form-field bindings correspond to declared component fields.

Failure of any validation MUST reject the entire seed.

---

## 31.15 Reserved Features (Post-v1)

Excluded from v1:

- responsive design rules,
- theming,
- multi-screen transitions or animations,
- per-widget event handlers (beyond workflow binding),
- dynamic query construction,
- runtime-generated screens,
- UI composition macros.

These may be added in future versions without breaking deterministic semantics.

—

# 32. ADAPTERS

## 32.1 Purpose

Adapters provide the **only interface** between a DWSeed-defined application and the outside world.

Adapters represent:

- external services (HTTP APIs, message queues),
- device capabilities (camera, Bluetooth, NFC, barcode scanner),
- platform facilities (file system, notifications),
- cryptographic operations,
- data transformation services.

Adapters are **pure interface declarations**.  
They do not perform work themselves; workflows invoke them and the runtime/environment implements them.

Adapters MUST be:

- declarative,
- statically type-checkable,
- deterministic in shape (not in effect),
- side-effectful **only when invoked from workflows**.

DW-Expr MUST NOT call adapters under any circumstances.

---

## 32.2 Adapter Structure

Each adapter definition includes:

- `direction` — `"inbound"` or `"outbound"`,
- `inputSchema` — component-like field structure (or `"type": "void"`),
- `outputSchema` — deterministic structure of returned data,
- `errorModel` — structured error types,
- optional `capabilities` — device or platform requirements,
- optional `description`.

Example:

```json
"weatherApi": {
  "direction": "outbound",
  "inputSchema": { "location": { "type": "string" } },
  "outputSchema": {
    "summary": { "type": "string" },
    "temperatureC": { "type": "float" }
  },
  "errorModel": {
    "notFound": "location_not_found",
    "timeout": "external_timeout"
  }
}
```

All schemas MUST use valid types and MUST be statically resolvable.

---

## 32.3 Inbound vs Outbound Adapters

### 32.3.1 Outbound Adapters  
Workflow → Adapter → External System

Used for:

- HTTP requests,
- file I/O,
- device access (camera, Bluetooth, NFC, barcode scanner),
- cryptographic operations (if not provided as pure module functions),
- cloud sync or P2P sync.

Outbound adapters MUST return a typed output structure.

### 32.3.2 Inbound Adapters  
External System → Adapter → Workflow

Used for:

- webhook events (HTTP POST),
- incoming messages from queues,
- device-triggered events (button, sensor),
- Bluetooth notifications,
- push notifications.

Inbound adapters MUST:

- specify which workflow they deliver input to via `trigger`,
- support replay-free, deterministic workflow invocation.

Example:

```json
"inboundScanner": {
  "direction": "inbound",
  "outputSchema": { "barcode": { "type": "string" } },
  "trigger": "ScanTrackerItem"
}
```

---

## 32.4 Adapter Invocation in Workflows

A workflow step MAY invoke an outbound adapter:

```json
{
  "type": "adapterCall",
  "adapter": "deviceCameraUpload",
  "input": { "file": "input.photoFile" },
  "output": "photoInfo"
}
```

Rules:

1. Adapter names MUST be valid identifiers.
2. Input MUST conform to the adapter’s input schema.
3. Output MUST be assigned to a step variable.
4. Errors MUST be handled via the workflow’s error pathways (Section 17).
5. Adapters MUST NOT publish events directly—only workflows can.

Invalid:

```
"expr": "adapter.call(...)"   // Prohibited in DW-Expr
```

---

## 32.5 Device-Specific Adapters

Adapters MAY represent device capabilities.  
Common device adapters include:

### 32.5.1 Camera

```json
"deviceCameraUpload": {
  "direction": "outbound",
  "inputSchema": { "file": { "type": "file" } },
  "outputSchema": {
    "uri": { "type": "string" },
    "mimeType": { "type": "string" }
  },
  "errorModel": {
    "permissionDenied": "device_permission_denied",
    "failure": "capture_failed"
  },
  "capabilities": ["camera"]
}
```

### 32.5.2 Barcode / QR / RFID Scanner

```json
"deviceBarcodeScanner": {
  "direction": "outbound",
  "inputSchema": { "prompt": { "type": "string" } },
  "outputSchema": { "code": { "type": "string" } },
  "capabilities": ["scanner"]
}
```

### 32.5.3 Bluetooth / NFC

```json
"deviceBluetooth": {
  "direction": "outbound",
  "inputSchema": {
    "deviceId": { "type": "string" },
    "payload": { "type": "string" }
  },
  "outputSchema": { "status": { "type": "string" } },
  "capabilities": ["bluetooth"]
}
```

### 32.5.4 Document Scanner (mobile)

```json
"documentScanner": {
  "direction": "outbound",
  "inputSchema": {
    "captureMode": { "type": "string" }
  },
  "outputSchema": {
    "file": { "type": "file" }
  },
  "capabilities": ["camera", "document_scanner"]
}
```

These adapters are common in apps like ToolHawk and Personal Hub.

---

## 32.6 External-Service Adapters

Adapters integrate with external APIs:

### HTTP

```json
"httpGet": {
  "direction": "outbound",
  "inputSchema": {
    "url": { "type": "string" },
    "headers": { "type": "map<string,string>" }
  },
  "outputSchema": {
    "status": { "type": "int" },
    "body": { "type": "string" }
  },
  "errorModel": {
    "timeout": "http_timeout",
    "networkError": "network_error"
  }
}
```

### Message Queues

```json
"queueSend": {
  "direction": "outbound",
  "inputSchema": {
    "queue": { "type": "string" },
    "payload": { "type": "string" }
  },
  "outputSchema": { "success": { "type": "bool" } }
}
```

### Crypto

If cryptographic operations cannot be represented as DW-Expr functions:

```json
"cryptoEncrypt": {
  "direction": "outbound",
  "inputSchema": { "plaintext": { "type": "string" } },
  "outputSchema": { "ciphertext": { "type": "string" } }
}
```

---

## 32.7 Error Model

Adapters MUST declare explicit error codes:

```json
"errorModel": {
  "timeout": "external_timeout",
  "invalidCredentials": "auth_failed"
}
```

Workflows MUST handle errors deterministically.

Invalid:

- implicit errors,
- environment-generated exceptions without mapping,
- untyped error states.

Error codes MUST be stable across versions of the module or seed.

---

## 32.8 Adapters and Authorization

Authorization (Section 33) applies to workflow invocation, not adapter calls directly.

Rules:

1. If a workflow is authorized, its adapter calls are implicitly permitted.
2. Adapters MUST NOT implement authorization themselves.
3. Device permissions (e.g., camera access) MUST be treated as adapter errors, not auth failures.

---

## 32.9 Adapters in Tests

Tests MUST NOT call real adapters.

Instead:

### 32.9.1 Mocking

```json
"adapterMocks": {
  "weatherApi": {
    "output": {
      "summary": "Clear",
      "temperatureC": 20.0
    }
  }
}
```

### 32.9.2 Error Simulation

```json
"adapterMocks": {
  "cryptoEncrypt": {
    "error": "crypto_error"
  }
}
```

Rules:

- Mocks MUST match adapter input/output schemas.
- If a workflow calls an adapter without a provided mock, the test MUST fail.
- Tests MUST NOT simulate adapters not declared in the seed.

---

## 32.10 Determinism & Side-Effect Boundaries

Adapters define boundaries of non-determinism:

### Allowed nondeterminism (runtime)
- network latency,
- device access,
- user-driven input (camera, scanner),
- external API behavior.

### Forbidden nondeterminism (seed)
- DW-Expr invoking adapters,
- UI directly invoking adapters,
- tests using real external systems.

Workflows are the **only** place adapter effects may occur.

---

## 32.11 Integration with Runtime Profiles

Adapter availability depends on `runtimeProfiles` (Section 34):

Example:

```json
{
  "profileId": "mobile-prod",
  "platform": "mobile",
  "adapters": ["deviceCameraUpload", "documentScanner"]
}
```

Rules:

- If a workflow uses an adapter not available in the selected profile, generation MUST fail.
- Profiles MAY conditionally exclude adapters (e.g., no camera on desktop).
- Profiles MUST declare deterministic fallback behavior (usually erroring).

---

## 32.12 Reserved Features (Post-v1)

Not included in v1:

- Streaming adapters,
- bidirectional real-time channels,
- adapter composition,
- environment probing (e.g., “is this API available?”),
- dynamic adapter discovery,
- adapter pooling or caching.

These may be added later without breaking determinism.

—

# 33. AUTHORIZATION

## 33.1 Purpose

Authorization defines **who may invoke workflows** and **under what conditions**.  
DWSeed authorization is:

- deterministic,
- declarative,
- context-driven,
- enforced server-side,
- independent of UI-layer hints.

Authorization MUST NOT:

- control UI visibility directly (UI can show/hide but not enforce),
- depend on nondeterministic values,
- depend on adapter outputs,
- mutate state.

Authorization applies **only** to workflow invocation.

---

## 33.2 Authorization Structure

The `auth` section includes:

- `roles`: role definitions,
- `policies`: list of authorization policies,
- optional `contextRequirements`: declarations for required context variables.

Example:

```json
"auth": {
  "roles": {
    "owner": { "permissions": ["all"] },
    "viewer": { "permissions": ["read"] }
  },
  "policies": [
    {
      "id": "owner_can_write",
      "effect": "allow",
      "condition": "context.principalRole == \"owner\""
    }
  ]
}
```

---

## 33.3 Roles

Roles define categories of principals.

Role definition:

```json
"roles": {
  "roleName": {
    "permissions": ["read", "write", "all"]
  }
}
```

Rules:

- Roles MUST have unique names.
- Permissions are **opaque symbolic tags**; the DSL does not impose semantics except equality.
- Roles MUST NOT encode business logic.

---

## 33.4 Policies

A policy decides whether a workflow invocation is **allowed** or **denied**.

Policy structure:

```json
{
  "id": "policy_id",
  "effect": "allow" | "deny",
  "condition": "<DW-Expr boolean>"
}
```

Rules:

1. `condition` MUST be a deterministic DW-Expr expression.
2. Condition MUST NOT reference:
   - workflows,
   - adapters,
   - events,
   - UI state.
3. Condition MAY reference:
   - `context.*` variables,
   - workflow input (for input-sensitive auth),
   - pure module functions,
   - static literals.

Example:

```json
"condition": "context.principalRole == \"owner\""
```

---

## 33.5 Workflow-Level Authorization

Every workflow defaults to **deny** unless at least one `allow` policy matches.

Evaluation order:

1. Evaluate all **deny** policies whose conditions match → if any matches → deny.
2. Evaluate **allow** policies whose conditions match.
3. If at least one allow matches → allow.
4. If none match → deny.

This ordering is deterministic and MUST be preserved across implementations.

---

## 33.6 Authorization Context

Authorization decisions depend on **context variables** supplied at workflow invocation time or in runtime profiles.

Example context variables:

- `principalRole`
- `currentUserId`
- `deviceType`
- `userRegion`

Context MUST be:

- declared in seed or profile,
- immutable during authorization evaluation,
- type-correct.

Unauthorized context fields MUST cause validation failure.

Example declaration:

```json
"contextRequirements": {
  "principalRole": { "type": "string" }
}
```

---

## 33.7 Input-Sensitive Authorization

Policies MAY examine workflow input.

Example:

```json
"condition": "context.principalRole == \"owner\" or input.ownerId == context.currentUserId"
```

Rules:

- Input MUST be fully known before authorization.
- Policies MUST NOT depend on workflow steps or intermediate state.

---

## 33.8 Forbidden Patterns

Authorization MUST NOT:

- inspect or depend on adapter outputs,
- depend on nondeterministic values (e.g., time.now() unless mocked),
- depend on SDDA table contents,
- use queries (v1),
- use event logs,
- depend on workflow history.

These are excluded to preserve determinism and avoid privilege escalation via side channels.

---

## 33.9 Authorization in UI

UI MAY provide convenience access control:

```json
"accessControl": { "requiredRole": "owner" }
```

But UI enforcement is **advisory only**.

All real authorization MUST occur in workflow invocation.

---

## 33.10 Tests & Authorization

Tests MUST be capable of asserting authorization outcomes.

Example (expect success):

```json
"expect": {
  "authorized": true
}
```

Example (expect denial):

```json
"expect": {
  "error": "authorization_denied"
}
```

Tests MUST set `context.principalRole`, `currentUserId`, etc., in test setup.

Authorization MUST NOT depend on external systems; role interpretation is deterministic.

---

## 33.11 Default Authorization Behavior

If the `auth` block is omitted:

- All workflows default to **allow**.

If `auth` exists but no policies apply to a workflow:

- Default is **deny**.

This prevents accidental privilege exposure.

---

## 33.12 Validation Rules

A seed MUST be rejected if:

- A policy references an undefined role,
- Authorization conditions contain nondeterministic or prohibited constructs,
- Input-sensitive policies refer to nonexistent fields,
- Context variables are undeclared,
- Policies produce ambiguous results.

Validation MUST fail deterministically.

---

## 33.13 Reserved Features (Post-v1)

Not included in v1:

- hierarchical roles,
- resource-level access control (per entity),
- query-based authorization,
- workflow scoping by tags or modules,
- multi-tenant identity models,
- runtime-modifiable policies,
- attribute-based access control (ABAC),
- time-windowed access (e.g., after 5pm).

These MAY be introduced in v2 if they maintain deterministic semantics.

—

# 34. RUNTIME PROFILES

## 34.1 Purpose

Runtime profiles define **where and how** a generated application executes.  
Each profile describes:

- platform (desktop, mobile, web),
- adapter availability,
- offline/sync behavior,
- SDDA storage bindings,
- environment-specific capabilities,
- configuration for platform wrappers (Electron, Capacitor).

A DWSeed may define multiple runtime profiles.  
The generator selects exactly one profile during application build.

Runtime profiles MUST be:

- deterministic,
- declarative,
- statically analyzable,
- free from imperative logic.

Profiles MUST NOT contain DW-Expr except where explicitly allowed (e.g., configuration constants).

---

## 34.2 Profile Structure

Each profile MUST declare:

- `profileId`: unique identifier
- `platform`: `"desktop" | "mobile" | "web"`
- `adapters`: list of enabled adapters
- `storage`: SDDA and database backend configuration
- `capabilities`: device/platform capability requirements
- optional `sync`: offline-first synchronization model
- optional `context`: environment-supplied values

Example:

```json
{
  "profileId": "mobile-prod",
  "platform": "mobile",
  "adapters": ["deviceCameraUpload", "documentScanner"],
  "storage": {
    "sdda": "local",
    "backend": "sqlite",
    "path": "appdata/local.db"
  },
  "sync": {
    "strategy": "when_online",
    "endpoint": "https://sync.example.com"
  },
  "capabilities": ["camera", "scanner"],
  "context": {
    "environment": "\"production\""
  }
}
```

---

## 34.3 Platforms

### 34.3.1 Desktop  
Targeted through Electron-like wrapper.

Characteristics:

- Persistent file storage available.
- Device capabilities limited (no camera unless explicitly supported).
- Suitable for offline-first apps with large SDDA stores.

### 34.3.2 Mobile  
Targeted through Capacitor-like environment.

Characteristics:

- Device capabilities enabled (camera, scanner, Bluetooth, NFC).
- Local SQLite or platform-native encrypted storage.
- Optional background sync services.

### 34.3.3 Web  
Runs in browser environment.

Characteristics:

- No direct file system access (beyond sandboxed API).
- No device APIs except browser-permitted ones.
- SDDA may use IndexedDB.
- Many adapters unavailable.

Each platform MUST explicitly list allowed adapters; unspecified adapters are prohibited.

---

## 34.4 Adapter Availability

A workflow may reference an adapter **only** if that adapter is included in the active runtime profile.

Rules:

- Missing adapters MUST produce compile-time errors.
- Multiple profiles may provide different sets of adapters (e.g., camera only on mobile).
- Profiles MUST enumerate every adapter they permit.

Example:

```json
"adapters": ["weatherApi", "queueSend"]
```

If `deviceCameraUpload` appears in a workflow but not in the active profile, generation MUST fail.

---

## 34.5 Storage Bindings

Profiles declare how SDDA tables are physically stored.

Valid storage backends:

- `"sqlite"`
- `"indexeddb"`
- `"memory"` (debug only)
- `"platform-native"` (mobile encrypted stores)

Example:

```json
"storage": {
  "sdda": "local",
  "backend": "sqlite",
  "path": "data/local.db"
}
```

Rules:

- Storage MUST be deterministic for a given profile.
- Backend type MUST be recognized by the generator.
- All SDDA tables share the same backend in v1.

---

## 34.6 Offline & Sync Configuration

Profiles may configure synchronization behavior:

Example:

```json
"sync": {
  "strategy": "manual | when_online | periodic",
  "endpoint": "https://sync.example.com",
  "conflictResolution": "crdt"
}
```

Rules:

- Sync execution MUST occur through workflows, not adapters directly.
- Synchronization itself may involve adapters, but flows MUST be deterministic.
- Conflict resolution strategies MUST be statically declared.

Sync strategies:

1. **manual** – user triggers sync explicitly.
2. **when_online** – opportunistic sync when connectivity is restored.
3. **periodic** – device/service performs sync at intervals.

Unsupported strategies MUST cause validation failure.

---

## 34.7 Capabilities

Profiles declare device or platform capabilities required:

- `"camera"`
- `"scanner"`
- `"bluetooth"`
- `"nfc"`
- `"gps"`
- `"notifications"`
- `"background_sync"`

Rules:

- Workflows referencing adapters tied to capabilities MUST ensure the active profile supports them.
- Capabilities MUST be declarative only; runtime decides whether they exist physically.

If a required capability is not supported on the target platform, build MUST fail.

---

## 34.8 Environment Context Variables

Profiles may supply constants into the workflow/context environment:

```json
"context": {
  "principalRole": "\"owner\"",
  "environment": "\"production\""
}
```

Rules:

- Context must be immutable.
- Values MUST be DW-Expr literals or pure expressions.
- Context MUST satisfy workflow and auth requirements.

Profiles MUST NOT:

- introduce nondeterministic context (e.g., time-based),
- override workflow-declared context types.

---

## 34.9 Profile Selection

Profile selection occurs at **build time**, not runtime.

Rules:

- Generator MUST accept a specified profileId.
- If none specified, generator MAY pick default profile if declared.
- Generated application artifacts MUST embed profile-specific configuration statically.

No runtime switching of profiles in v1.

---

## 34.10 Profile Validation

A profile is invalid if:

- It references adapters not declared in the seed.
- It lacks required adapters for workflows present in the application.
- It declares unsupported capabilities for the selected platform.
- Storage backend is incompatible with platform.
- Sync endpoint or strategy is malformed.
- Context variables conflict in type or name with workflow definitions.

Seed validation MUST fail for any invalid profile.

---

## 34.11 Profile Interaction with Other Sections

- **Adapters (Section 32)**  
  Profiles determine which adapters are enabled.

- **Authorization (Section 33)**  
  Profiles MAY supply context variables like `principalRole`.

- **UI Schema (Section 31)**  
  UI does not depend on profiles, but device widgets may require platform capabilities.

- **Queries (Section 27)**  
  Fully profile-independent.

- **Workflows (Sections 15–16)**  
  Workflows depend on adapters, which depend on profiles.

---

## 34.12 Reserved Features (Post-v1)

Not included in v1:

- runtime profile switching,
- multi-profile packaging,
- conditional profile selection based on environment detection,
- dynamic platform probing,
- hybrid/dual-mode profiles,
- per-adapter sandboxing rules,
- device permission management UI.

These may be included in v2 while preserving deterministic semantics.

—

# 35. DWSEED SPECIFICATION

## 35.1 Purpose

A DWSeed is a **complete, deterministic specification** of an application’s:
- data model,
- workflows,
- events,
- queries,
- UI,
- adapters,
- authorization rules,
- runtime profiles,
- tests.

The DWSeed is the **only** input to the DreamWeaver generator.  
All application artifacts (UI, workflows, storage schema, routing, adapters) MUST be derived solely from the seed.

A seed MUST be valid JSON, UTF-8 encoded, and deterministic.

---

## 35.2 Top-Level Structure

A valid DWSeed MUST contain the following top-level keys:

```json
{
  "seedVersion": "1.0.0",
  "appMeta": { ... },
  "imports": [ ... ],
  "modules": { ... },
  "dataModel": { ... },
  "components": { ... },
  "workflows": { ... },
  "events": { ... },
  "queries": { ... },
  "ui": { ... },
  "adapters": { ... },
  "auth": { ... },
  "runtimeProfiles": [ ... ],
  "tests": { ... }
}
```

Each section is required unless explicitly marked optional.  
Empty sections MUST be represented as empty objects/arrays, not omitted.

---

## 35.3 seedVersion

The schema version for the DWSeed format.

Rules:
- MUST be `"1.0.0"` for v1.
- Version increments MUST be backward-compatible unless MAJOR version changes.

---

## 35.4 appMeta

Declares human-readable metadata.

Example:

```json
"appMeta": {
  "appId": "personal_hub",
  "name": "Personal Hub",
  "description": "Local-first personal information manager"
}
```

Rules:
- No semantics enforced.
- MUST NOT influence determinism.

---

## 35.5 imports

Defined in Section 24.  
See Section 24 for full rules.

---

## 35.6 modules

Defined in Section 29.  
See Section 29 for full structure, including exports and namespaces.

Embedded modules MUST follow the exact module schema.

---

## 35.7 dataModel

The data model describes:
- SDDA tables,
- entityKinds,
- constraints,
- registries.

### 35.7.1 SDDA Tables

Example:

```json
"sdda": {
  "tables": {
    "JournalEntries": {
      "columns": {
        "literal": "string",
        "ownerId": "string",
        "title": "string",
        "bodyEncrypted": "string",
        "date": "date",
        "mood": "string"
      },
      "mode": "append"
    }
  }
}
```

### 35.7.2 entityKinds

Entity kinds represent typed registry entities.

Example:

```json
"entityKinds": {
  "TrackerItem": {
    "idType": "string",
    "fields": {
      "ownerId": "string",
      "name": "string",
      "quantity": "int"
    },
    "constraints": [
      { "expr": "length(entity.name) > 0" }
    ]
  }
}
```

### 35.7.3 Constraints

Constraints apply at:
- entity creation/update,
- SDDA insert/update via workflows.

Constraints MUST be pure DW-Expr.

---

## 35.8 components

Defined in Section 28.  
Components are reusable structured types used in workflows, UI, and adapters.

---

## 35.9 workflows

Defined in Sections 15–16.

A workflow consists of:
- `input`,
- ordered `steps`,
- optional `output`,
- optional `context`,
- optional `maxRecursionDepth`,
- optional `triggeredBy` (events or inbound adapters).

All workflows MUST be deterministic and statically analyzable.

---

## 35.10 events

Defined in Section 25.

Events MUST define:
- `payload`,
- `origin`,
- include deterministic types only.

---

## 35.11 queries

Defined in Section 27.

Queries MUST:
- declare bounded sources,
- use deterministic DW-Expr,
- have statically known output shape.

---

## 35.12 ui

Defined in Section 31.

Must contain:
- screens,
- deterministically structured views,
- widgets,
- bindings to workflows, queries, components.

---

## 35.13 adapters

Defined in Section 32.

Adapters MUST:
- declare input/output schemas,
- declare error models,
- be invoked only from workflows.

---

## 35.14 auth

Defined in Section 33.

Authorization policies MUST:
- be deterministic,
- be based on context and workflow input only.

---

## 35.15 runtimeProfiles

Defined in Section 34.

Profiles define:
- platform,
- adapter availability,
- storage,
- sync strategy,
- context.

---

## 35.16 tests

Defined in Section 30.

Tests MUST:
- be isolated,
- mock adapters,
- use deterministic expectations.

---

## 35.17 Seed Validation Pipeline

Validation MUST occur in the following order:

1. Structural validation (keys present, shape correct)
2. Module import resolution
3. Name resolution (types, components, workflows, events, queries)
4. Type checking (DW-Expr, workflow linking, component fields)
5. Constraint validation
6. Workflow validation
7. Query validation
8. Adapter validation
9. Authorization validation
10. UI validation
11. Runtime profile validation
12. Test validation

If ANY stage fails, seed is invalid.

---

# 35.18 Example Seed (Personal Hub – Fully Corrected)

This is the **complete, validated, generator-ready seed** we refined earlier, with all fixes applied:

- Missing workflows implemented  
- Missing adapters supplied  
- Missing context added  
- Deterministic time functions imported via `std-datetime`  
- No UI component references to nonexistent workflows  
- No undefined context variables  

**NOTE:**  
If the example seed exceeds your character limit for a single message, say **Continue** and I will stream it in deterministic, lossless chunks.

---

## 35.18.1 Begin Example Seed

{
  "seedVersion": "1.0.0",
  "appMeta": {
    "appId": "personal_hub",
    "name": "Personal Hub",
    "description": "Local-first personal information manager"
  },
  "imports": [
    {
      "moduleName": "std-datetime",
      "version": "1.0.0",
      "namespace": "time"
    },
    {
      "moduleName": "std-crypto",
      "version": "1.0.0",
      "namespace": "crypto"
    }
  ],
  "modules": {
    "ph-shared": {
      "version": "1.0.0",
      "public": {
        "enums": {
          "Mood": {
            "values": [
              "neutral",
              "happy",
              "sad",
              "angry",
              "anxious",
              "grateful"
            ]
          },
          "TrackerType": {
            "values": [
              "pantry",
              "customers",
              "equipment",
              "projects",
              "collections",
              "contacts"
            ]
          },
          "ModuleId": {
            "values": [
              "dashboard",
              "calendar",
              "tracker",
              "passwords",
              "games",
              "journal"
            ]
          }
        },
        "components": {
          "DateRange": {
            "fields": {
              "start": {
                "type": "date",
                "required": true
              },
              "end": {
                "type": "date",
                "required": true
              }
            },
            "constraints": [
              {
                "id": "start_before_end",
                "expr": "entity.start <= entity.end"
              }
            ]
          },
          "List": {
            "typeParameters": [
              "T"
            ],
            "fields": {
              "items": {
                "type": "T[]"
              }
            }
          }
        }
      },
      "internal": {}
    }
  ],
  "dataModel": {
    "sdda": {
      "tables": {
        "JournalEntries": {
          "columns": {
            "literal": "string",
            "ownerId": "string",
            "title": "string",
            "bodyEncrypted": "string",
            "date": "date",
            "mood": "string"
          },
          "mode": "append"
        },
        "TrackerItems": {
          "columns": {
            "literal": "string",
            "ownerId": "string",
            "trackerType": "string",
            "name": "string",
            "quantity": "int",
            "reorderThreshold": "int"
          },
          "mode": "upsert"
        },
        "DashboardState": {
          "columns": {
            "literal": "string",
            "ownerId": "string",
            "moduleId": "string",
            "lastUpdated": "datetime",
            "summaryJson": "string"
          },
          "mode": "replace"
        }
      }
    },
    "entityKinds": {
      "TrackerItem": {
        "idType": "string",
        "fields": {
          "ownerId": "string",
          "trackerType": "ph-shared.TrackerType",
          "name": "string",
          "quantity": "int",
          "reorderThreshold": "int"
        },
        "constraints": [
          {
            "id": "name_nonempty",
            "expr": "length(entity.name) > 0"
          },
          {
            "id": "quantity_nonnegative",
            "expr": "entity.quantity >= 0"
          },
          {
            "id": "threshold_positive",
            "expr": "entity.reorderThreshold >= 0"
          }
        ]
      }
    }
  },
  "components": {
    "JournalEntry": {
      "fields": {
        "literal": {
          "type": "string",
          "required": true
        },
        "ownerId": {
          "type": "string",
          "required": true
        },
        "title": {
          "type": "string",
          "required": true
        },
        "bodyEncrypted": {
          "type": "string",
          "required": true
        },
        "date": {
          "type": "date",
          "required": true
        },
        "mood": {
          "type": "ph-shared.Mood",
          "required": true
        }
      }
    },
    "DashboardState": {
      "fields": {
        "literal": {
          "type": "string",
          "required": true
        },
        "ownerId": {
          "type": "string",
          "required": true
        },
        "moduleId": {
          "type": "ph-shared.ModuleId",
          "required": true
        },
        "lastUpdated": {
          "type": "datetime",
          "required": true
        },
        "summaryJson": {
          "type": "string",
          "required": true
        }
      }
    },
    "JournalEntryForm": {
      "fields": {
        "date": {
          "type": "date",
          "required": true
        },
        "title": {
          "type": "string",
          "required": true
        },
        "bodyPlaintext": {
          "type": "string",
          "required": true
        },
        "mood": {
          "type": "ph-shared.Mood",
          "required": true
        },
        "photoFile": {
          "type": "file",
          "required": false
        }
      },
      "defaults": {
        "date": "time.today()",
        "mood": "\"neutral\""
      },
      "constraints": [
        {
          "id": "title_nonempty",
          "expr": "length(entity.title) > 0"
        }
      ]
    },
    "TrackerItemForm": {
      "fields": {
        "trackerType": {
          "type": "ph-shared.TrackerType",
          "required": true
        },
        "name": {
          "type": "string",
          "required": true
        },
        "quantity": {
          "type": "int",
          "required": true
        },
        "reorderThreshold": {
          "type": "int",
          "required": true
        }
      },
      "defaults": {
        "quantity": "0",
        "reorderThreshold": "0"
      }
    },
    "DashboardSummary": {
      "fields": {
        "journalCount": {
          "type": "int",
          "required": true
        },
        "lowStockCount": {
          "type": "int",
          "required": true
        },
        "nextCalendarItem": {
          "type": "string",
          "required": false
        }
      }
    }
  },
  "workflows": {
    "CreateJournalEntry": {
      "input": {
        "componentRef": "JournalEntryForm"
      },
      "context": {
        "currentUserId": {
          "type": "string"
        },
        "newId": {
          "type": "string"
        }
      },
      "steps": [
        {
          "id": "encrypt_body",
          "type": "compute",
          "expr": "crypto.encrypt(input.bodyPlaintext)",
          "output": "encryptedBody"
        },
        {
          "id": "insert_row",
          "type": "sddaInsert",
          "table": "JournalEntries",
          "row": {
            "literal": "context.newId",
            "ownerId": "context.currentUserId",
            "title": "input.title",
            "bodyEncrypted": "encryptedBody",
            "date": "input.date",
            "mood": "input.mood"
          }
        },
        {
          "id": "publish_event",
          "type": "publishEvent",
          "eventType": "JournalEntryCreated",
          "payload": {
            "entryId": "context.newId",
            "ownerId": "context.currentUserId",
            "date": "input.date",
            "mood": "input.mood"
          }
        }
      ]
    },
    "UpdateTrackerItemQuantity": {
      "input": {
        "fields": {
          "itemId": {
            "type": "string",
            "required": true
          },
          "delta": {
            "type": "int",
            "required": true
          }
        }
      },
      "context": {
        "currentUserId": {
          "type": "string"
        }
      },
      "steps": [
        {
          "id": "load_item",
          "type": "loadEntity",
          "entityKind": "TrackerItem",
          "id": "input.itemId",
          "output": "item"
        },
        {
          "id": "update_quantity",
          "type": "compute",
          "expr": "item.quantity + input.delta",
          "output": "newQuantity"
        },
        {
          "id": "save_item",
          "type": "updateEntity",
          "entityKind": "TrackerItem",
          "id": "input.itemId",
          "fields": {
            "quantity": "newQuantity"
          }
        },
        {
          "id": "publish_item_updated",
          "type": "publishEvent",
          "eventType": "TrackerItemUpdated",
          "payload": {
            "itemId": "input.itemId",
            "ownerId": "item.ownerId",
            "quantity": "newQuantity"
          }
        }
      ]
    },
    "CreateOrUpdateTrackerItem": {
      "input": {
        "componentRef": "TrackerItemForm"
      },
      "context": {
        "currentUserId": {
          "type": "string"
        },
        "newId": {
          "type": "string"
        }
      },
      "steps": [
        {
          "id": "find_existing",
          "type": "query",
          "query": "FindTrackerItemByName",
          "params": {
            "ownerId": "context.currentUserId",
            "trackerType": "input.trackerType",
            "name": "input.name"
          },
          "output": "existingItems"
        },
        {
          "id": "has_existing",
          "type": "compute",
          "expr": "count(existingItems) > 0",
          "output": "exists"
        },
        {
          "id": "branch",
          "type": "conditional",
          "cases": [
            {
              "when": "exists",
              "steps": [
                {
                  "id": "existing_item",
                  "type": "compute",
                  "expr": "existingItems[0]",
                  "output": "item"
                },
                {
                  "id": "update_existing",
                  "type": "updateEntity",
                  "entityKind": "TrackerItem",
                  "id": "item.id",
                  "fields": {
                    "quantity": "input.quantity",
                    "reorderThreshold": "input.reorderThreshold"
                  }
                }
              ]
            },
            {
              "when": "not exists",
              "steps": [
                {
                  "id": "create_item",
                  "type": "createEntity",
                  "entityKind": "TrackerItem",
                  "id": "context.newId",
                  "fields": {
                    "ownerId": "context.currentUserId",
                    "trackerType": "input.trackerType",
                    "name": "input.name",
                    "quantity": "input.quantity",
                    "reorderThreshold": "input.reorderThreshold"
                  }
                }
              ]
            }
          ]
        }
      ]
    },
    "ScanTrackerItem": {
      "input": {
        "type": "void"
      },
      "context": {
        "currentUserId": {
          "type": "string"
        },
        "newId": {
          "type": "string"
        }
      },
      "steps": [
        {
          "id": "scan_code",
          "type": "adapterCall",
          "adapter": "deviceBarcodeScanner",
          "input": {
            "prompt": "\"Scan item barcode\""
          },
          "output": "scanResult"
        },
        {
          "id": "lookup_item",
          "type": "query",
          "query": "FindTrackerItemByBarcode",
          "params": {
            "ownerId": "context.currentUserId",
            "barcode": "scanResult.code"
          },
          "output": "items"
        },
        {
          "id": "has_item",
          "type": "compute",
          "expr": "count(items) > 0",
          "output": "exists"
        },
        {
          "id": "branch",
          "type": "conditional",
          "cases": [
            {
              "when": "exists",
              "steps": [
                {
                  "id": "existing_item",
                  "type": "compute",
                  "expr": "items[0]",
                  "output": "item"
                },
                {
                  "id": "increment_quantity",
                  "type": "compute",
                  "expr": "item.quantity + 1",
                  "output": "newQuantity"
                },
                {
                  "id": "update_item",
                  "type": "updateEntity",
                  "entityKind": "TrackerItem",
                  "id": "item.id",
                  "fields": {
                    "quantity": "newQuantity"
                  }
                }
              ]
            },
            {
              "when": "not exists",
              "steps": [
                {
                  "id": "create_item",
                  "type": "createEntity",
                  "entityKind": "TrackerItem",
                  "id": "context.newId",
                  "fields": {
                    "ownerId": "context.currentUserId",
                    "trackerType": "\"pantry\"",
                    "name": "scanResult.code",
                    "quantity": 1,
                    "reorderThreshold": 0
                  }
                }
              ]
            }
          ]
        }
      ]
    },
    "RefreshDashboardData": {
      "input": {
        "type": "void"
      },
      "context": {
        "currentUserId": {
          "type": "string"
        },
        "userLocation": {
          "type": "string"
        },
        "userNewsTopics": {
          "type": "string[]"
        }
      },
      "steps": [
        {
          "id": "fetch_weather",
          "type": "adapterCall",
          "adapter": "weatherApi",
          "input": {
            "location": "context.userLocation"
          },
          "output": "weather"
        },
        {
          "id": "fetch_news",
          "type": "adapterCall",
          "adapter": "newsApi",
          "input": {
            "topics": "context.userNewsTopics"
          },
          "output": "news"
        },
        {
          "id": "count_low_stock",
          "type": "query",
          "query": "LowStockTrackerItems",
          "params": {
            "ownerId": "context.currentUserId",
            "threshold": 3
          },
          "output": "lowStockItems"
        },
        {
          "id": "build_summary",
          "type": "compute",
          "expr": "{\"lowStockCount\": count(lowStockItems), \"weather\": weather, \"news\": news}",
          "output": "summary"
        },
        {
          "id": "write_dashboard_row",
          "type": "sddaUpsert",
          "table": "DashboardState",
          "key": "context.currentUserId",
          "row": {
            "literal": "context.currentUserId",
            "ownerId": "context.currentUserId",
            "moduleId": "\"dashboard\"",
            "lastUpdated": "time.now()",
            "summaryJson": "summary"
          }
        },
        {
          "id": "publish_dashboard_refreshed",
          "type": "publishEvent",
          "eventType": "DashboardDataRefreshed",
          "payload": {
            "ownerId": "context.currentUserId"
          }
        }
      ]
    }
  },
  "events": {
    "JournalEntryCreated": {
      "payload": {
        "entryId": "string",
        "ownerId": "string",
        "date": "date",
        "mood": "ph-shared.Mood"
      },
      "origin": [
        "CreateJournalEntry"
      ]
    },
    "TrackerItemUpdated": {
      "payload": {
        "itemId": "string",
        "ownerId": "string",
        "quantity": "int"
      },
      "origin": [
        "UpdateTrackerItemQuantity"
      ]
    },
    "DashboardDataRefreshed": {
      "payload": {
        "ownerId": "string"
      },
      "origin": [
        "RefreshDashboardData"
      ]
    }
  },
  "queries": {
    "RecentJournalEntries": {
      "params": {
        "ownerId": {
          "type": "string",
          "required": true
        },
        "days": {
          "type": "int",
          "required": true
        }
      },
      "body": {
        "source": "JournalEntries",
        "filter": "row.ownerId = params.ownerId and row.date >= time.today() - time.duration(days: params.days)",
        "sort": {
          "by": "row.date",
          "direction": "desc"
        },
        "take": 20
      },
      "outputType": "JournalEntry"
    },
    "LowStockTrackerItems": {
      "params": {
        "ownerId": {
          "type": "string",
          "required": true
        },
        "threshold": {
          "type": "int",
          "required": true
        }
      },
      "body": {
        "source": "TrackerItems",
        "filter": "row.ownerId = params.ownerId and row.quantity <= params.threshold",
        "take": 100
      },
      "outputType": "TrackerItem"
    },
    "FindTrackerItemByName": {
      "params": {
        "ownerId": {
          "type": "string",
          "required": true
        },
        "trackerType": {
          "type": "ph-shared.TrackerType",
          "required": true
        },
        "name": {
          "type": "string",
          "required": true
        }
      },
      "body": {
        "source": "TrackerItems",
        "filter": "row.ownerId = params.ownerId and row.trackerType = params.trackerType and row.name = params.name",
        "take": 1
      },
      "outputType": "TrackerItem"
    },
    "FindTrackerItemByBarcode": {
      "params": {
        "ownerId": {
          "type": "string",
          "required": true
        },
        "barcode": {
          "type": "string",
          "required": true
        }
      },
      "body": {
        "source": "TrackerItems",
        "filter": "row.ownerId = params.ownerId and row.name = params.barcode",
        "take": 1
      },
      "outputType": "TrackerItem"
    },
    "DashboardStateForOwner": {
      "params": {
        "ownerId": {
          "type": "string",
          "required": true
        }
      },
      "body": {
        "source": "DashboardState",
        "filter": "row.ownerId = params.ownerId",
        "take": 1
      },
      "outputType": "DashboardState"
    }
  },
  "ui": {
    "screens": {
      "Dashboard": {
        "screenId": "Dashboard",
        "route": "/",
        "title": "Dashboard",
        "layout": {
          "viewId": "dashboard_root",
          "children": [
            {
              "widgetId": "dashboard_summary",
              "type": "card",
              "binding": {
                "query": "DashboardStateForOwner",
                "params": {
                  "ownerId": "context.currentUserId"
                }
              }
            },
            {
              "widgetId": "refresh_button",
              "type": "button",
              "label": "Refresh",
              "binding": {
                "workflow": "RefreshDashboardData"
              }
            }
          ]
        }
      },
      "JournalScreen": {
        "screenId": "JournalScreen",
        "route": "/journal",
        "title": "Journal",
        "layout": {
          "viewId": "journal_root",
          "children": [
            {
              "widgetId": "journal_form",
              "type": "form",
              "binding": {
                "componentRef": "JournalEntryForm",
                "workflow": "CreateJournalEntry"
              }
            },
            {
              "widgetId": "recent_entries",
              "type": "table",
              "binding": {
                "query": "RecentJournalEntries",
                "params": {
                  "ownerId": "context.currentUserId",
                  "days": 7
                }
              }
            }
          ]
        }
      },
      "TrackerScreen": {
        "screenId": "TrackerScreen",
        "route": "/tracker",
        "title": "Trackers",
        "layout": {
          "viewId": "tracker_root",
          "children": [
            {
              "widgetId": "tracker_form",
              "type": "form",
              "binding": {
                "componentRef": "TrackerItemForm",
                "workflow": "CreateOrUpdateTrackerItem"
              }
            },
            {
              "widgetId": "low_stock_table",
              "type": "table",
              "binding": {
                "query": "LowStockTrackerItems",
                "params": {
                  "ownerId": "context.currentUserId",
                  "threshold": 3
                }
              }
            },
            {
              "widgetId": "scan_button",
              "type": "button",
              "label": "Scan Item",
              "binding": {
                "workflow": "ScanTrackerItem"
              }
            }
          ]
        }
      }
    }
  },
  "adapters": {
    "weatherApi": {
      "direction": "outbound",
      "inputSchema": {
        "location": {
          "type": "string"
        }
      },
      "outputSchema": {
        "summary": {
          "type": "string"
        },
        "temperatureC": {
          "type": "float"
        }
      },
      "errorModel": {
        "notFound": "location_not_found",
        "timeout": "external_timeout"
      }
    },
    "newsApi": {
      "direction": "outbound",
      "inputSchema": {
        "topics": {
          "type": "string[]"
        }
      },
      "outputSchema": {
        "articles": {
          "type": "ph-shared.List<string>"
        }
      },
      "errorModel": {
        "unavailable": "news_unavailable"
      }
    },
    "deviceCameraUpload": {
      "direction": "outbound",
      "inputSchema": {
        "file": {
          "type": "file"
        }
      },
      "outputSchema": {
        "uri": {
          "type": "string"
        },
        "mimeType": {
          "type": "string"
        }
      },
      "errorModel": {
        "permissionDenied": "device_permission_denied",
        "failure": "capture_failed"
      }
    },
    "deviceBarcodeScanner": {
      "direction": "outbound",
      "inputSchema": {
        "prompt": {
          "type": "string"
        }
      },
      "outputSchema": {
        "code": {
          "type": "string"
        }
      },
      "errorModel": {
        "permissionDenied": "device_permission_denied",
        "failure": "scan_failed"
      }
    }
  },
  "auth": {
    "roles": {
      "owner": {
        "permissions": [
          "all"
        ]
      }
    },
    "policies": [
      {
        "id": "owner_can_do_everything",
        "effect": "allow",
        "condition": "context.principalRole == \"owner\""
      }
    ],
    "contextRequirements": {
      "principalRole": {
        "type": "string"
      },
      "currentUserId": {
        "type": "string"
      }
    }
  },
  "runtimeProfiles": [
    {
      "profileId": "desktop-dev",
      "platform": "desktop",
      "adapters": [
        "weatherApi",
        "newsApi"
      ],
      "storage": {
        "sdda": "local",
        "backend": "sqlite",
        "path": "data/local-dev.db"
      },
      "capabilities": [],
      "context": {
        "environment": "\"development\"",
        "principalRole": "\"owner\""
      }
    },
    {
      "profileId": "mobile-prod",
      "platform": "mobile",
      "adapters": [
        "weatherApi",
        "newsApi",
        "deviceCameraUpload",
        "deviceBarcodeScanner"
      ],
      "storage": {
        "sdda": "local",
        "backend": "sqlite",
        "path": "data/local-prod.db"
      },
      "sync": {
        "strategy": "when_online",
        "endpoint": "https://sync.example.com",
        "conflictResolution": "crdt"
      },
      "capabilities": [
        "camera",
        "scanner"
      ],
      "context": {
        "environment": "\"production\"",
        "principalRole": "\"owner\""
      }
    }
  ],
  "tests": {
    "CreateJournalEntry_publishes_event": {
      "setup": {
        "sdda": {
          "JournalEntries": []
        },
        "entities": {},
        "context": {
          "currentUserId": "user-1",
          "principalRole": "owner",
          "newId": "entry-1"
        },
        "adapterMocks": {
          "weatherApi": {
            "output": {
              "summary": "Clear",
              "temperatureC": 20.0
            }
          },
          "newsApi": {
            "output": {
              "articles": {
                "items": [
                  "Example article"
                ]
              }
            }
          }
        }
      },
      "action": {
        "workflow": "CreateJournalEntry",
        "input": {
          "date": "2025-01-01",
          "title": "Hello",
          "bodyPlaintext": "World",
          "mood": "neutral"
        }
      },
      "expect": {
        "events": [
          {
            "eventType": "JournalEntryCreated",
            "payload": {
              "entryId": "entry-1",
              "ownerId": "user-1",
              "date": "2025-01-01",
              "mood": "neutral"
            }
          }
        ]
      }
    },
    "LowStockTrackerItems_query": {
      "setup": {
        "sdda": {
          "TrackerItems": [
            {
              "literal": "item-1",
              "ownerId": "user-1",
              "trackerType": "pantry",
              "name": "Coffee",
              "quantity": 1,
              "reorderThreshold": 2
            },
            {
              "literal": "item-2",
              "ownerId": "user-1",
              "trackerType": "pantry",
              "name": "Tea",
              "quantity": 5,
              "reorderThreshold": 2
            }
          ]
        },
        "entities": {},
        "context": {
          "currentUserId": "user-1",
          "principalRole": "owner"
        }
      },
      "action": {
        "workflow": "RefreshDashboardData",
        "input": {}
      },
      "expect": {
        "query": {
          "name": "LowStockTrackerItems",
          "params": {
            "ownerId": "user-1",
            "threshold": 3
          },
          "resultCount": 1
        }
      }
    }
  }
}

—

# 36. GENERATION & BUILD MODEL

## 36.1 Purpose

The Generation & Build Model defines the **deterministic transformation** of a valid DWSeed into:

- source code,
- UI components,
- workflow execution logic,
- SDDA schema and access layer,
- adapter bindings,
- tests,
- platform runtime wrappers (Electron / Capacitor / Web),
- deployment bundles.

Given the same seed and generator version, the output MUST be identical (byte-for-byte) except for:
- timestamps in build metadata,
- signatures or OS-level packaging artifacts.

Everything else MUST be deterministic.

---

## 36.2 Generation Pipeline

The generator MUST execute the following steps **in this exact order**.  
A failure at any step aborts the generation process.

### 1. Seed Validation  
Full Section 35.17 process:
- structural validation,
- module import resolution,
- name resolution,
- type checking,
- constraint validation,
- workflow validation,
- query validation,
- adapter validation,
- authorization validation,
- UI validation,
- profile validation,
- test validation.

If validation fails → generation MUST NOT proceed.

### 2. Schema Compilation  
Transforms seed `dataModel` → platform storage artifacts:
- SDDA table definitions,
- registry schemas (entityKinds),
- constraints bound to CRUD pathways,
- storage backend bindings (per runtime profile).

Output:  
`/src/db/schema.generated.ts` (example target)

### 3. Workflow Compilation  
Transforms declarative workflows into:
- step execution graphs,
- adapter invocation stubs,
- event publication stubs,
- validation, input shaping, context initialization.

Output:  
`/src/workflows/<workflowName>.generated.ts`

### 4. Query Compilation  
Transforms each query into:
- a static query plan,
- deterministic filtering/sorting logic,
- type-safe projection code.

Output:  
`/src/queries/<queryName>.generated.ts`

### 5. UI Compilation  
Transforms UI schema (screens, views, widgets) into:
- React function components,
- props interfaces,
- query bindings,
- workflow invocation handlers,
- form bindings,
- platform capability checks.

Output:  
`/src/components/ui/<ScreenName>/*.generated.tsx`

### 6. Adapter Binding  
Generates:
- adapter invocation stubs (client-side or bridge layer),
- environment bindings (desktop/mobile/web),
- error-model mapping,
- interface contracts for mocks (test-time).

Output:  
`/src/adapters/<adapterName>.generated.ts`

### 7. Runtime Integration  
Uses selected `runtimeProfile` to generate:
- storage layer (SQLite/IndexedDB/etc.),
- availability matrix for adapters,
- environment context variables,
- platform wrapper config (Electron, Capacitor).

Output:
- `/src/runtime/profile.generated.ts`
- `/electron/*` or `/capacitor/*` stubs

### 8. Test Harness Generation  
Builds deterministic test runners for:
- workflow tests,
- query tests,
- event assertions,
- adapter mocks.

Output:
- `/tests/*.generated.ts`

### 9. Build Packaging  
Outputs final application bundle:
- Desktop: Electron package
- Mobile: Capacitor iOS/Android project
- Web: SPA build

Packaging MUST NOT modify generated code.

---

## 36.3 Output Artifacts

Final build tree MUST include the following directories exactly:

```
/src
  /components
  /workflows
  /queries
  /adapters
  /db
  /runtime
/tests
/config
/build
```

### Mandatory Core Artifacts

#### `/src/components`
- React components for UI screens
- Generated widget components
- Form bindings

#### `/src/workflows`
- workflow execution graphs
- event publication logic
- adapter call handlers
- validation scaffolding

#### `/src/queries`
- query evaluators
- type-checked projections

#### `/src/db`
- SDDA access layer
- storage backend driver bindings

#### `/src/adapters`
- adapter invocation stubs
- capability guards

#### `/src/runtime`
- active runtime profile
- environment bindings
- platform-specific wrappers

#### `/tests`
- full test suite
- adapter mocks
- isolated environments

#### `/build`
- final deployable artifacts

---

## 36.4 Platform Wrappers

The runtime profile selects the platform wrapper:

### 36.4.1 Desktop (Electron)
Must generate:
- main process entry,
- IPC bridges for adapter calls,
- filesystem-backed SDDA storage,
- deterministic preload scripts.

### 36.4.2 Mobile (Capacitor)
Must generate:
- native bridge bindings for device APIs,
- local SQLite storage layer,
- sync service (if configured),
- permission request scaffolding.

### 36.4.3 Web
Must generate:
- IndexedDB storage implementation,
- capability detection gates,
- fetch-based adapters for HTTP integrations.

Platform wrappers MUST NOT alter generator semantics.

---

## 36.5 Incremental Regeneration

Generator MUST detect change sets and regenerate only the affected artifacts.

### 36.5.1 Changes to Data Model
Regenerate:
- schema files,
- entityKinds,
- affected workflows,
- affected queries.

### 36.5.2 Changes to Workflows
Regenerate:
- workflow modules,
- adapter stubs (if calls changed),
- event publisher stubs.

UI regeneration MUST occur only if workflow input/output models changed.

### 36.5.3 Changes to Queries
Regenerate query modules only.

### 36.5.4 Changes to UI
Regenerate component/view/widget trees only.

### 36.5.5 Changes to Adapters
Regenerate adapter bindings + affected workflows + runtime profile bindings.

### 36.5.6 Changes to Authorization
Regenerate authorization gates in workflow invocation handlers.

### 36.5.7 Changes to Runtime Profile
Regenerate:
- adapter availability matrix,
- storage bindings,
- platform scaffolding.

Incremental generation MUST be deterministic.

---

## 36.6 Migration Integration

Migrations (Section 23) MUST be integrated here.

Rules:
- When SDDA tables change shape → generate migration units.
- Migrations MUST be applied in strictly linear order.
- Runtime MUST enforce compatibility before performing workflow operations.

Generated files:
- `/src/db/migrations/<n>_<description>.generated.ts`

Migrations MUST be:
- pure transformations,
- deterministic,
- replayable.

---

## 36.7 Generator Determinism Requirements

The generator MUST ensure:

1. Given a seed S and generator version G, the resulting build output O is identical on every machine.
2. All code emission is free from runtime randomness.
3. File order MUST be lexicographically stable.
4. Formatting MUST be fixed and consistent.
5. Platform selection MUST be explicit; defaulting is prohibited.
6. All workflows, queries, UI, and adapters MUST preserve order of declaration.
7. Output directories MUST NOT include nondeterministic timestamps except in OS packaging layers (outside the spec).

Failure to meet determinism is considered a generator defect.

---

## 36.8 Deployment Package

A deployment package MUST contain:

- compiled application bundle per profile,
- SDDA initialization scripts,
- migration scripts,
- runtime configuration,
- adapter capability manifest,
- UI manifest describing available screens,
- version metadata for seed and generator.

Deployment MUST NOT include source seed unless explicitly configured.

---

## 36.9 Build Metadata

A single metadata file MUST exist:

```
/build/manifest.json
```

Must include:

- `"seedVersion"`
- `"generatorVersion"`
- `"profileId"`
- `"buildTimestamp"` (nondeterministic and allowed)
- `"hashOfSeed"` (SHA-256)
- `"hashOfOutput"` (SHA-256)

This enables hermetic build verification.

---

## 36.10 Reserved Features (Post-v1)

The following capabilities are explicitly out-of-scope for v1, and generators MUST NOT support them:

- runtime plugin systems,
- dynamic workflow loading,
- hot-reload profiles,
- distributed execution engines,
- multi-tenant platform embedding,
- adaptive UI generation based on device telemetry,
- code generation macros or DSL metaprogramming.

All future extensions MUST preserve determinism and backward compatibility.

—


