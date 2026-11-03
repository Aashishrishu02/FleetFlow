import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { useAuth } from './context/AuthContext'
import { AuthPage } from './components/auth/AuthPage'
import { WarehouseManager } from './components/warehouses/WarehouseManager'
import { ProductManager } from './components/products/ProductManager'
import { OperationsOverview } from './components/dashboard/OperationsOverview'
import { RouteFallback } from './components/common/RouteFallback'
import { apiClient } from './services/api'
import type { Warehouse, StorageLocation } from './types/warehouse'
import type { Product } from './types/product'

interface NavItem {
  id: string
  label: string
  icon: string
}

interface NavSection {
  section: string
  items: NavItem[]
}

const IMPLEMENTED_NAVIGATION: NavSection[] = [
  {
    section: 'OVERVIEW',
    items: [
      {
        id: 'Operations Overview',
        label: 'Operations Overview',
        icon: '◈',
      },
    ],
  },
  {
    section: 'OPERATIONS',
    items: [
      {
        id: 'Inventory',
        label: 'Inventory',
        icon: '▦',
      },
      {
        id: 'Warehouses',
        label: 'Warehouses',
        icon: '⌂',
      },
      {
        id: 'Products',
        label: 'Products',
        icon: '▤',
      },
    ],
  },
]

export const IMPLEMENTED_MODULE_IDS = new Set([
  'Operations Overview',
  'Inventory',
  'Warehouses',
  'Products',
])

export function isImplementedModule(moduleName: string): boolean {
  return IMPLEMENTED_MODULE_IDS.has(moduleName)
}

type InventorySummary = {
  totalRecords: number
  availableQty: number
  reservedQty: number
  damagedQty: number
  inTransitQty: number
}

type InventoryBalance = {
  id: string
  availableQty: number
  reservedQty: number
  damagedQty: number
  inTransitQty: number
  product: {
    name: string
    sku: string
    unit: string
  }
  warehouse: {
    name: string
    code: string
  }
  location: {
    name: string
    code: string
  }
}

type InventoryMovement = {
  id: string
  movementType: string
  quantity: number
  referenceType: string | null
  referenceId: string | null
  notes: string | null
  createdAt: string
  product: {
    name: string
    sku: string
  }
  warehouse: {
    name: string
    code: string
  }
  location: {
    name: string
    code: string
  }
}

function hasPermissionForModule(moduleName: string, userRoles: string[]): boolean {
  if (!IMPLEMENTED_MODULE_IDS.has(moduleName)) return false
  if (userRoles.includes('Organization Owner')) return true

  switch (moduleName) {
    case 'Operations Overview':
    case 'Inventory':
      return userRoles.some((r) =>
        [
          'Operations Manager',
          'Warehouse Manager',
          'Warehouse Operator',
          'Auditor',
          'Finance Manager',
        ].includes(r),
      )
    case 'Warehouses':
    case 'Products':
      return userRoles.some((r) =>
        [
          'Operations Manager',
          'Warehouse Manager',
          'Warehouse Operator',
          'Auditor',
        ].includes(r),
      )
    default:
      return false
  }
}

function App() {
  const { user, organization, roles, isAuthenticated, isLoading, logout } = useAuth()

  const [activePage, setActivePage] = useState('Operations Overview')
  const [search, setSearch] = useState('')

  const [summary, setSummary] = useState<InventorySummary | null>(null)
  const [balances, setBalances] = useState<InventoryBalance[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Modal dynamic entity dependencies
  const [modalProducts, setModalProducts] = useState<Product[]>([])
  const [modalWarehouses, setModalWarehouses] = useState<Warehouse[]>([])
  const [modalLocations, setModalLocations] = useState<StorageLocation[]>([])
  const [modalLoading, setModalLoading] = useState(false)

  // Forms
  const [showReceiveForm, setShowReceiveForm] = useState(false)
  const [receiveLoading, setReceiveLoading] = useState(false)
  const [receiveForm, setReceiveForm] = useState({
    warehouseId: '',
    locationId: '',
    productId: '',
    quantity: 1,
    notes: '',
  })

  const [showReserveForm, setShowReserveForm] = useState(false)
  const [reserveLoading, setReserveLoading] = useState(false)
  const [reserveForm, setReserveForm] = useState({
    warehouseId: '',
    locationId: '',
    productId: '',
    referenceId: '',
    quantity: 1,
    notes: '',
  })

  const [showReleaseForm, setShowReleaseForm] = useState(false)
  const [releaseLoading, setReleaseLoading] = useState(false)
  const [releaseForm, setReleaseForm] = useState({
    warehouseId: '',
    locationId: '',
    productId: '',
    reservationId: '',
    notes: '',
  })

  // Role-based permissions
  const canWriteInventory = roles.some((role) =>
    [
      'Organization Owner',
      'Operations Manager',
      'Warehouse Manager',
      'Warehouse Operator',
    ].includes(role),
  )

  // Fetch real inventory data from live backend
  const fetchInventory = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [summaryData, balancesData, movementsData] = await Promise.all([
        apiClient.inventory.getSummary(),
        apiClient.inventory.getBalances(),
        apiClient.inventory.getMovements(),
      ])

      setSummary(summaryData)
      setBalances(balancesData)
      setMovements(movementsData)
    } catch (err: any) {
      setError(err.message || 'Unable to connect to live Inventory API.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load modal entities dynamically from live APIs
  const loadModalDependencies = useCallback(async () => {
    setModalLoading(true)
    try {
      const [prods, whs] = await Promise.all([
        apiClient.products.findAll({ isActive: true }),
        apiClient.warehouses.findAll({ isActive: true }),
      ])

      setModalProducts(prods)
      setModalWarehouses(whs)

      const initialWh = whs[0]?.id || ''
      let locs: StorageLocation[] = []
      if (initialWh) {
        locs = await apiClient.warehouses.findAllLocations(initialWh)
      }
      setModalLocations(locs)

      return {
        firstProductId: prods[0]?.id || '',
        firstWarehouseId: initialWh,
        firstLocationId: locs[0]?.id || '',
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load active warehouses or products')
      return null
    } finally {
      setModalLoading(false)
    }
  }, [])

  // When warehouse selection changes in any modal, update storage locations dynamically
  const handleModalWarehouseChange = async (
    warehouseId: string,
    setTargetForm: (updater: (prev: any) => any) => void,
  ) => {
    setTargetForm((prev) => ({ ...prev, warehouseId, locationId: '' }))
    try {
      const locs = await apiClient.warehouses.findAllLocations(warehouseId)
      setModalLocations(locs)
      if (locs.length > 0) {
        setTargetForm((prev) => ({ ...prev, locationId: locs[0].id }))
      }
    } catch {
      setModalLocations([])
    }
  }

  // Open Receive Stock Modal
  const openReceiveModal = async () => {
    setError('')
    setSuccess('')
    setShowReceiveForm(true)
    const defaults = await loadModalDependencies()
    if (defaults) {
      setReceiveForm({
        warehouseId: defaults.firstWarehouseId,
        locationId: defaults.firstLocationId,
        productId: defaults.firstProductId,
        quantity: 1,
        notes: '',
      })
    }
  }

  // Open Reserve Stock Modal
  const openReserveModal = async () => {
    setError('')
    setSuccess('')
    setShowReserveForm(true)
    const defaults = await loadModalDependencies()
    if (defaults) {
      setReserveForm({
        warehouseId: defaults.firstWarehouseId,
        locationId: defaults.firstLocationId,
        productId: defaults.firstProductId,
        referenceId: '',
        quantity: 1,
        notes: '',
      })
    }
  }

  // Open Release Stock Modal
  const openReleaseModal = async () => {
    setError('')
    setSuccess('')
    setShowReleaseForm(true)
    const defaults = await loadModalDependencies()
    if (defaults) {
      setReleaseForm({
        warehouseId: defaults.firstWarehouseId,
        locationId: defaults.firstLocationId,
        productId: defaults.firstProductId,
        reservationId: '',
        notes: '',
      })
    }
  }

  // Receive stock API handler
  const handleReceiveStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!receiveForm.productId || !receiveForm.warehouseId || !receiveForm.locationId) {
      setError('Please select a valid product, warehouse, and storage location.')
      return
    }

    if (!Number.isInteger(receiveForm.quantity) || receiveForm.quantity <= 0) {
      setError('Please enter a valid positive whole-number quantity.')
      return
    }

    if (!receiveForm.notes.trim()) {
      setError('Please enter stock receiving notes.')
      return
    }

    setReceiveLoading(true)
    setError('')
    setSuccess('')

    try {
      const data = await apiClient.inventory.receiveStock({
        warehouseId: receiveForm.warehouseId,
        locationId: receiveForm.locationId,
        productId: receiveForm.productId,
        quantity: receiveForm.quantity,
        idempotencyKey: `receive-${crypto.randomUUID()}`,
        notes: receiveForm.notes.trim(),
      })

      setShowReceiveForm(false)
      setSuccess(`Successfully received ${data.quantity ?? receiveForm.quantity} units into inventory.`)
      await fetchInventory()
    } catch (err: any) {
      setError(err.message || 'Something went wrong while receiving stock.')
    } finally {
      setReceiveLoading(false)
    }
  }

  // Reserve stock API handler
  const handleReserveStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!reserveForm.productId || !reserveForm.warehouseId || !reserveForm.locationId) {
      setError('Please select a valid product, warehouse, and storage location.')
      return
    }

    if (!Number.isInteger(reserveForm.quantity) || reserveForm.quantity <= 0) {
      setError('Please enter a valid positive whole-number quantity.')
      return
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reserveForm.referenceId.trim())) {
      setError('Please enter a valid Order Reference UUID.')
      return
    }

    if (!reserveForm.notes.trim()) {
      setError('Please enter reservation notes.')
      return
    }

    setReserveLoading(true)
    setError('')
    setSuccess('')

    try {
      await apiClient.inventory.reserveStock({
        warehouseId: reserveForm.warehouseId,
        locationId: reserveForm.locationId,
        productId: reserveForm.productId,
        referenceType: 'ORDER',
        referenceId: reserveForm.referenceId.trim(),
        quantity: reserveForm.quantity,
        idempotencyKey: `reserve-${crypto.randomUUID()}`,
        notes: reserveForm.notes.trim(),
      })

      setShowReserveForm(false)
      setSuccess(`Successfully reserved ${reserveForm.quantity} units for Order Reference ${reserveForm.referenceId}.`)
      await fetchInventory()
    } catch (err: any) {
      setError(err.message || 'Something went wrong while reserving stock.')
    } finally {
      setReserveLoading(false)
    }
  }

  // Release stock API handler
  const handleReleaseStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!releaseForm.productId || !releaseForm.warehouseId || !releaseForm.locationId) {
      setError('Please select a valid product, warehouse, and storage location.')
      return
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(releaseForm.reservationId.trim())) {
      setError('Please enter a valid Reservation UUID.')
      return
    }

    if (!releaseForm.notes.trim()) {
      setError('Please enter stock release notes.')
      return
    }

    setReleaseLoading(true)
    setError('')
    setSuccess('')

    try {
      await apiClient.inventory.releaseStock({
        warehouseId: releaseForm.warehouseId,
        locationId: releaseForm.locationId,
        productId: releaseForm.productId,
        reservationId: releaseForm.reservationId.trim(),
        idempotencyKey: `release-${crypto.randomUUID()}`,
        notes: releaseForm.notes.trim(),
      })

      setShowReleaseForm(false)
      setSuccess('Successfully released reservation back to available inventory.')
      await fetchInventory()
    } catch (err: any) {
      setError(err.message || 'Something went wrong while releasing reservation.')
    } finally {
      setReleaseLoading(false)
    }
  }

  // Load inventory whenever Inventory page opens
  useEffect(() => {
    if (activePage === 'Inventory') {
      void fetchInventory()
    }
  }, [activePage, fetchInventory])

  // Search inventory balances
  const filteredBalances = balances.filter((item) => {
    const value = search.toLowerCase()
    return (
      item.product.name.toLowerCase().includes(value) ||
      item.product.sku.toLowerCase().includes(value) ||
      item.warehouse.name.toLowerCase().includes(value)
    )
  })

  const isInventory = activePage === 'Inventory'
  const isWarehouses = activePage === 'Warehouses'
  const isProducts = activePage === 'Products'
  const isOverview = activePage === 'Operations Overview'

  const visibleNavigation = IMPLEMENTED_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasPermissionForModule(item.id, roles)),
  })).filter((group) => group.items.length > 0)

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#101c35] text-white">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent align-[-0.125em]" />
          <p className="mt-4 text-xs font-semibold tracking-wider text-slate-300">
            CONNECTING TO FLEETFLOW CLUSTER...
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AuthPage />
  }

  return (
    <div className="flex min-h-screen bg-[#f5f7fb] text-slate-800">
      {/* Sidebar */}
      <aside className="hidden w-[250px] shrink-0 flex-col bg-[#101c35] text-white lg:flex">
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-xl font-bold">
            F
          </div>

          <div>
            <h1 className="text-lg font-bold tracking-wide">FleetFlow</h1>
            <p className="text-[10px] tracking-[1.5px] text-blue-400 font-semibold truncate max-w-[150px]">
              {organization?.name?.toUpperCase() || 'LOGISTICS PLATFORM'}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          {visibleNavigation.map((group) => (
            <div key={group.section} className="mb-6">
              <p className="mb-2 px-3 text-[10px] font-semibold tracking-[1.4px] text-slate-500">
                {group.section}
              </p>

              {group.items.map((item) => {
                const isActive = activePage === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActivePage(item.id)
                      setSearch('')
                      setError('')
                      setSuccess('')
                    }}
                    className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[13px] transition ${
                      isActive
                        ? 'bg-blue-600 font-semibold text-white shadow-lg shadow-blue-950/30'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className="w-4 text-center text-sm">
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 px-5 py-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="truncate font-semibold uppercase tracking-wider text-[11px] text-blue-400">
              {roles[0] || 'Active Operator'}
            </span>
          </div>

          <p className="mt-1.5 text-[11px] font-medium text-slate-300 truncate">
            {user?.name || user?.email}
          </p>
          <p className="text-[10px] text-slate-400 truncate">
            {user?.email}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-blue-400 truncate">
            {organization?.name}
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="min-w-0 flex-1">
        {/* Header */}
        <header className="sticky top-0 z-10 flex min-h-[76px] flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-3 md:px-8">
          <div className="flex min-w-[200px] flex-1 items-center gap-3">
            <div className="relative w-full max-w-[430px]">
              <span className="absolute left-3 top-2.5 text-slate-400">⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search catalog, SKU, warehouses..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 sm:block">
              {organization?.name || 'Production Cluster'}
            </span>

            <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>

              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-slate-800">{user?.name || 'Operator'}</p>
                  {roles[0] && (
                    <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                      {roles[0]}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 truncate max-w-[150px]">
                  {user?.email}
                </p>
              </div>

              <button
                onClick={logout}
                title="Sign out of current session"
                className="ml-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1600px] p-5 md:p-8">
          {/* Page Heading */}
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-medium text-slate-400">
                FleetFlow / {isInventory ? 'Operations / Inventory' : isWarehouses ? 'Operations / Warehouses' : isProducts ? 'Operations / Products' : isOverview ? 'Overview / Dashboard' : `System / ${activePage}`}
              </p>

              <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                {activePage}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                {isInventory
                  ? 'Monitor stock levels, warehouse balances and live inventory movements.'
                  : isWarehouses
                    ? 'Manage storage facilities, distribution hubs and internal bay locations.'
                    : isProducts
                      ? 'Manage global product catalog, SKU definitions, units and stock availability.'
                      : isOverview
                        ? 'High-concurrency logistics and warehouse operational metrics.'
                        : 'Module not implemented or unavailable in this deployment.'}
              </p>
            </div>

            {isInventory ? (
              <div className="flex flex-wrap items-center gap-2">
                {canWriteInventory ? (
                  <>
                    <button
                      onClick={openReceiveModal}
                      className="rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition"
                    >
                      + Receive Stock
                    </button>

                    <button
                      onClick={openReserveModal}
                      className="rounded-lg border border-indigo-200 bg-white px-4 py-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition"
                    >
                      + Reserve Stock
                    </button>

                    <button
                      onClick={openReleaseModal}
                      className="rounded-lg border border-purple-200 bg-white px-4 py-2.5 text-xs font-semibold text-purple-700 hover:bg-purple-50 transition"
                    >
                      + Release Stock
                    </button>
                  </>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Read-Only Access ({roles[0] || 'Auditor'})
                  </span>
                )}

                <button
                  onClick={() => void fetchInventory()}
                  disabled={loading}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {loading ? 'Refreshing...' : '↻ Refresh'}
                </button>
              </div>
            ) : null}
          </div>

          {/* Success Notification */}
          {success && isInventory && (
            <div className="mb-5 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <span>✓ {success}</span>
              <button
                onClick={() => setSuccess('')}
                className="font-bold text-emerald-900"
                aria-label="Dismiss success message"
              >
                ✕
              </button>
            </div>
          )}

          {/* Error Notification */}
          {error && isInventory && (
            <div className="mb-5 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <span>⚠ {error}</span>
              <button
                onClick={() => setError('')}
                className="font-bold text-red-900"
                aria-label="Dismiss error message"
              >
                ✕
              </button>
            </div>
          )}

          {/* DYNAMIC PAGE ROUTING (Strictly Live Endpoints, Zero Mock Data) */}
          {isOverview ? (
            hasPermissionForModule('Operations Overview', roles) ? (
              <OperationsOverview onNavigate={(page) => setActivePage(page)} />
            ) : (
              <RouteFallback
                type="ACCESS_DENIED"
                moduleName="Operations Overview"
                userRole={roles[0]}
                onReturnHome={() => setActivePage('Inventory')}
              />
            )
          ) : isInventory ? (
            hasPermissionForModule('Inventory', roles) ? (
              <>
              {/* Inventory Summary Cards */}
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: 'Available Stock',
                    value: summary?.availableQty,
                    icon: '▦',
                  },
                  {
                    label: 'Reserved Stock',
                    value: summary?.reservedQty,
                    icon: '▣',
                  },
                  {
                    label: 'Damaged Stock',
                    value: summary?.damagedQty,
                    icon: '⚠',
                  },
                  {
                    label: 'In Transit',
                    value: summary?.inTransitQty,
                    icon: '⇢',
                  },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                        {metric.label}
                      </p>
                      <span className="text-lg">{metric.icon}</span>
                    </div>

                    <p className="mt-4 text-3xl font-bold text-slate-900">
                      {loading && !summary ? '...' : (metric.value ?? 0).toLocaleString()}
                    </p>

                    <p className="mt-2 text-[11px] text-slate-400">
                      Units in PostgreSQL Ledger
                    </p>
                  </div>
                ))}
              </div>

              {/* Inventory Balances Table */}
              <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      Live Inventory Balances
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Real-time stock availability mapped by product SKU, warehouse, and bay
                    </p>
                  </div>

                  <span className="rounded-md bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700">
                    {balances.length} SKU Balance Record{balances.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left text-sm">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-5 py-4">Product</th>
                        <th className="px-5 py-4">SKU</th>
                        <th className="px-5 py-4">Warehouse</th>
                        <th className="px-5 py-4">Storage Bay</th>
                        <th className="px-5 py-4">Available</th>
                        <th className="px-5 py-4">Reserved</th>
                        <th className="px-5 py-4">Damaged</th>
                        <th className="px-5 py-4">In Transit</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredBalances.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-5 py-4 font-semibold text-slate-800">
                            {item.product.name}
                          </td>

                          <td className="px-5 py-4">
                            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                              {item.product.sku}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {item.warehouse.name}
                            <p className="text-[10px] font-mono text-slate-400">
                              {item.warehouse.code}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {item.location.name}
                            <p className="text-[10px] font-mono text-slate-400">
                              {item.location.code}
                            </p>
                          </td>

                          <td className="px-5 py-4 font-bold text-emerald-700">
                            {item.availableQty}
                          </td>

                          <td className="px-5 py-4 font-semibold text-blue-700">
                            {item.reservedQty}
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {item.damagedQty}
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {item.inTransitQty}
                          </td>
                        </tr>
                      ))}

                      {!loading && filteredBalances.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-5 py-10 text-center text-sm text-slate-400"
                          >
                            {balances.length === 0
                              ? 'No inventory balance records found in database.'
                              : 'No matching products or warehouses found.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Stock Movement History Table */}
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5">
                  <h3 className="font-bold text-slate-900">
                    Stock Movement Audit History
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Immutable transactional ledger of stock receipts, reservations, and releases
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left text-sm">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-5 py-4">Action</th>
                        <th className="px-5 py-4">Product</th>
                        <th className="px-5 py-4">Quantity</th>
                        <th className="px-5 py-4">Warehouse Facility</th>
                        <th className="px-5 py-4">Reference</th>
                        <th className="px-5 py-4">Timestamp</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 text-xs">
                      {movements.map((movement) => (
                        <tr key={movement.id} className="hover:bg-slate-50">
                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                                movement.movementType === 'RECEIVE'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : movement.movementType === 'RESERVE'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-purple-50 text-purple-700 border border-purple-200'
                              }`}
                            >
                              {movement.movementType}
                            </span>
                          </td>

                          <td className="px-5 py-4 font-medium text-slate-800">
                            {movement.product.name}
                            <p className="text-[10px] font-mono text-slate-400">
                              {movement.product.sku}
                            </p>
                          </td>

                          <td className="px-5 py-4 font-bold text-slate-900">
                            {movement.quantity}
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {movement.warehouse.name}
                            <p className="text-[10px] text-slate-400">
                              Bay: {movement.location.code}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-xs text-slate-500 font-mono">
                            {movement.referenceId || movement.referenceType || '—'}
                          </td>

                          <td className="px-5 py-4 text-xs text-slate-500">
                            {new Date(movement.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}

                      {!loading && movements.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-5 py-10 text-center text-sm text-slate-400"
                          >
                            No transactional movements recorded in database yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <RouteFallback
              type="ACCESS_DENIED"
              moduleName="Inventory"
              userRole={roles[0]}
              onReturnHome={() => setActivePage('Operations Overview')}
            />
          )
        ) : isWarehouses ? (
          hasPermissionForModule('Warehouses', roles) ? (
            <WarehouseManager />
          ) : (
            <RouteFallback
              type="ACCESS_DENIED"
              moduleName="Warehouses"
              userRole={roles[0]}
              onReturnHome={() => setActivePage('Operations Overview')}
            />
          )
        ) : isProducts ? (
          hasPermissionForModule('Products', roles) ? (
            <ProductManager />
          ) : (
            <RouteFallback
              type="ACCESS_DENIED"
              moduleName="Products"
              userRole={roles[0]}
              onReturnHome={() => setActivePage('Operations Overview')}
            />
          )
        ) : (
          <RouteFallback
            type="NOT_FOUND"
            moduleName={activePage}
            onReturnHome={() => setActivePage('Operations Overview')}
          />
        )}

          <footer className="mt-8 flex flex-wrap justify-between gap-2 border-t border-slate-200/60 pt-4 text-[11px] text-slate-400">
            <p>© 2026 FleetFlow Logistics Platform · Enterprise Supply Chain</p>
            <p>PostgreSQL Database & NestJS Microservices · Live Verified</p>
          </footer>
        </div>
      </main>

      {/* MODAL 1: Receive Stock (100% Dynamic Real Dropdowns) */}
      {showReceiveForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !receiveLoading) {
              setShowReceiveForm(false)
            }
          }}
        >
          <div className="my-auto w-full max-w-[520px] rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Receive Stock Inbound</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Select active product and facility location to increment inventory
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiveForm(false)}
                disabled={receiveLoading}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReceiveStock} className="space-y-4 p-6 text-xs">
              {modalLoading ? (
                <div className="py-8 text-center text-slate-400">Loading catalog and facilities...</div>
              ) : (
                <>
                  {/* Real Product Dropdown */}
                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Product Catalog Item *
                    </label>
                    <select
                      value={receiveForm.productId}
                      onChange={(e) => setReceiveForm({ ...receiveForm, productId: e.target.value })}
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-blue-500"
                    >
                      {modalProducts.length > 0 ? (
                        modalProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku}) — [{p.unit}]
                          </option>
                        ))
                      ) : (
                        <option value="" disabled>
                          No active products in catalog. Add a product first.
                        </option>
                      )}
                    </select>
                  </div>

                  {/* Real Warehouse Dropdown */}
                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Warehouse Facility *
                    </label>
                    <select
                      value={receiveForm.warehouseId}
                      onChange={(e) => handleModalWarehouseChange(e.target.value, setReceiveForm)}
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-blue-500"
                    >
                      {modalWarehouses.length > 0 ? (
                        modalWarehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.code}) {w.city ? `— ${w.city}` : ''}
                          </option>
                        ))
                      ) : (
                        <option value="" disabled>
                          No active warehouses available. Create a warehouse first.
                        </option>
                      )}
                    </select>
                  </div>

                  {/* Real Storage Location Dropdown */}
                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Storage Bay / Rack *
                    </label>
                    <select
                      value={receiveForm.locationId}
                      onChange={(e) => setReceiveForm({ ...receiveForm, locationId: e.target.value })}
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-blue-500"
                    >
                      {modalLocations.length > 0 ? (
                        modalLocations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name} ({l.code})
                          </option>
                        ))
                      ) : (
                        <option value="" disabled>
                          No storage locations in this warehouse. Add a location first.
                        </option>
                      )}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Received Quantity *
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={receiveForm.quantity}
                      onChange={(e) => setReceiveForm({ ...receiveForm, quantity: Number(e.target.value) })}
                      placeholder="e.g. 10"
                      className="w-full rounded-lg border border-slate-200 p-2.5 text-xs outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Receiving Notes / Bill of Lading *
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={receiveForm.notes}
                      onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })}
                      placeholder="e.g. Inbound PO-8821 verified and shelved"
                      className="w-full rounded-lg border border-slate-200 p-2.5 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowReceiveForm(false)}
                  disabled={receiveLoading}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={receiveLoading || modalProducts.length === 0 || modalLocations.length === 0}
                  className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white shadow-md shadow-blue-200 hover:bg-blue-700 disabled:opacity-50"
                >
                  {receiveLoading ? 'Receiving...' : 'Confirm Stock Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Reserve Stock (100% Dynamic Real Dropdowns) */}
      {showReserveForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !reserveLoading) {
              setShowReserveForm(false)
            }
          }}
        >
          <div className="my-auto w-full max-w-[520px] rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Reserve Stock for Order</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Hold available stock against an active order reference UUID
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReserveForm(false)}
                disabled={reserveLoading}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReserveStock} className="space-y-4 p-6 text-xs">
              {modalLoading ? (
                <div className="py-8 text-center text-slate-400">Loading catalog and facilities...</div>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Product *
                    </label>
                    <select
                      value={reserveForm.productId}
                      onChange={(e) => setReserveForm({ ...reserveForm, productId: e.target.value })}
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-indigo-500"
                    >
                      {modalProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Warehouse *
                    </label>
                    <select
                      value={reserveForm.warehouseId}
                      onChange={(e) => handleModalWarehouseChange(e.target.value, setReserveForm)}
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-indigo-500"
                    >
                      {modalWarehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Storage Bay *
                    </label>
                    <select
                      value={reserveForm.locationId}
                      onChange={(e) => setReserveForm({ ...reserveForm, locationId: e.target.value })}
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-indigo-500"
                    >
                      {modalLocations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Order Reference UUID *
                    </label>
                    <input
                      type="text"
                      required
                      value={reserveForm.referenceId}
                      onChange={(e) => setReserveForm({ ...reserveForm, referenceId: e.target.value })}
                      placeholder="Order or Shipment Reference UUID"
                      className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-mono outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Reserve Quantity *
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={reserveForm.quantity}
                      onChange={(e) => setReserveForm({ ...reserveForm, quantity: Number(e.target.value) })}
                      placeholder="e.g. 5"
                      className="w-full rounded-lg border border-slate-200 p-2.5 text-xs outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Notes *
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={reserveForm.notes}
                      onChange={(e) => setReserveForm({ ...reserveForm, notes: e.target.value })}
                      placeholder="e.g. Reserved for high-priority fulfillment"
                      className="w-full rounded-lg border border-slate-200 p-2.5 text-xs outline-none focus:border-indigo-500"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowReserveForm(false)}
                  disabled={reserveLoading}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reserveLoading || modalProducts.length === 0 || modalLocations.length === 0}
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {reserveLoading ? 'Reserving...' : 'Confirm Reservation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Release Stock (100% Dynamic Real Dropdowns) */}
      {showReleaseForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !releaseLoading) {
              setShowReleaseForm(false)
            }
          }}
        >
          <div className="my-auto w-full max-w-[520px] rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Release Stock Reservation</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Release previously held stock back to available warehouse balance
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReleaseForm(false)}
                disabled={releaseLoading}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReleaseStock} className="space-y-4 p-6 text-xs">
              {modalLoading ? (
                <div className="py-8 text-center text-slate-400">Loading catalog and facilities...</div>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Product *
                    </label>
                    <select
                      value={releaseForm.productId}
                      onChange={(e) => setReleaseForm({ ...releaseForm, productId: e.target.value })}
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-purple-500"
                    >
                      {modalProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Warehouse *
                    </label>
                    <select
                      value={releaseForm.warehouseId}
                      onChange={(e) => handleModalWarehouseChange(e.target.value, setReleaseForm)}
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-purple-500"
                    >
                      {modalWarehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Storage Bay *
                    </label>
                    <select
                      value={releaseForm.locationId}
                      onChange={(e) => setReleaseForm({ ...releaseForm, locationId: e.target.value })}
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-purple-500"
                    >
                      {modalLocations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Reservation UUID *
                    </label>
                    <input
                      type="text"
                      required
                      value={releaseForm.reservationId}
                      onChange={(e) => setReleaseForm({ ...releaseForm, reservationId: e.target.value })}
                      placeholder="Enter Reservation UUID to Release"
                      className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-mono outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Release Notes *
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={releaseForm.notes}
                      onChange={(e) => setReleaseForm({ ...releaseForm, notes: e.target.value })}
                      placeholder="e.g. Order cancelled by client; returning stock to available"
                      className="w-full rounded-lg border border-slate-200 p-2.5 text-xs outline-none focus:border-purple-500"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowReleaseForm(false)}
                  disabled={releaseLoading}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={releaseLoading || modalProducts.length === 0 || modalLocations.length === 0}
                  className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white shadow-md shadow-purple-200 hover:bg-purple-700 disabled:opacity-50"
                >
                  {releaseLoading ? 'Releasing...' : 'Confirm Stock Release'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
