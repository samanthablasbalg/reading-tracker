# Session learnings — refactoring audio support into `progress-log-sheet.ts`

> Work done in [#125](https://github.com/samanthablasbalg/rainbowsamreads/pull/125).

Cleaning up Sonnet's audio-logging additions. The original page-only version was clean; the audio
bolt-on duplicated everything and branched everywhere instead of extending the existing patterns.

---

## 1. Collapse duplicated branches by extracting the _data_, not the _flow_

**Before:** `save()` had a 40-line `if (isAudio) { ... } else { ... }` that duplicated the entire
subscribe/success/error pattern — identical structure, different field names.

**Problem:** the flow (call API, handle success, handle error) is the same for both formats. Only
the _inputs_ differ: which value to send, which property name to use, what the payload shape is.

**After:** a few small branches at the top of `save()` resolve the format-specific data, then one
shared flow uses it:

```ts
const updateValue = this.isAudio
  ? parseHhmm(this.minuteControl.value)
  : (this.pageControl.value as number);

const payload = this.isAudio
  ? { current_minute: updateValue }
  : { current_page: updateValue };

// one subscribe call, no duplication
this.engagementService.logProgress(id, payload).subscribe({ ... });
```

**The rule:** when two branches share the same _structure_ but differ in _data_, extract the data
and keep one copy of the structure.

---

## 2. Three buckets for derived values

| Bucket                     | When to use                                                         | Example                                           |
| -------------------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| `readonly` property        | Derived from static data known at construction; never changes       | `isAudio`, format-specific labels, property names |
| Local variable in a method | Needs the _current_ form state at call time                         | `updateValue`, `payload` inside `save()`          |
| `computed()` from signals  | Derived from signals that change over time; template needs to react | `submitting` from `mode()` + `saving()`           |

**Why `updateValue` can't be a computed:** it reads `minuteControl.value` or `pageControl.value` —
those are FormControl properties, NOT signals. A `computed` would capture the value at construction
time and never update when the user types. (This connects to learning #8 from the previous session:
computeds only re-run when a _signal_ they read changes.)

**Why format config isn't a computed either:** `isAudio` is a plain boolean, not a signal — it never
changes. A `computed` that reads no signals computes once and never recomputes. That _works_, but
it's the wrong tool. A plain `readonly` property says "this is fixed" more honestly.

---

## 3. Computed property names and TypeScript's limitation

JavaScript lets you use a variable as an object key with square brackets:

```ts
const fruit = 'apple';
const obj = { [fruit]: 3 }; // { apple: 3 }
```

**The gotcha:** even if TypeScript knows the variable is `'current_minute' | 'current_page'` (a
literal union), it widens `{ [key]: value }` to `{ [x: string]: number }` — losing the specific
shape. This is a known TypeScript limitation with computed property names from union types.

**Fix:** when the consuming function expects a specific object shape (like a discriminated union),
build the object in each branch of a ternary so TypeScript can see the exact shapes:

```ts
// TypeScript can infer this as { current_minute: number } | { current_page: number }
const payload = this.isAudio ? { current_minute: updateValue } : { current_page: updateValue };
```

---

## 4. `as const` — preserving literal types

```ts
const x = 'hello'; // type: string
const y = 'hello' as const; // type: 'hello'
```

`as const` tells TypeScript to keep the _literal_ type instead of widening to `string`. Useful when
you need TypeScript to distinguish between specific string values (e.g., for discriminated unions or
computed property keys).

It solved the _variable_ type but not the computed-property-name limitation (lesson 3), which is why
we went with the ternary-of-objects approach instead.

---

## 5. Don't solve problems that don't exist

Sonnet added a `lengthControl` — a whole input field + validators + branching in `save()` and
`saveDisabled` — to handle "what if someone starts an audiobook without knowing the total length."
The design says length is captured when you _start_ reading, not when you _log progress_. The entire
flow was invented complexity solving a nonexistent scenario.

**Before removing:** the lengthControl added a nested `@if` in the template, a conditional in
`saveDisabled`, extra enable/disable lines in the effect, and a whole `capturedLength` branch in
`save()` with different success handling (reload vs patch).

**After removing:** all of that disappears. If there's no length, the component quietly skips the
percentage calculation — same as pages without a page count.

**The lesson:** before accepting complexity, ask "does this scenario actually exist in my design?"
If not, the code is solving a ghost problem.

---

## 6. Form controls can exist unconditionally

The template uses `@if (isAudio)` to show either the minute input or the page input. But both
`minuteControl` and `pageControl` are always _declared_ as class fields.

**Why:** Angular's template compiler needs the property to exist on the class even if the `@if`
branch hiding it is never entered. If you conditionally created the control (made it `null` when
unused), you'd need non-null assertions in the template or it wouldn't compile.

**Clean approach:** declare both controls with their real values and validators unconditionally. The
`@if` handles visibility; the control doesn't need to know whether it's "active." This is the same
pattern as having a spreadsheet cell with a formula even if you're not looking at that sheet — it
doesn't hurt, and it's simpler than conditionally wiring it up.

---

## 7. Ternaries in field declarations vs if/else in a body

A ternary choosing initial value AND validators at declaration time:

```ts
// hard to read — two nested ternaries, one for value, one for validators
readonly minuteControl = new FormControl(
  this.isAudio ? formatHhmm(this.data.resume_from_minute) : null,
  this.isAudio ? [Validators.required, ...] : [],
);
```

Since the control can just always have its real values (lesson 6), the ternaries disappear entirely:

```ts
readonly minuteControl = new FormControl(
  formatHhmm(this.data.resume_from_minute),
  { validators: [Validators.required, hhmmFormatValidator(), ...] },
);
```

**When you can't eliminate the ternary:** if the two branches need genuinely different setup, move
the creation into the constructor body where you can use `if/else` — multi-line blocks are more
readable than nested ternaries in a field initializer.

---

## 8. Convention: snake_case data vs camelCase code

In a TypeScript frontend talking to a Python backend:

- **snake_case** for property names on data objects that cross the API boundary: `current_page`,
  `resume_from_minute`, `default_audio_minutes`
- **camelCase** for local TypeScript variables, methods, and class members: `updateValue`,
  `resumeFromProperty`, `isAudio`

The snake_case names match the Python/database column names. The camelCase names follow TypeScript
convention. Both are correct in their contexts.

---

## 9. Class fields initialize top-to-bottom

```ts
// ❌ This breaks — minuteControl doesn't exist yet
protected readonly updateValue = this.isAudio
  ? parseHhmm(this.minuteControl.value)  // error!
  : (this.pageControl.value as number);

// ...declared later:
protected readonly minuteControl = new FormControl(...);
protected readonly pageControl = new FormControl(...);
```

Class field initializers run in **declaration order** during construction. If field A references
field B, A must be declared _after_ B. This is different from methods, which can reference any field
regardless of where they appear in the class — methods aren't called until construction is already
finished.

This was one signal that `updateValue` didn't belong as a field (the other being that it needs live
form state — see lesson 2).

---

## 10. `Record<K, V>` — typing loose objects

```ts
Record<string, number>; // "an object where every key is a string and every value is a number"
```

Useful when a function just passes an object through (e.g., posting to an API) and the real
validation happens on the backend. More honest than a union of specific shapes when the frontend
doesn't need to enforce which keys are present.

The original `logProgress` signature was a union type:
`{ current_page: number } | { current_minute: number; audio_length_minutes?: number }`. That union
forced callers to build an exact object shape, which meant TypeScript's computed-property-name
limitation (lesson 3) blocked us from using `{ [key]: value }`. Changing to `Record<string, number>`
let the caller use a computed key naturally.

---

## 11. Why HH:MM needs custom validators

Angular's built-in `Validators.min(5)` works by comparing the control's **raw value** against the
threshold: `controlValue >= 5`. For a number input, the raw value is a number, so that comparison
works.

For the audio input, the raw value is the string `"01:30"`. Comparing `"01:30" >= 5` is nonsensical
— JavaScript would try to coerce the string to a number, get `NaN`, and the comparison would always
fail.

The custom `hhmmMinValidator` and `hhmmMaxValidator` solve this by calling `parseHhmm` on the raw
value first (turning `"01:30"` into `90`), _then_ doing the numeric comparison. Same logic as the
built-in validators, with a parsing step in front.

---

## 12. Effects should only touch what's relevant

**Before:**

```ts
effect(() => {
  if (this.mode() === 'idle') {
    this.pageControl.enable();
    this.minuteControl.enable();
  } else {
    this.pageControl.disable();
    this.minuteControl.disable();
  }
});
```

This enables/disables _both_ controls every time `mode` changes, even though only one is ever
visible. Not harmful, but wasteful and misleading — a reader wonders "why are we toggling a control
the user can't see?"

**After:**

```ts
effect(() => {
  if (this.mode() === 'idle') {
    this.isAudio ? this.minuteControl.enable() : this.pageControl.enable();
  } else {
    this.isAudio ? this.minuteControl.disable() : this.pageControl.disable();
  }
});
```

Only touches the control that matters for the current format. Same principle as the template `@if` —
scope your work to what's actually in play.
