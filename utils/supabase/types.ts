export type UserData = {
  id: string
  username: string
  email: string
  gizmo_id?: string | null
  is_admin?: boolean
  created_at?: string
}

export type Session = {
  user: UserData | null
  error: Error | null
}

export type AuthError = {
  message: string
  status: number
}
