import { isAfter, isBefore, startOfDay } from "date-fns";

export type LeaseStatus = "active" | "expired" | "upcoming";

export function getLeaseStatus(leaseStart: string, leaseEnd: string): LeaseStatus {
  const today = startOfDay(new Date());
  const startDate = startOfDay(new Date(leaseStart));
  const endDate = startOfDay(new Date(leaseEnd));

  if (isAfter(today, endDate)) {
    return "expired";
  }
  
  if (isBefore(today, startDate)) {
    return "upcoming";
  }
  
  return "active";
}

export function getLeaseStatusBadgeVariant(status: LeaseStatus): "default" | "secondary" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "expired":
      return "destructive";
    case "upcoming":
      return "secondary";
  }
}
