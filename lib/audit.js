// Always call with the transaction client so the audit row commits with the change.
export function audit(tx, actorId, action, entityType, entityId, metadata = undefined) {
  return tx.auditEvent.create({
    data: { actorId, action, entityType, entityId: String(entityId), metadata },
  });
}
