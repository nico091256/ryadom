import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers.dart';
import '../../auth/presentation/auth_controller.dart';

/// Placeholder landing screen — the real nearby-shops home (next build step)
/// replaces this. Exists now so the auth flow has somewhere to land and can
/// be verified end to end on its own.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).value;
    return Scaffold(
      appBar: AppBar(title: Text(ref.t('common.appName'))),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('👋 ${user?.name ?? user?.phone ?? ''}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: () => ref.read(authControllerProvider.notifier).logout(),
              child: Text(ref.t('common.logout')),
            ),
          ],
        ),
      ),
    );
  }
}
