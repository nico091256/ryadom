import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/presentation/auth_controller.dart';
import '../features/auth/presentation/name_screen.dart';
import '../features/auth/presentation/otp_screen.dart';
import '../features/auth/presentation/phone_screen.dart';
import '../features/auth/presentation/splash_screen.dart';
import '../features/auth/presentation/welcome_screen.dart';
import '../features/cart/presentation/cart_screen.dart';
import '../features/favorites/presentation/favorites_screen.dart';
import '../features/orders/presentation/checkout_screen.dart';
import '../features/orders/presentation/order_tracking_screen.dart';
import '../features/shops/presentation/shop_detail_screen.dart';
import '../ui/transitions.dart';
import 'main_shell_screen.dart';

class _RouterRefreshNotifier extends ChangeNotifier {
  _RouterRefreshNotifier(Ref ref) {
    ref.listen(authControllerProvider, (previous, next) {
      if (previous?.isLoading != next.isLoading || previous?.valueOrNull != next.valueOrNull || previous?.hasError != next.hasError) {
        notifyListeners();
      }
    });
    ref.listen(splashIntroDoneProvider, (_, _) => notifyListeners());
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final refreshNotifier = _RouterRefreshNotifier(ref);
  ref.onDispose(refreshNotifier.dispose);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refreshNotifier,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final path = state.matchedLocation;

      // Loading, or the profile could not be fetched (offline / server down):
      // stay on the splash, which offers a retry. Tokens are kept.
      if (auth.isLoading || (auth.hasError && !auth.hasValue)) {
        return path == '/splash' ? null : '/splash';
      }
      // Let the brand intro finish before leaving the splash.
      if (path == '/splash' && !ref.read(splashIntroDoneProvider).hasValue) return null;

      final user = auth.valueOrNull;
      final isAuthenticated = user != null;
      final hasName = (user?.name ?? '').trim().isNotEmpty;
      final inAuthFlow = path.startsWith('/welcome') || path.startsWith('/auth');

      if (!isAuthenticated && !inAuthFlow) return '/welcome';
      if (isAuthenticated && path == '/auth/name') return hasName ? '/home' : null;
      if (isAuthenticated && (inAuthFlow || path == '/splash')) {
        return hasName ? '/home' : '/auth/name';
      }
      if (!isAuthenticated && path == '/splash') return '/welcome';
      return null;
    },
    routes: [
      // Top-level destinations cross-fade; drill-downs slide in from the right.
      GoRoute(path: '/splash', pageBuilder: (context, state) => fadeSlidePage(key: state.pageKey, child: const SplashScreen())),
      GoRoute(path: '/welcome', pageBuilder: (context, state) => fadeSlidePage(key: state.pageKey, child: const WelcomeScreen())),
      GoRoute(path: '/auth/phone', pageBuilder: (context, state) => slidePage(key: state.pageKey, child: const PhoneScreen())),
      GoRoute(
        path: '/auth/otp',
        pageBuilder: (context, state) =>
            slidePage(key: state.pageKey, child: OtpScreen(phone: state.uri.queryParameters['phone'] ?? '')),
      ),
      GoRoute(path: '/auth/name', pageBuilder: (context, state) => slidePage(key: state.pageKey, child: const NameScreen())),
      GoRoute(path: '/home', pageBuilder: (context, state) => fadeSlidePage(key: state.pageKey, child: const MainShellScreen())),
      GoRoute(
        path: '/shop/:id',
        pageBuilder: (context, state) =>
            slidePage(key: state.pageKey, child: ShopDetailScreen(shopId: state.pathParameters['id']!)),
      ),
      GoRoute(path: '/cart', pageBuilder: (context, state) => slidePage(key: state.pageKey, child: const CartScreen())),
      GoRoute(path: '/favorites', pageBuilder: (context, state) => slidePage(key: state.pageKey, child: const FavoritesScreen())),
      GoRoute(path: '/checkout', pageBuilder: (context, state) => slidePage(key: state.pageKey, child: const CheckoutScreen())),
      GoRoute(
        path: '/order/:id',
        pageBuilder: (context, state) =>
            slidePage(key: state.pageKey, child: OrderTrackingScreen(orderId: state.pathParameters['id']!)),
      ),
    ],
  );
});
