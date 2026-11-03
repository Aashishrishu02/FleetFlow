import React from 'react';

interface RouteFallbackProps {
  type: 'NOT_FOUND' | 'ACCESS_DENIED';
  moduleName: string;
  userRole?: string;
  onReturnHome: () => void;
}

export const RouteFallback: React.FC<RouteFallbackProps> = ({
  type,
  moduleName,
  userRole,
  onReturnHome,
}) => {
  if (type === 'ACCESS_DENIED') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-white p-12 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl font-bold text-amber-700">
          !
        </div>
        <h3 className="mt-4 text-xl font-bold text-slate-900">Access Denied</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Your role (<span className="font-semibold text-slate-800">{userRole || 'Auditor'}</span>) does not have authorization to view the{' '}
          <span className="font-semibold text-slate-800">{moduleName}</span> module.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Role-based tenant access control is enforced by the backend security policies.
        </p>
        <div className="mt-6">
          <button
            onClick={onReturnHome}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-200 hover:bg-blue-700 transition"
          >
            Return to Operations Overview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-slate-500">
        404
      </div>
      <h3 className="mt-4 text-xl font-bold text-slate-900">Module Not Found</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        The module <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-800">{moduleName}</code> is not supported or does not exist in this deployment.
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Only features with verified backend microservices and database integration are accessible.
      </p>
      <div className="mt-6">
        <button
          onClick={onReturnHome}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-200 hover:bg-blue-700 transition"
        >
          Return to Operations Overview
        </button>
      </div>
    </div>
  );
};

