import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { AuthResponse } from '../../types/auth'

import { API_BASE_URL } from '../../services/api'

export const AuthPage: React.FC = () => {
  const { login } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')

  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register form state
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regOrgName, setRegOrgName] = useState('')
  const [regOrgSlug, setRegOrgSlug] = useState('')

  // UI status
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!loginEmail.trim() || !loginPassword) {
      setError('Please provide both email and password.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message || 'Authentication failed. Please verify your credentials.',
        )
      }

      const authData = data as AuthResponse
      login(authData.accessToken, authData.user, authData.organization, authData.roles || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect to the authentication service.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!regName.trim()) {
      setError('Please enter your full name.')
      return
    }
    if (!regEmail.trim()) {
      setError('Please enter a valid work email address.')
      return
    }
    if (regPassword.length < 8) {
      setError('Password must contain at least 8 characters.')
      return
    }
    if (!regOrgName.trim()) {
      setError('Please enter your company or organization name.')
      return
    }

    setLoading(true)

    try {
      const payload: Record<string, string> = {
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        organizationName: regOrgName.trim(),
      }

      if (regOrgSlug.trim()) {
        payload.organizationSlug = regOrgSlug.trim().toLowerCase()
      }

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message || 'Registration failed. Please check the provided information.',
        )
      }

      const authData = data as AuthResponse
      login(authData.accessToken, authData.user, authData.organization, authData.roles || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete organization registration.')
    } finally {
      setLoading(false)
    }
  }

  const fillDemoCredentials = () => {
    setMode('login')
    setLoginEmail('demo@fleetflow.io')
    setLoginPassword('FleetFlow2026!')
    setError(null)
  }

  return (
    <div className="flex min-h-screen bg-[#0c1427] text-slate-100">
      {/* Left panel / Hero decoration */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-slate-800/80 bg-gradient-to-br from-[#101c35] via-[#0d162b] to-[#070d1a]">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-2xl font-bold text-white shadow-lg shadow-blue-500/30">
              F
            </div>
            <div>
              <span className="text-xl font-bold tracking-wide text-white">FleetFlow</span>
              <p className="text-[10px] tracking-[2px] text-blue-400 font-semibold">ENTERPRISE SUPPLY CHAIN</p>
            </div>
          </div>

          <div className="mt-20 max-w-md">
            <span className="inline-block rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 border border-blue-500/20 mb-4">
              Real-Time Logistics Operations
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              High-concurrency inventory, fulfillment & dispatch.
            </h2>
            <p className="mt-4 text-sm text-slate-400 leading-relaxed">
              Designed for multi-warehouse routing, row-locked transactional stock allocation, Kafka-driven tracking
              events, and immutable financial reconciliation.
            </p>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="space-y-4 max-w-md border-t border-slate-800/80 pt-8">
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
              ✓
            </span>
            <span>Multi-tenant data isolation & warehouse role-based access control</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
              ✓
            </span>
            <span>Pessimistic row-locking prevents inventory overselling under race conditions</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/10 text-purple-400 font-bold border border-purple-500/20">
              ✓
            </span>
            <span>Event streaming via Redpanda with transactional outbox & Saga coordination</span>
          </div>
        </div>
      </div>

      {/* Right panel / Auth Form */}
      <div className="flex w-full lg:w-1/2 flex-col justify-center px-6 py-12 sm:px-12 md:px-16 lg:px-20">
        <div className="mx-auto w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white">
              F
            </div>
            <div>
              <span className="text-lg font-bold tracking-wide text-white">FleetFlow</span>
              <p className="text-[10px] tracking-[2px] text-blue-400 font-semibold">LOGISTICS PLATFORM</p>
            </div>
          </div>

          {/* Form Header */}
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-white tracking-tight">
              {mode === 'login' ? 'Sign in to your account' : 'Register your organization'}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {mode === 'login'
                ? 'Enter your operational credentials to access your warehouse dashboard.'
                : 'Set up an enterprise account and take ownership of your supply chain network.'}
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 rounded-xl bg-slate-900/90 p-1 border border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login')
                setError(null)
              }}
              className={`rounded-lg py-2 text-xs font-semibold transition ${
                mode === 'login'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register')
                setError(null)
              }}
              className={`rounded-lg py-2 text-xs font-semibold transition ${
                mode === 'register'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Register Organization
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-950/40 p-3.5 text-xs text-red-200">
              <span className="text-red-400 font-bold text-sm">⚠</span>
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="operator@fleetflow.io"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Password
                  </label>
                </div>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 py-3 text-xs font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {loading ? 'Authenticating...' : 'Sign In to Operations'}
              </button>

              {/* Quick Demo Helper */}
              <div className="mt-6 border-t border-slate-800/80 pt-4">
                <button
                  type="button"
                  onClick={fillDemoCredentials}
                  className="w-full rounded-lg border border-slate-700/80 bg-slate-800/40 py-2.5 px-3 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition flex items-center justify-center gap-2"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                  Fill Demo Operator (demo@fleetflow.io)
                </button>
              </div>
            </form>
          ) : (
            /* REGISTRATION FORM */
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Sarah Connor"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Work Email Address
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="sarah@apexlogistics.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password (min. 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Organization / Company Name
                </label>
                <input
                  type="text"
                  required
                  value={regOrgName}
                  onChange={(e) => setRegOrgName(e.target.value)}
                  placeholder="Apex Freight & Logistics"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Organization URL Slug <span className="text-slate-500 font-normal">(optional)</span>
                  </label>
                  {regOrgSlug && (
                    <span className="text-[10px] text-blue-400 font-mono">
                      {regOrgSlug.toLowerCase().replace(/[^a-z0-9-]/g, '')}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={regOrgSlug}
                  onChange={(e) => setRegOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="apex-freight"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 py-3 text-xs font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {loading ? 'Creating Organization...' : 'Create Account & Organization'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

