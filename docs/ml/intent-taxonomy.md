# SLaNg Intent Taxonomy — Part 1: Scope Definition

**Status:** Draft for review
**Depends on:** `src/symbolic.js`, `src/extended.js`, `src/convertor.js`, `main.js`, `script/predict.py` (read-only — not modified by this PR)
**Companion file:** [`intent-map.json`](./intent-map.json) — machine-readable version of §2 below

## 0. Why this document exists

`script/predict.py` currently only checks whether the input text contains
`"deriv"` or `"integr"`, defaulting to `"evaluate"` otherwise. This document
defines, precisely, what a future NLP/ML layer should be able to recognize,
and which existing library function each recognized intent maps to. Nothing
here changes any library file — this is a planning/spec deliverable only.

## 1. MVP (v1) intents — summary table

| # | Intent | Function | Module |
|---|--------|----------|--------|
| 1 | `derivative` | `symDiff(expr, variable)` | `src/symbolic.js` |
| 2 | `nth_derivative` | `symNthDiff(expr, variable, n)` | `src/symbolic.js` |
| 3 | `integral_indefinite` | `symIntegrate(expr, variable)` | `src/symbolic.js` |
| 4 | `integral_definite` | `symNumericalIntegrate(expr, variable, a, b, n)` | `src/symbolic.js` |
| 5 | `simplify` | `symSimplify(expr)` | `src/symbolic.js` |
| 6 | `evaluate` | `symEval(expr, vars)` | `src/symbolic.js` |
| 7 | `taylor_series` | `symTaylorSeries(expr, variable, center, terms)` | `src/symbolic.js` |
| 8 | `limit` | `computeLimit(expr, variable, value, maxHopital)` | `src/symbolic.js` |
| 9 | `gradient` | `symGradient(expr, variables)` | `src/symbolic.js` |
| 10 | `convert_to_latex` | `symToLatex(expr, opts)` | `src/symbolic.js` |

All ten operate on the same expression representation — the `SymExpr` AST
produced by `parseExpr(src)` in `src/symbolic.js` — which keeps v1 internally
consistent and matches how `main.js` currently calls `parseExpr` → `symDiff`
/ `symIntegrate` → `symSimplify` → `symToString`/`symToLatex`.

`evaluate` is also the pipeline's fallback intent today (see `predict.py`
and `main.js`'s `else` branch), so it must be in MVP even though it's the
"do nothing special" case.

## 2. Per-intent entries

### 2.1 `derivative`
- **Function:** `symDiff(expr, variable)`
- **Module:** `src/symbolic.js`
- **Required inputs:** `expr` (SymExpr AST from `parseExpr`), `variable` (string, e.g. `"x"`)
- **Returns:** SymExpr AST — **not simplified**; must be passed through `symSimplify` then `symToString`/`symToLatex` for display (this is exactly what `main.js` does today)
- **Example phrasings:**
  - "differentiate x^2 + 3x"
  - "find the derivative of sin(x) with respect to x"
  - "what's d/dx of 2x^3 - 5"
- **Ambiguous / edge cases to flag:**
  - Variable not stated in the sentence — `main.js` currently hardcodes `'x'`; the parser/model needs a documented default or a clarifying-question path
  - "second derivative", "third derivative" phrased using the word "derivative" — these should route to `nth_derivative`, not this intent
- **Notes:** Overlaps with `nth_derivative` at n=1; a classifier could always route to `nth_derivative` with a default `n=1` instead of keeping these separate — flagging as a design choice, not deciding it here.

### 2.2 `nth_derivative`
- **Function:** `symNthDiff(expr, variable, n = 1)`
- **Module:** `src/symbolic.js`
- **Required inputs:** `expr` (SymExpr), `variable` (string), `n` (number, order)
- **Returns:** SymExpr — **already simplified** internally (JSDoc: "nth derivative (simplified)"), unlike `symDiff`
- **Example phrasings:**
  - "second derivative of x^3"
  - "find d²y/dx² of sin(x)"
  - "differentiate cos(x) 3 times"
- **Ambiguous / edge cases to flag:**
  - Extracting `n` from natural language ("second", "3 times", "d²/dx²") is non-trivial and belongs to Part 2 (parser), not this document
  - Overlap with `derivative` noted above

### 2.3 `integral_indefinite`
- **Function:** `symIntegrate(expr, variable)`
- **Module:** `src/symbolic.js`
- **Required inputs:** `expr` (SymExpr), `variable` (string)
- **Returns:** SymExpr antiderivative **without +C**, or `null` if the form isn't recognized (per JSDoc — the model/parser layer needs to handle the `null` case, e.g. falling back to `integral_definite` via numerical methods, or reporting "can't integrate symbolically")
- **Example phrasings:**
  - "integrate x^2 + 1"
  - "find the antiderivative of cos(x)"
  - "what is the integral of 1/x"
- **Ambiguous / edge cases to flag:**
  - No bounds given but user says "evaluate the integral" (they may actually want `integral_definite` with implied bounds, or just the antiderivative expression)
  - `symIntegrate` returning `null` needs a defined fallback behavior — out of scope for this doc, but flagged as a gap for Part 2/3

### 2.4 `integral_definite`
- **Function:** `symNumericalIntegrate(expr, variable, a, b, n = 1000)`
- **Module:** `src/symbolic.js`
- **Required inputs:** `expr` (SymExpr), `variable` (string), `a` (lower bound, number), `b` (upper bound, number); `n` optional (subintervals, default 1000)
- **Returns:** `number` (Simpson's-rule numerical result — not symbolic)
- **Example phrasings:**
  - "integrate x^2 from 0 to 5"
  - "find the area under sin(x) between 0 and pi"
  - "evaluate the definite integral of 1/(1+x^2) from -1 to 1"
- **Ambiguous / edge cases to flag:**
  - Extracting two numeric bounds from a sentence reliably is a Part 2 parsing problem
  - This function is always numerical, even when a closed-form antiderivative exists via `symIntegrate` — worth deciding later whether to try `symIntegrate` + evaluate first, for an exact answer, before falling back to `symNumericalIntegrate`

### 2.5 `simplify`
- **Function:** `symSimplify(expr)`
- **Module:** `src/symbolic.js`
- **Required inputs:** `expr` (SymExpr)
- **Returns:** SymExpr (simplified — constant folding, identity elimination)
- **Example phrasings:**
  - "simplify 2x + 3x - 1"
  - "reduce (x^2 - 1)/(x - 1)"
  - "combine like terms in 3*2*x"
- **Ambiguous / edge cases to flag:**
  - "reduce" / "combine like terms" / "simplify" are near-synonyms a parser must map to the same intent
  - `symSimplify` does not do algebraic cancellation of common polynomial factors (confirmed by reading the function) — so "simplify (x^2-1)/(x-1)" won't actually cancel to `x+1`; this is a known limitation, not a bug, and should be documented for whoever writes example phrasings for the dataset in Part 4 (don't pick misleading examples)

### 2.6 `evaluate`
- **Function:** `symEval(expr, vars = {})`
- **Module:** `src/symbolic.js`
- **Required inputs:** `expr` (SymExpr), `vars` (object mapping variable names to numbers, e.g. `{ x: 2 }`)
- **Returns:** `number`
- **Example phrasings:**
  - "evaluate x^2 + 1 at x = 3"
  - "what is sin(x) when x is pi/2"
  - "plug in x=2 to 3x - 5"
- **Ambiguous / edge cases to flag:**
  - This is the pipeline's default/fallback intent today (see `predict.py` — anything not matching "deriv"/"integr" prints `"evaluate"`), so a huge range of unrelated phrasings will land here by default until more intents are added to the classifier
  - Multi-variable expressions need multiple `var=value` pairs extracted — Part 2 concern

### 2.7 `taylor_series`
- **Function:** `symTaylorSeries(expr, variable, center = 0, terms = 5)`
- **Module:** `src/symbolic.js`
- **Required inputs:** `expr` (SymExpr), `variable` (string); `center`, `terms` optional
- **Returns:** `{ polynomial: Object, coefficients: number[], latex: string }` — note this is a different return shape than most other functions (an object, not a bare SymExpr or number)
- **Example phrasings:**
  - "Taylor series of e^x around 0"
  - "Maclaurin series of sin(x)"
  - "expand cos(x) to 6 terms at x=0"
- **Ambiguous / edge cases to flag:**
  - "Maclaurin series" is a Taylor series centered at 0 — needs to be recognized as the same intent with `center` defaulted
  - Extracting "how many terms" from phrasing is optional; the function already has a sane default (5)

### 2.8 `limit`
- **Function:** `computeLimit(expr, variable, value, maxHopital = 5)`
- **Module:** `src/symbolic.js`
- **Required inputs:** `expr` (SymExpr), `variable` (string), `value` (number, approach point — `Infinity` is valid for ∞)
- **Returns:** `{ limit: number|null, method: string, exists: boolean, leftLimit?, rightLimit? }` — another object return, not a bare SymExpr
- **Example phrasings:**
  - "limit of sin(x)/x as x approaches 0"
  - "find the limit of 1/x as x goes to infinity"
  - "what happens to (x^2-1)/(x-1) as x approaches 1"
- **Ambiguous / edge cases to flag:**
  - "approaches infinity" / "goes to infinity" must map to the numeric `Infinity` (JS), which the function explicitly supports
  - One-sided limits ("as x approaches 0 from the right") are not distinguished by this function's signature — flagged as a gap, not something to solve here

### 2.9 `gradient`
- **Function:** `symGradient(expr, variables)` — **chosen as canonical for v1** (see Known Overlaps §4)
- **Module:** `src/symbolic.js`
- **Required inputs:** `expr` (SymExpr, may contain multiple variables), `variables` (string array, e.g. `['x', 'y']`)
- **Returns:** `{ x: SymExpr, y: SymExpr, ... }` — object keyed by variable name
- **Example phrasings:**
  - "find the gradient of x^2 + y^2"
  - "partial derivatives of x*y + sin(x)"
  - "compute ∇f for f = x^2*y - y^3"
- **Ambiguous / edge cases to flag:**
  - See Known Overlaps (§4) — `extended.js` has its own `gradient(func, variables)` operating on a completely different expression representation
  - Extracting the list of variables from a phrase (vs. assuming `['x','y']`) is a Part 2 concern

### 2.10 `convert_to_latex`
- **Function:** `symToLatex(expr, opts = {})`
- **Module:** `src/symbolic.js`
- **Required inputs:** `expr` (SymExpr); `opts` optional
- **Returns:** `string` (LaTeX)
- **Example phrasings:**
  - "convert x^2 + 1 to LaTeX"
  - "show me the LaTeX for sin(x)/cos(x)"
  - "what does 3x^2 look like in LaTeX"
- **Ambiguous / edge cases to flag:**
  - `symToString(expr)` (plain-text form, e.g. `"3*cos(x)"`) is a close sibling — a user asking "show me x^2+1 in plain text" vs "in LaTeX" needs the classifier to distinguish these; not covered as a separate MVP intent here, flagged as a candidate for future scope if it turns out users ask for both
  - `main.js` currently calls `symToString` for its CLI output (not `symToLatex`) — worth keeping in mind so the model's "default display format" assumption matches the actual pipeline behavior, not just this doc's LaTeX example

## 3. Known overlaps / duplication (flagged, not resolved here)

- **Gradient:** `symGradient(expr, variables)` in `src/symbolic.js` operates on the `SymExpr` AST (from `parseExpr`). `gradient(func, variables)` in `src/extended.js` operates on a **different** "function object" representation (created via `createFunction`/`parseFunction` in the same file). These are not interchangeable — passing a `SymExpr` to `extended.js`'s `gradient` (or vice versa) will not work. **v1 canonical choice: `symGradient`**, because it matches the representation `parseExpr`/`symDiff`/`symIntegrate` already use, keeping the whole v1 pipeline on one data structure. `extended.js`'s `gradient` is listed under Future/Out of Scope (§5) since it would require bringing in `extended.js`'s separate expression format.
- **Hessian:** same situation — `symHessian(expr, variables)` (`symbolic.js`) vs. `hessian(func, variables)` (`extended.js`), same two incompatible representations. Not in MVP; flagged here since it's the same pattern as gradient and will need the same decision later.
- **Differentiation:** `symDiff(expr, variable)` (`symbolic.js`) vs. `differentiateFunction(func, variable)` (`extended.js`) — again, two representations of "differentiate." v1 uses `symDiff` exclusively, consistent with `main.js`.
- **LaTeX conversion:** `symToLatex(expr)` in `symbolic.js` vs. `slangToLatex(expression)` in `src/convertor.js` vs. `extendedSlangToLatex(expr)` in `src/extended.js` — **three** separate LaTeX conversion functions exist across the codebase, each apparently tied to a different internal representation (symbolic AST, legacy SLaNg fraction/polynomial form, and extended-function form respectively). v1 uses `symToLatex` only, since it's the one that pairs with `parseExpr`. The other two are noted here so nobody building Part 2/3 accidentally mixes representations.

## 4. Future / Out of scope for v1

One line each — awareness only, no full mapping:

- **`extended.js`:** `gradient`/`hessian`/`differentiateFunction` (operate on the separate "function object" representation — see §3), `tangentPlane`, `tangentLine`, `surfaceNormal`, `findCriticalPoints`, `classifyCriticalPoint`, `findExtrema`/`findGlobalExtrema`, `lagrangeMultipliers`, `directionalDerivative`, `steepestDirections` — full multivariable-calculus toolkit, deferred until v1's single-representation pipeline is proven out.
- **`src/symbolic.js` (advanced, not in v1 list):** `symFindCriticalPoints`, `implicitDiff`, `analyzeCurve`, `integrationByParts`, `partialFractions`, `fourierSeries`, `laplaceTransform`, `zTransform`, `arcLength`, `surfaceAreaOfRevolution`, `volumeOfRevolution`, `doubleIntegral`, `tripleIntegral`, `symHessian`, `evalGradient`, `evalHessian`, `symAreEqual` — all real, working functions, just not in the 8–10-intent MVP cut.
- **`src/math/linalg.js`:** linear algebra operations (matrices, vectors, eigenvalues, etc. — not inventoried in detail for this pass).
- **`src/math/ode.js`:** ODE solving.
- **`src/math/stats.js`:** statistics/probability functions.
- **`src/core/complex.js`:** complex number analysis.
- **FFT-related functionality** (referenced in `package.json` keywords) — not located/verified in this pass; flag for whoever scopes Part 1 follow-up.
- **`src/convertor.js` (LaTeX ↔ SLaNg, legacy representation):** `latexToSlang`, `batchConvertToLatex`/`batchConvertToSlang`, `validateLatex`, `areExpressionsEquivalent`, etc. — separate from the `symbolic.js` pipeline v1 is built on (see §3 overlap note); a future "convert" intent may need to pick between this and `symToLatex`/`parseExpr` explicitly rather than silently.

## 5. Judgment calls made in this document

- Chose `symGradient` over `extended.js`'s `gradient` as the sole v1 multivariable intent, to keep v1 on one expression representation (see §3).
- Split "integrate" into two separate intents (`integral_indefinite`, `integral_definite`) rather than one, because they call genuinely different functions with different return types (symbolic AST vs. plain number) and different required inputs (bounds vs. none) — collapsing them into one intent would hide that difference from Part 2's parser.
- Left `symToString` (plain-text output) out of the MVP intent list even though `main.js` uses it as the actual CLI output today — kept `convert_to_latex` (`symToLatex`) as the MVP intent instead since the task brief explicitly asked for "Convert to LaTeX," but flagged the mismatch with `main.js`'s real behavior in §2.10 so it isn't lost.
- Did not include a separate "nth derivative" vs. "derivative" merge decision — left both as separate MVP intents per the task brief's explicit list, but flagged the overlap in §2.1/§2.2 for Part 2 to resolve however it sees fit.
- **Added one extra field, `"returns"`, to every object in `intent-map.json`** beyond the five specified in the task brief (`intent`, `function`, `module`, `args`, `examples`). This isn't nesting, but it is a deviation from the exact structure requested, so flagging it explicitly here per the brief's instruction. Reasoning: several MVP functions return different shapes (bare SymExpr vs. plain `number` vs. a multi-field object like `computeLimit`'s `{ limit, method, exists }`), and Part 2/4 will likely need to know that up front to avoid assuming every intent returns the same kind of value. Happy to drop this field if the team building Part 2/4 would rather keep strictly to the 5-field spec.