import 'dart:math' as math;
import 'package:flutter/material.dart';

import '../tokens.dart';

/// Lightweight, standalone particle confetti burst for celebration moments.
/// Automatically runs and fades out cleanly without external dependencies.
class ConfettiOverlay extends StatefulWidget {
  const ConfettiOverlay({super.key, this.duration = const Duration(seconds: 3)});

  final Duration duration;

  @override
  State<ConfettiOverlay> createState() => _ConfettiOverlayState();
}

class _ConfettiOverlayState extends State<ConfettiOverlay> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final List<_ConfettiParticle> _particles;

  static const List<Color> _palette = [
    AppColors.brand,
    AppColors.accent,
    Color(0xFF22C55E),
    Color(0xFFF59E0B),
    Color(0xFF3B82F6),
    Color(0xFFEC4899),
    Color(0xFF8B5CF6),
  ];

  @override
  void initState() {
    super.initState();
    final random = math.Random();
    _particles = List.generate(45, (i) {
      return _ConfettiParticle(
        x: random.nextDouble(),
        y: -0.1 - random.nextDouble() * 0.3,
        dx: (random.nextDouble() - 0.5) * 0.4,
        speed: 0.35 + random.nextDouble() * 0.45,
        rotation: random.nextDouble() * 2 * math.pi,
        rotationSpeed: (random.nextDouble() - 0.5) * 6,
        size: 7 + random.nextDouble() * 7,
        color: _palette[i % _palette.length],
        isCircle: random.nextBool(),
      );
    });

    _controller = AnimationController(vsync: this, duration: widget.duration)
      ..forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          final progress = _controller.value;
          final opacity = (1.0 - (progress - 0.65).clamp(0.0, 0.35) / 0.35).clamp(0.0, 1.0);

          return Opacity(
            opacity: opacity,
            child: CustomPaint(
              size: Size.infinite,
              painter: _ConfettiPainter(particles: _particles, progress: progress),
            ),
          );
        },
      ),
    );
  }
}

class _ConfettiParticle {
  _ConfettiParticle({
    required this.x,
    required this.y,
    required this.dx,
    required this.speed,
    required this.rotation,
    required this.rotationSpeed,
    required this.size,
    required this.color,
    required this.isCircle,
  });

  final double x;
  final double y;
  final double dx;
  final double speed;
  final double rotation;
  final double rotationSpeed;
  final double size;
  final Color color;
  final bool isCircle;
}

class _ConfettiPainter extends CustomPainter {
  _ConfettiPainter({required this.particles, required this.progress});

  final List<_ConfettiParticle> particles;
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;

    for (final p in particles) {
      final currentX = (p.x + p.dx * progress) * size.width;
      final currentY = (p.y + p.speed * progress * 1.2) * size.height;
      final currentRot = p.rotation + p.rotationSpeed * progress;

      if (currentY < -20 || currentY > size.height + 20) continue;

      canvas.save();
      canvas.translate(currentX, currentY);
      canvas.rotate(currentRot);

      paint.color = p.color;

      if (p.isCircle) {
        canvas.drawCircle(Offset.zero, p.size / 2, paint);
      } else {
        canvas.drawRect(
          Rect.fromCenter(center: Offset.zero, width: p.size, height: p.size * 0.6),
          paint,
        );
      }

      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _ConfettiPainter oldDelegate) => true;
}
