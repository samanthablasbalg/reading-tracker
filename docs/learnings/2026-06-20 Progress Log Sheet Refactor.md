# Session learnings — refactoring `progress-log-sheet.ts`

Concepts implemented once while turning the messy DNF code into a single state machine. Captured so
they don't evaporate.

---

## 1. Model state as ONE signal, not a pile of booleans

**Before:** `confirming`, `finishing`, `dnfing`, `confirmingFinish`, `confirmingDnf` — independent
booleans.

**Problem:** illegal combinations are _representable_. Nothing stops
`confirmingFinish && confirmingDnf` from both being true. The type system should make impossible
states _unspeakable_, not rely on "we promise not to."

**After:** one signal holding _which_ state we're in:

```ts
readonly mode = signal<'idle' | 'finishing' | 'dnfing' | 'confirmingFinish' | 'confirmingDnf'>('idle');
```

- The angle brackets spell out the _only_ values allowed. `mode.set('finished')` won't compile —
  `'finished'` isn't in the union. The compiler does your spell-check.
- A signal holds one value, so "two states at once" stops being expressible.

**The big rule:** a new state is for genuinely _different behavior / transitions_ — NOT for
different _display text_. "Happy finish" vs "weird finish" differ only in wording, derivable from
data (did the page change?), so they are the _same_ mode, not two. Modeling a display difference as
a state bloats the machine.

---

## 2. The signals family

| Tool                | Holds / does                                             | Form                                          |
| ------------------- | -------------------------------------------------------- | --------------------------------------------- |
| `signal(v)`         | a value you _set_                                        | `signal(false)`                               |
| `computed(() => …)` | a read-only value _derived_ from other signals           | re-runs itself when a signal it reads changes |
| `effect(() => …)`   | a _side effect on the outside world_ when signals change | lives in a constructor (injection context)    |

- **Read a signal by calling it:** `this.mode()`, not `this.mode`. `this.mode` is the signal object
  (a function) and never equals a string.
- **Spreadsheet analogy:** `signal` = a cell you type a number into. `computed` = a cell with
  `=A1+B1` (you never type its value; it recomputes itself). `effect` = "when A1 changes, also go
  update something _outside_ the sheet."

```ts
readonly submitting = computed(() => this.mode() === 'finishing' || this.mode() === 'dnfing' || this.saving());

constructor() {
  effect(() => {
    if (this.mode() === 'idle') this.pageControl.enable();
    else this.pageControl.disable();
  });
}
```

---

## 3. Naming signals/computeds

Name it for **the value it holds = the question it answers**, never for the situation it lives in.

- `submitting` answers "are we submitting? (yes/no)". It is NOT "the stuff that happens while
  submitting" — that's how you'd name a _function_, not a value.
- When the **name and the body agree**, the abstraction is honest. `submitting` reading
  `saving() || finishing() || dnfing()` reads right _because_ they're all submits. If it were named
  `finishingOrDnfing`, the `saving()` would look wrong inside it.
- An ugly inline condition (a big `||`) usually isn't ugly — it's just **unnamed**. Put it in a
  computed, give it a name, ask the named thing everywhere else.

---

## 4. State machines simplify guards

With separate booleans, every method had to _defensively_ OR together every "busy" flag, because
nothing guaranteed they were exclusive.

With one `mode` + the template controlling which buttons exist in which state, a method only needs
to guard the states it can actually be _reached from_.

- `onFinish` can never run while `mode` is `'dnfing'` (no button calls it there), so guarding
  against `'dnfing'` is guarding against the impossible.
- Reframe "is _anything_ busy?" (block-list) → "am I already in _this_ state?" (one equality check).

---

## 5. Not every `mode.set()` is the same transition

```ts
this.mode.set('finishing'); // commit: move INTO the work
// ...on request failure:
this.mode.set('idle'); // recovery: move BACK OUT so the user can retry
```

Copying the commit transition into the error handler (`set('finishing')` in both) leaves the machine
stuck in `'finishing'` forever — a dead-end. The error path's job is the _opposite_ of the commit's.

---

## 6. Two worlds in one file: template vs class

|                 | Inside `template:` backticks (Angular-land) | Inside the class body (TypeScript-land)  |
| --------------- | ------------------------------------------- | ---------------------------------------- |
| Drop a value in | `{{ expr }}`                                | `${ expr }` inside a **backtick** string |
| Reach a member  | bare: `data.title`                          | `this.data.title`                        |

```ts
// class body — TypeScript:
prompt: `Give up on ${this.data.title}?`;
ariaLabel: 'Confirm finish ' + this.data.title; // a real expression, NOT a quoted string
```

`{{ }}` and `${ }` _mean the same thing_ ("put a value here") but live in different worlds. `{{ }}`
only works in templates; `${ }` only works in backtick strings. Mixing them up (e.g. `{{ }}` inside
a class string) prints the literal characters.

---

## 7. Arrow-function / TypeScript gotchas

- **Concise return:** `() => A || B` returns the expression — no `{ return … }`.
- **Returning an object:** `() => ({ … })` needs parens, or the `{` reads as a function body. The
  block form `() => { return { … }; }` sidesteps it.
- **A `computed` must always return a value.** Two bare `if`s with no `else` leave a path returning
  `undefined` → TypeScript error. So `if/else` there is _required_, not stylistic.
- **A `void` method returns nothing anyway**, so two `if`s are fine there; `else` is just tidier.
  (Same `if/else` advice, totally different reason.)
- `{ doThing() };` — the `;` after a `}` block is a separate, do-nothing "empty statement". Noise;
  drop it.

---

## 8. Reactive forms ↔ signals

- You **cannot** use `[disabled]` in the template on a control bound with `[formControl]`. Angular
  warns and it causes "changed after checked" errors. Toggle it programmatically:
  `pageControl.enable()` / `.disable()`.
- Bridge that imperative form state to your signal world with an `effect` that reads `mode()` and
  enables/disables — one source of truth instead of scattering `.disable()` calls across every
  transition.
- **Reactivity caveat:** a `computed`/`effect` only re-runs when a _signal_ it reads changes.
  Reading a non-signal like `pageControl.value` inside a `computed` does NOT make it re-run when the
  input changes. It was safe in our case only because `mode()` (a real signal) triggered the
  recompute at the right moment AND the input was locked. Reading non-signals in a computed is
  generally a smell.

---

## 9. `@switch` / screens vs modes

- `@switch` matches **one value per case** — no fall-through, no "this OR that". So if two modes
  share a screen, a naive switch duplicates markup.
- A **screen is coarser than a mode.** Five modes collapsed to two screens (`idle` vs
  everything-else), so the outer template is a single `@if (mode() === 'idle') { … } @else { … }` —
  one comparison, no OR.
- **Two-screen vs three-screen** (duplicate the confirm block, or parameterize one) is a real
  judgment call. Lens: count the **divergence points**. One or two differences → parameterize. Many
  differences all keyed on the same axis → the parameterized version is just the same branch
  copy-pasted N times. Removing duplication is good _until_ it forces branching logic into a place
  meant to stay declarative (the template). Where the branch can live: inline in the template
  (worst), in a `computed` view-model in the class (sweet spot), or in a child component (heaviest).

---

## 10. Process

- **Run the tests before saying "done".** They caught: a real regression (the confirm prompt
  flashing during a _direct_ finish), a one-character bug (`...` vs the `…` glyph), and tests that
  simply needed updating (the component now makes a second HTTP request).
- **The regression that surfaced a design truth:** the two-screen model quietly assumes _every_
  finish goes through a confirm. Today's "skip confirm when the page is unchanged" behavior makes
  `'finishing'` ambiguous (did we confirm or not?). Clean fix = always-confirm-finish (the feature
  we deferred).
- **Prettier only runs if something invokes it** (editor on-save, or a hook).
  `prettier --check <file>` tells you if it _would_ change anything; `--write` applies it.
- **Committing with deliberately-red tests is fine** _if the commit message records what's red and
  why_ — otherwise it's a silent landmine for future-you.
