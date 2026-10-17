import 'package:flutter/material.dart';

import '../tokens.dart';
import '../typography.dart';

/// Official Ryadom Brand Logo:
/// Clean geometric emblem (Home + Speed lightning) + "Ryadom" Manrope 800 wordmark.
class AppLogo extends StatelessWidget {
  const AppLogo({
    super.key,
    this.size = 36,
    this.showWordmark = true,
    this.wordmarkColor,
  });

  final double size;
  final bool showWordmark;
  final Color? wordmarkColor;

  @override
  Widget build(BuildContext context) {
    final emblem = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.brand,
        borderRadius: BorderRadius.circular(size * 0.32),
        boxShadow: AppShadows.brand,
      ),
      alignment: Alignment.center,
      child: CustomPaint(
        size: Size(size * 0.58, size * 0.58),
        painter: _RyadomEmblemPainter(),
      ),
    );

    if (!showWordmark) return emblem;

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        emblem,
        const SizedBox(width: 10),
        Text.rich(
          TextSpan(
            children: [
              TextSpan(
                text: 'Ryadom',
                style: AppText.sarlavhaM.copyWith(
                  fontSize: size * 0.65,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                  color: wordmarkColor ?? AppColors.textPrimary,
                ),
              ),
              const TextSpan(
                text: '.',
                style: TextStyle(
                  color: AppColors.accent,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Precise geometric brand emblem: roof silhouette + speed forward stroke
class _RyadomEmblemPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * 0.16
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final w = size.width;
    final h = size.height;

    // Roof arrow (pointing up/forward)
    final roofPath = Path()
      ..moveTo(w * 0.15, h * 0.52)
      ..lineTo(w * 0.5, h * 0.18)
      ..lineTo(w * 0.85, h * 0.52);

    canvas.drawPath(roofPath, paint);

    // Dynamic speed bolt center dot
    final fillPaint = Paint()
      ..color = AppColors.accent
      ..style = PaintingStyle.fill;

    canvas.drawCircle(Offset(w * 0.5, h * 0.66), w * 0.14, fillPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
