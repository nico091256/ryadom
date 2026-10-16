import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'tokens.dart';

/// go_router page with a fade + subtle slide-up — calmer than the stock
/// Material zoom and consistent across platforms (incl. web).
CustomTransitionPage<T> fadeSlidePage<T>({required LocalKey key, required Widget child}) {
  return CustomTransitionPage<T>(
    key: key,
    child: child,
    transitionDuration: AppDurations.page,
    reverseTransitionDuration: AppDurations.normal,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final curved = CurvedAnimation(parent: animation, curve: AppCurves.emphasized, reverseCurve: Curves.easeIn);
      return FadeTransition(
        opacity: curved,
        child: SlideTransition(
          position: Tween<Offset>(begin: const Offset(0, 0.04), end: Offset.zero).animate(curved),
          child: child,
        ),
      );
    },
  );
}

/// iOS-style horizontal push for drill-down screens (shop, cart, checkout).
CustomTransitionPage<T> slidePage<T>({required LocalKey key, required Widget child}) {
  return CustomTransitionPage<T>(
    key: key,
    child: child,
    transitionDuration: AppDurations.page,
    reverseTransitionDuration: AppDurations.page,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final curved = CurvedAnimation(parent: animation, curve: AppCurves.emphasized, reverseCurve: Curves.easeInCubic);
      final secondary = CurvedAnimation(parent: secondaryAnimation, curve: Curves.easeOut);
      return SlideTransition(
        position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero).animate(curved),
        child: SlideTransition(
          position: Tween<Offset>(begin: Offset.zero, end: const Offset(-0.25, 0)).animate(secondary),
          child: child,
        ),
      );
    },
  );
}
