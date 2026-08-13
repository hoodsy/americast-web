/**
 * Radius is proportional to sqrt(capacity) so that *area* tracks capacity and
 * the picture matches the physical fleet. Solar Star at 585.9 MW lands at
 * 16 px; the smallest plants floor at just over a pixel so they stay visible
 * as specks without claiming ink they have not earned.
 *
 * Half the fleet holds under 3% of the capacity, so this is what keeps the
 * map from spending most of its ink on plants that do not matter.
 */
const MAX_CAPACITY_MW = 585.9;
const MAX_RADIUS_PX = 16;
const MIN_RADIUS_PX = 1.1;
const RADIUS_K = MAX_RADIUS_PX / Math.sqrt(MAX_CAPACITY_MW);

export function plantRadius(capacityMw: number): number {
  return Math.max(RADIUS_K * Math.sqrt(Math.max(capacityMw, 0)), MIN_RADIUS_PX);
}
