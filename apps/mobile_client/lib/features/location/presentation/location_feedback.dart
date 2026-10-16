import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../ui/ui.dart';
import 'address_controller.dart';

/// i18n key for a [LocationFailureReason] — mirrors the RN app's messages.
String locationErrorKey(LocationFailureReason reason) => switch (reason) {
      LocationFailureReason.permissionDenied || LocationFailureReason.permissionDeniedForever => 'home.locationPermissionDenied',
      LocationFailureReason.serviceDisabled => 'home.locationServiceDisabled',
      LocationFailureReason.unknown => 'home.locationUnknownError',
    };

/// Surfaces a [LocationException] as a top toast (SnackBars collide with the
/// bottom bars and sheets).
void showLocationError(BuildContext context, WidgetRef ref, LocationException e) {
  showAppToast(context, ref.t(locationErrorKey(e.reason)), tone: ToastTone.error);
}
