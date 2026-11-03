import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User, Organization } from '../types/auth'
import { apiClient, getStoredToken, setStoredToken, setUnauthorizedHandler } from '../services/api'

interface AuthContextType {
  token: string | null
  user: User | null
  organization: Organization | null
  roles: string[]
  isAuthenticated: boolean
  isLoading: boolean
  login: (token: string, user: User, organization: Organization | null, roles: string[]) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [roles, setRoles] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    setStoredToken(null)
    setToken(null)
    setUser(null)
    setOrganization(null)
    setRoles([])
  }, [])

  // Hook global unauthorized handler
  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  // Verify and hydrate existing token on app mount
  useEffect(() => {
    const hydrateSession = async () => {
      const storedToken = getStoredToken()
      if (!storedToken) {
        setIsLoading(false)
        return
      }

      try {
        const data = await apiClient.auth.getMe()
        setToken(storedToken)
        setUser({
          id: data.id,
          name: data.name,
          email: data.email,
          createdAt: data.createdAt,
        })

        const activeMembership = data.memberships?.[0]
        if (activeMembership) {
          setOrganization(activeMembership.organization)
          setRoles(activeMembership.roles?.map((r: any) => r.role?.name).filter(Boolean) || [])
        }
      } catch {
        logout()
      } finally {
        setIsLoading(false)
      }
    }

    hydrateSession()
  }, [logout])

  const login = useCallback(
    (newToken: string, newUser: User, newOrg: Organization | null, newRoles: string[]) => {
      setStoredToken(newToken)
      setToken(newToken)
      setUser(newUser)
      setOrganization(newOrg)
      setRoles(newRoles)
    },
    [],
  )

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        organization,
        roles,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

