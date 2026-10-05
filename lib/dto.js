// Whitelist mappers. Participant-facing responses MUST go through these.
// Never spread or return Prisma objects directly.

export function toMessageDto(m, myMembershipId) {
  return {
    id: m.id,
    clientMessageId: m.clientMessageId,
    senderAlias: m.sender.alias,
    isMine: m.senderMembershipId === myMembershipId,
    body: m.body,
    status: m.status, // recipients only ever receive DELIVERED rows
    createdAt: m.createdAt,
    deliveredAt: m.deliveredAt,
  };
}

export function toProjectCardDto({ membership, project, counterpartAlias, last, unreadCount }) {
  return {
    projectId: project.id,
    projectName: project.name,
    myAlias: membership.alias,
    counterpartAlias: counterpartAlias || null,
    lastMessagePreview: last ? last.body.slice(0, 120) : null,
    lastMessageAt: last ? last.deliveredAt || last.createdAt : null,
    unreadCount,
  };
}

export function toNotificationDto(n) {
  return { id: n.id, type: n.type, message: n.message, read: !!n.readAt, createdAt: n.createdAt };
}

// Admin-only shapes (real identities allowed).
export function toAdminUserDto(u) {
  return {
    id: u.id, email: u.email, realName: u.realName, phone: u.phone,
    role: u.role, isActive: u.isActive, createdAt: u.createdAt,
  };
}

export function toAdminMembershipDto(m) {
  return {
    id: m.id, projectId: m.projectId, role: m.role, alias: m.alias,
    status: m.status, createdAt: m.createdAt, revokedAt: m.revokedAt,
    user: m.user ? { id: m.user.id, realName: m.user.realName, email: m.user.email, phone: m.user.phone } : undefined,
  };
}
