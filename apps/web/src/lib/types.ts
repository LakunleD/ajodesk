// Response shapes of the AjoDesk REST API (docs/API.md). Amounts are integer kobo.

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface Collector {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  collector: Collector;
}

export interface Contributor {
  id: string;
  fullName: string;
  phone: string | null;
  status: string;
  createdAt: string;
}

export interface ContributorDetail extends Contributor {
  enrollments: {
    id: string;
    planId: string;
    planName: string;
    dailyAmountMinor: number;
    currency: string;
    startOn: string;
    endOn: string;
    status: string;
  }[];
}

export interface Plan {
  id: string;
  name: string;
  dailyAmountMinor: number;
  currency: string;
  frequency: string;
  startOn: string;
  endOn: string;
  totalDays: number;
  status: string;
  createdAt: string;
}

export interface Enrollment {
  id: string;
  status: string;
  startOn: string;
  endOn: string;
  totalDays: number;
  contributor: { id: string; fullName: string; phone: string | null };
  plan: { id: string; name: string; dailyAmountMinor: number; currency: string; status: string };
  createdAt: string;
}

export interface EnrollmentSummary {
  enrollmentId: string;
  currency: "NGN";
  dailyAmountMinor: number;
  asOf: string;
  startOn: string;
  endOn: string;
  eligibleDaysCount: number;
  dueDaysCount: number;
  paidDaysCount: number;
  paidDates: string[];
  recordedTotalMinor: number;
  dueMinor: number;
  paidTowardDueMinor: number;
  outstandingDueMinor: number;
  prepaidMinor: number;
  unpaidDatesCount: number;
  unpaidDates: string[];
  upcomingUnpaidDatesCount: number;
  verificationStatus: "COLLECTOR_ATTESTED";
  contributorName: string;
  planName: string;
}

export interface Contribution {
  id: string;
  enrollmentId: string;
  amountMinor: number;
  currency: string;
  paymentMethod: string;
  verificationStatus: string;
  status: string;
  collectedOn: string;
  scheduledDates: string[];
  recordedBy: { type: string; id: string };
  createdAt: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: Record<string, unknown>;
  };
}

export interface PlanSummary {
  planId: string;
  currency: "NGN";
  dailyAmountMinor: number;
  asOf: string;
  enrollmentsCount: number;
  activeEnrollmentsCount: number;
  recordedTotalMinor: number;
  dueMinor: number;
  paidTowardDueMinor: number;
  outstandingDueMinor: number;
  prepaidMinor: number;
  enrollmentsWithMissedDaysCount: number;
  missedDaysCount: number;
  verificationStatus: "COLLECTOR_ATTESTED";
}

export interface PlanMember {
  enrollmentId: string;
  status: string;
  startOn: string;
  endOn: string;
  contributor: { id: string; fullName: string; phone: string | null };
  summary: {
    asOf: string;
    recordedTotalMinor: number;
    dueMinor: number;
    outstandingDueMinor: number;
    prepaidMinor: number;
    paidDaysCount: number;
    eligibleDaysCount: number;
    unpaidDatesCount: number;
  };
}

export interface PlanContribution extends Contribution {
  contributor: { id: string; fullName: string };
}
