# localshop_shared (Dart)

Dart counterpart of [`packages/shared`](../shared) (TypeScript). Dart can't
import the TS package directly, so this hand-ports what OpenAPI codegen
can't capture: the order status machine, cancellation-role rules, tiyin/UZS
formatting, localized-text fallback, Socket.IO event names and error codes.

**Keep this in sync by hand** whenever `packages/shared/src/{enums,constants,utils}.ts`
changes — nothing regenerates it automatically. The test file mirrors
`apps/backend/src/common/utils.spec.ts` line for line so a divergence is easy to
spot.

Used via a path dependency from `apps/mobile_client`:

```yaml
dependencies:
  localshop_shared:
    path: ../../packages/shared_dart
```

Run tests with `dart test` (not run in this environment — no Dart/Flutter
SDK was available when this package was written; verify before relying on it).
