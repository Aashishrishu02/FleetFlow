import { useState } from 'react';
import './App.css';
import { useAuth } from './context/AuthContext';
import { AuthPage } from './components/auth/AuthPage';
import { Sidebar } from './components/layout/Sidebar';
import { TopNavbar } from './components/layout/TopNavbar';
import { OperationsOverview } from './components/dashboard/OperationsOverview';
import { WarehouseManager } from './components/warehouses/WarehouseManager';
import { ProductManager } from './components/products/ProductManager';
import { InventoryLedgerView } from './components/inventory/InventoryLedgerView';
import { OrdersView } from './components/orders/OrdersView';
import { ShipmentsView } from './components/shipments/ShipmentsView';
import { DispatchConsoleView } from './components/dispatch/DispatchConsoleView';
import { PartnersView } from './components/partners/PartnersView';
import { ReturnsView } from './components/returns/ReturnsView';
import { FinanceView } from './components/finance/FinanceView';
import { WorkflowsView } from './components/workflows/WorkflowsView';
import { OrganizationSettingsView } from './components/organization/OrganizationSettingsView';
import { SecurityAuditView } from './components/security/SecurityAuditView';

export const IMPLEMENTED_MODULE_IDS = new Set([
  'Operations Overview',
  'Organizations',
  'Members',
  'Orders',
  'Inventory',
  'Warehouses',
  'Products',
  'Shipments',
  'Dispatch',
  'Partners',
  'Returns',
  'Finance Overview',
  'Pricing Rules',
  'Shipping Quotes',
  'Invoices',
  'Credit Notes',
  'Refunds',
  'Partner Payables',
  'Reconciliation',
  'Workflow Monitor',
  'Team & Permissions',
  'API Keys',
  'Audit Logs',
  'Settings',
]);

function App() {
  const { user, organization, roles, isAuthenticated, isLoading, logout } = useAuth();
  const [activePage, setActivePage] = useState('Operations Overview');

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0c1427] text-slate-300">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest font-mono text-slate-400">
            Initializing FleetFlow Enterprise OS...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  const renderActiveView = () => {
    switch (activePage) {
      case 'Operations Overview':
        return <OperationsOverview onNavigate={setActivePage} />;

      // Organization Management
      case 'Organizations':
        return <OrganizationSettingsView initialTab="organizations" />;
      case 'Members':
        return <OrganizationSettingsView initialTab="members" />;
      case 'Settings':
        return <OrganizationSettingsView initialTab="settings" />;

      // Operations
      case 'Orders':
        return <OrdersView />;
      case 'Inventory':
        return <InventoryLedgerView />;
      case 'Warehouses':
        return <WarehouseManager />;
      case 'Products':
        return <ProductManager />;
      case 'Shipments':
        return <ShipmentsView />;
      case 'Dispatch':
        return <DispatchConsoleView />;
      case 'Partners':
        return <PartnersView />;
      case 'Returns':
        return <ReturnsView />;

      // Finance
      case 'Finance Overview':
        return <FinanceView initialTab="overview" />;
      case 'Pricing Rules':
        return <FinanceView initialTab="pricing" />;
      case 'Shipping Quotes':
        return <FinanceView initialTab="quotes" />;
      case 'Invoices':
      case 'Credit Notes':
        return <FinanceView initialTab="invoices" />;
      case 'Refunds':
      case 'Reconciliation':
      case 'Partner Payables':
        return <FinanceView initialTab="reconciliation" />;

      // System
      case 'Workflow Monitor':
        return <WorkflowsView />;
      case 'Team & Permissions':
        return <SecurityAuditView initialTab="rbac" />;
      case 'API Keys':
        return <SecurityAuditView initialTab="keys" />;
      case 'Audit Logs':
        return <SecurityAuditView initialTab="audit" />;

      default:
        return <OperationsOverview onNavigate={setActivePage} />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8fafc] font-sans text-slate-900 antialiased">
      {/* 23-View Enterprise Navigation Sidebar */}
      <Sidebar
        activeId={activePage}
        onSelect={(id) => setActivePage(id)}
      />

      {/* Main Viewport */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Crisp White Enterprise Top Header */}
        <TopNavbar
          userName={user?.name || 'Administrator'}
          userEmail={user?.email || 'admin@fleetflow.io'}
          organizationName={organization?.name || 'FleetFlow Logistics'}
          organizationSlug={organization?.slug || 'fleetflow-primary'}
          roleName={roles[0] || 'Organization Owner'}
          onLogout={logout}
        />

        {/* High-Density Workstation Content Canvas */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#f8fafc]">
          <div className="max-w-[1600px] mx-auto">
            {renderActiveView()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
