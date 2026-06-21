export const logActivity = async (
  client,
  { actor, action, entityType, entityId, entityLabel, fromStatus, toStatus, note, metadata }
) => {
  await client.activityLog.create({
    data: {
      actorId: actor?.id ?? null,
      actorName: actor?.fullName || actor?.username || "Noma'lum",
      actorRole: actor?.role || null,
      action,
      entityType,
      entityId: entityId ?? null,
      entityLabel: entityLabel ?? null,
      fromStatus: fromStatus ?? null,
      toStatus: toStatus ?? null,
      note: note ?? null,
      metadata: metadata ?? undefined
    }
  });
};
