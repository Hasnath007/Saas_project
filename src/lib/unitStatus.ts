import { isAfter, isBefore, startOfDay, isSameMonth } from "date-fns";

export type UnitOccupancyStatus = "occupied" | "vacant" | "repairs";

export interface UnitLeaseInfo {
  current_tenant: string | null;
  current_lease_start: string | null;
  current_lease_end: string | null;
  incoming_tenant: string | null;
  incoming_lease_start: string | null;
  incoming_lease_end: string | null;
  status: string;
  hasActiveMaintenance?: boolean;
}

/**
 * Calculate the effective occupancy status of a unit based on lease dates
 * - If there's active maintenance, return "repairs"
 * - If current lease is active (start <= today <= end), return "occupied"
 * - If incoming lease has started (start <= today), promote incoming to current and return "occupied"
 * - Otherwise, return "vacant"
 */
export function getEffectiveUnitStatus(unit: UnitLeaseInfo): UnitOccupancyStatus {
  // If there's active maintenance, status is repairs
  if (unit.hasActiveMaintenance) {
    return "repairs";
  }

  const today = startOfDay(new Date());

  // Check if incoming tenant lease has started (should now be "current")
  if (unit.incoming_lease_start && unit.incoming_lease_end) {
    const incomingStart = startOfDay(new Date(unit.incoming_lease_start));
    const incomingEnd = startOfDay(new Date(unit.incoming_lease_end));
    
    // If incoming lease has started and not ended
    if (!isBefore(today, incomingStart) && !isAfter(today, incomingEnd)) {
      return "occupied";
    }
  }

  // Check if current tenant lease is active
  if (unit.current_lease_start && unit.current_lease_end) {
    const currentStart = startOfDay(new Date(unit.current_lease_start));
    const currentEnd = startOfDay(new Date(unit.current_lease_end));
    
    // If current lease is active (start <= today <= end)
    if (!isBefore(today, currentStart) && !isAfter(today, currentEnd)) {
      return "occupied";
    }
  }

  return "vacant";
}

/**
 * Check if a unit has an active (current) tenant
 */
export function hasActiveTenant(unit: UnitLeaseInfo): boolean {
  return getEffectiveUnitStatus(unit) === "occupied";
}

/**
 * Check if a tenant's lease is active for the current month (for revenue calculation)
 */
export function isLeaseActiveThisMonth(leaseStart: string | null, leaseEnd: string | null): boolean {
  if (!leaseStart || !leaseEnd) return false;
  
  const today = startOfDay(new Date());
  const startDate = startOfDay(new Date(leaseStart));
  const endDate = startOfDay(new Date(leaseEnd));
  
  // Lease is active if: start <= today <= end
  return !isBefore(today, startDate) && !isAfter(today, endDate);
}

/**
 * Check if an upcoming tenant's lease starts this month (for expected revenue)
 */
export function isUpcomingLeaseStartingThisMonth(leaseStart: string | null): boolean {
  if (!leaseStart) return false;
  
  const today = new Date();
  const startDate = new Date(leaseStart);
  
  // Check if the lease starts in the current month
  return isSameMonth(today, startDate) && isAfter(startOfDay(startDate), startOfDay(today));
}

/**
 * Get the effective rent for a unit considering both current and incoming tenants
 * Returns: { monthlyRevenue: rent from active tenants (excludes repairs), expectedRevenue: total potential including repairs }
 */
export function getUnitRevenue(unit: {
  required_rent: number | null;
  current_lease_start: string | null;
  current_lease_end: string | null;
  incoming_lease_start: string | null;
  incoming_lease_end: string | null;
  hasActiveMaintenance?: boolean;
}): { monthlyRevenue: number; expectedRevenue: number } {
  const rent = Number(unit.required_rent || 0);
  
  // Check if current lease is active
  const currentActive = isLeaseActiveThisMonth(unit.current_lease_start, unit.current_lease_end);
  
  // Check if incoming lease is active (has started)
  const incomingActive = isLeaseActiveThisMonth(unit.incoming_lease_start, unit.incoming_lease_end);
  
  // Check if incoming lease starts this month but hasn't started yet
  const incomingStartsThisMonth = isUpcomingLeaseStartingThisMonth(unit.incoming_lease_start);
  
  let monthlyRevenue = 0;
  let expectedRevenue = 0;
  
  // Monthly revenue comes from active leases, but EXCLUDES units in repairs
  if (currentActive || incomingActive) {
    // Only add to monthly revenue if NOT in repairs
    if (!unit.hasActiveMaintenance) {
      monthlyRevenue = rent;
    }
    // Expected revenue always includes occupied units (even in repairs)
    expectedRevenue = rent;
  }
  
  // If there's an upcoming tenant starting this month, add to expected
  if (!currentActive && !incomingActive && incomingStartsThisMonth) {
    expectedRevenue = rent;
  }
  
  return { monthlyRevenue, expectedRevenue };
}
