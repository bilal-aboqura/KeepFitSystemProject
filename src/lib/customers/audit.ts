import "server-only";
export const customerAuditActions = {
  identityResolved: "identity.resolved",
  profileUpdated: "profile.updated",
  orderAssociated: "order.associated",
} as const;

// The corresponding database RPC writes these events in the same transaction.
export type CustomerAuditAction = typeof customerAuditActions[keyof typeof customerAuditActions];
