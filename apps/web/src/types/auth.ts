export type User = {
  id: string
  name: string
  email: string
  createdAt?: string
}

export type Organization = {
  id: string
  name: string
  slug: string
  createdAt?: string
}

export type AuthResponse = {
  accessToken: string
  user: User
  organization: Organization | null
  roles: string[]
}

