import type { ko } from './copy.ko';

/**
 * The Korean bundle with its string literals widened to `string`.
 *
 * `copy.ko.ts` is written `as const`, which is what gives `copy.today.title`
 * its exact type and makes a typo a compile error. That same `as const` would
 * make a translation unassignable (`'Today'` is not `'오늘'`), so every other
 * locale is typed against this widened mirror instead: same keys, same nesting,
 * same function signatures, any string value.
 */
export type CopyBundle = Widen<typeof ko>;

/** The type the app sees — the source bundle's shape, exactly as before. */
export type Copy = CopyBundle;

/**
 * Deep-widens literal types. Functions are passed through by signature (so
 * `balance` stays `(n: number) => string` and not a bag of properties).
 * `readonly` is preserved throughout — including collapsing readonly tuples
 * into readonly arrays — so consumers see exactly the immutability the
 * `as const` bundle gave them before.
 */
type Widen<T> = T extends (...args: infer A) => infer R
  ? (...args: A) => R
  : T extends string
    ? string
    : T extends number
      ? number
      : T extends boolean
        ? boolean
        : T extends readonly (infer U)[]
          ? readonly Widen<U>[]
          : { [K in keyof T]: Widen<T[K]> };
