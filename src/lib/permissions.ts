export type Role = 'owner' | 'admin' | 'agent'

const PERMISSIONS = {
  owner: ['*'],
  admin: [
    'manage_agents',
    'manage_settings',
    'manage_flows',
    'manage_campaigns',
    'manage_contacts',
    'manage_tags',
    'view_analytics',
    'use_desk',
    'use_team_chat',
  ],
  agent: ['use_desk', 'use_team_chat', 'view_own_analytics'],
} as const

export function hasPermission(role: Role, permission: string): boolean {
  const perms: readonly string[] = PERMISSIONS[role]
  return perms.includes('*') || perms.includes(permission)
}

export function canManageSettings(role: Role) {
  return hasPermission(role, 'manage_settings')
}

export function canManageAgents(role: Role) {
  return hasPermission(role, 'manage_agents')
}

export function canViewAnalytics(role: Role) {
  return (
    hasPermission(role, 'view_analytics') ||
    hasPermission(role, 'view_own_analytics')
  )
}
