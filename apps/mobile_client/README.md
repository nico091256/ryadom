# mobile_client — Ryadom customer app (Flutter)

Customer-facing app: find nearby shops, order, and track delivery.

Standalone Flutter project (not part of the pnpm workspace). Shares business
logic (order status machine, money/locale formatting) with the backend via
a path dependency on `../../packages/shared_dart`.

## Run

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://<your-lan-ip>:4000/api/v1
```

Without `--dart-define`, dev defaults apply (Android emulator alias
`10.0.2.2`, `localhost` elsewhere). See `lib/core/config/env.dart`.

## Verify

```bash
flutter analyze
flutter test
flutter build web   # smoke test of the full app
```

## Layout

- `lib/app/` — theme, go_router config (auth-aware redirect), bottom-nav shell
- `lib/core/` — API client (dio + token refresh), secure storage, i18n, env
- `lib/features/<feature>/{data,domain,presentation}/` — auth, location,
  shops, cart, orders, profile
- `assets/i18n/{uz,ru,en}.json` — translations (uz is the fallback)
