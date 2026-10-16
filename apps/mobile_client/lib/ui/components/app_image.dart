import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/config/env.dart';
import '../tokens.dart';

/// Network image with a quiet placeholder, fade-in and a graceful fallback.
/// Server-relative paths (/uploads/x.jpg) are resolved against the API host.
/// `memCacheWidth` keeps decoded bitmaps small — important on web/low-end phones.
class AppImage extends StatelessWidget {
  const AppImage({
    super.key,
    required this.url,
    this.width,
    this.height,
    this.radius,
    this.fit = BoxFit.cover,
    this.fallbackIcon = LucideIcons.image,
    this.fallbackColor = AppColors.ink100,
    this.memCacheWidth,
  });

  final String? url;
  final double? width;
  final double? height;
  final BorderRadius? radius;
  final BoxFit fit;
  final IconData fallbackIcon;
  final Color fallbackColor;
  final int? memCacheWidth;

  @override
  Widget build(BuildContext context) {
    final r = radius ?? BorderRadius.circular(AppRadius.sm);
    final resolved = (url == null || url!.isEmpty) ? null : Env.resolveMediaUrl(url!);

    Widget child;
    if (resolved == null) {
      child = _Fallback(icon: fallbackIcon, color: fallbackColor);
    } else {
      child = CachedNetworkImage(
        imageUrl: resolved,
        width: width,
        height: height,
        fit: fit,
        memCacheWidth: memCacheWidth ?? (width != null ? (width! * 2.5).round() : null),
        fadeInDuration: AppDurations.slow,
        fadeOutDuration: AppDurations.fast,
        placeholder: (_, _) => const _Placeholder(),
        errorWidget: (_, _, _) => _Fallback(icon: fallbackIcon, color: fallbackColor),
      );
    }

    return ClipRRect(
      borderRadius: r,
      child: SizedBox(width: width, height: height, child: child),
    );
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.ink100, AppColors.ink50],
        ),
      ),
    );
  }
}

class _Fallback extends StatelessWidget {
  const _Fallback({required this.icon, required this.color});
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: color,
      alignment: Alignment.center,
      child: Icon(icon, color: AppColors.ink300, size: 24),
    );
  }
}

/// Circular avatar with initials fallback (profile, shop logos in lists).
class AppAvatar extends StatelessWidget {
  const AppAvatar({super.key, this.url, this.name, this.size = 44, this.background = AppColors.green100, this.foreground = AppColors.green700});

  final String? url;
  final String? name;
  final double size;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    final initials = (name ?? '').trim().isEmpty
        ? '•'
        : name!.trim().split(RegExp(r'\s+')).take(2).map((p) => p.characters.first.toUpperCase()).join();
    if (url == null || url!.isEmpty) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: background, shape: BoxShape.circle),
        alignment: Alignment.center,
        child: Text(
          initials,
          style: TextStyle(fontSize: size * 0.38, fontWeight: FontWeight.w800, color: foreground, fontFamily: 'Inter'),
        ),
      );
    }
    return AppImage(url: url, width: size, height: size, radius: BorderRadius.circular(size / 2), fallbackIcon: LucideIcons.store);
  }
}
