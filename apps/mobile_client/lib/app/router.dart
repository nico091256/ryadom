import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/presentation/auth_controller.dart';
import '../features/auth/presentation/name_screen.dart';
import '../features/auth/presentation/otp_screen.dart';
import '../features/auth/presentation/phone_screen.dart';
import '../features/auth/presentation/splash_screen.dart';
import '../features/auth/presentation/welcome_screen.dart';
import '../features/shops/presentation/home_screen.dart';

class _RouterRefreshNotifier extends ChangeNotifier {
  _RouterRefreshNotifier(Ref ref) {
    ref.listen(authControllerProvider, (previous, next) {
      if (previous?.isLoading != next.isLoading || previous?.value != next.value) {
        notifyListeners();
      }
    });
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

      if (auth.isLoading) {
        return path == '/splash' ? null : '/splash';
      }

      final isAuthenticated = auth.value != null;
      final inAuthFlow = path.startsWith('/welcome') || path.startsWith('/auth');

      if (!isAuthenticated && !inAuthFlow) return '/welcome';
      if (isAuthenticated && (inAuthFlow || path == '/splash')) return '/home';
      if (!isAuthenticated && path == '/splash') return '/welcome';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (context, state) => const SplashScreen()),
      GoRoute(path: '/welcome', builder: (context, state) => const WelcomeScreen()),
      GoRoute(path: '/auth/phone', builder: (context, state) => const PhoneScreen()),
      GoRoute(
        path: '/auth/otp',
        builder: (context, state) => OtpScreen(phone: state.uri.queryParameters['phone'] ?? ''),
      ),
      GoRoute(path: '/auth/name', builder: (context, state) => const NameScreen()),
      GoRoute(path: '/home', builder: (context, state) => const HomeScreen()),
    ],
  );
});
