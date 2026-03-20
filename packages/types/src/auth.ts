// Auth & Roles — Single account, multiple roles

export type UserRole = 'owner' | 'manager' | 'trainer' | 'front_desk' | 'member'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  phone: string | null
  avatar_url: string | null
  roles: UserRole[]
  studio_id: string
  exclude_from_analytics: boolean
  created_at: string
  updated_at: string
}

export interface AuthSession {
  user: UserProfile
  active_role: UserRole // Currently active role context
  studio_id: string
}
