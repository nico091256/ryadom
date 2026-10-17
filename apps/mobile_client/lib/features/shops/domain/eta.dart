/// Honest delivery-time estimate for a shop at [distanceMeters]: the
/// shopkeeper packs the order (~8 min) and walks/rides it over (~150 m/min),
/// clamped to the 10–40 minute window we promise. Shown as "~N daq" so the
/// customer reads it as an estimate, never a guarantee.
int estimateEtaMinutes(double distanceMeters) {
  final minutes = 8 + distanceMeters / 150;
  return minutes.round().clamp(10, 40);
}
