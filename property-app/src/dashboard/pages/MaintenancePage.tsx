import { useDashboard } from '../context';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorBanner, ListSkeleton } from '../ui';

// An urgent repair crosses the 48-hour line while the page is open, so this is deliberately
// evaluated against the clock on every render rather than memoised - the badge has to appear
// without the landlord refreshing.
const crossedEscalationThreshold = (item: {
  priority: string;
  status: string;
  created_at: string;
}) =>
  item.priority === 'urgent' &&
  item.status !== 'resolved' &&
  item.status !== 'closed' &&
  Date.now() - new Date(item.created_at).getTime() > 48 * 3600 * 1000;

export function MaintenancePage() {
  const d = useDashboard();

  if (!d.can('maintenance')) {
    return (
      <Card>
        <CardHeader title="Maintenance" />
        <EmptyState
          title="Maintenance is not on your plan"
          description="Raise, track and escalate repair requests once the feature is available on your account."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Maintenance"
          count={`${d.maintenance.length} requests`}
          subtitle="Repair requests across your properties, isolated to the ones you own."
          actions={
            <Button variant="primary" onClick={() => d.openModal('new-maintenance')}>
              New request
            </Button>
          }
        />

        <div className="space-y-4 p-5">
          <ErrorBanner>{d.error}</ErrorBanner>

          {d.maintenanceActionQueue.length > 0 && (
            <div className="rounded-xl border border-[var(--warning-soft)] border-l-4 bg-[var(--warning-soft)] p-4">
              <h3 className="text-sm font-semibold text-[var(--warning-text)]">
                Landlord action queue — {d.maintenanceActionQueue.length} open
              </h3>
              <p className="mt-1 text-xs text-[var(--warning-text)]">
                Filtered by your properties only (owner_id isolation). Urgent first, then by age.
              </p>
              {d.escalatedUrgent.length > 0 && (
                <p className="mt-2 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs font-semibold text-[var(--danger-text)]">
                  {d.escalatedUrgent.length} urgent repair(s) older than 48h — escalated
                </p>
              )}
              <div className="mt-3 space-y-2">
                {d.maintenanceActionQueue.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      <Badge tone={item.priority === 'urgent' ? 'danger' : item.priority === 'high' ? 'warning' : 'neutral'}>
                        {item.priority}
                      </Badge>{' '}
                      {item.title} • {item.property_name}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {d.dataLoading && d.maintenance.length === 0 ? (
            <ListSkeleton />
          ) : d.maintenance.length === 0 ? (
            <EmptyState
              title="No maintenance requests"
              description="Log a repair here and it stays tracked until it is resolved."
              action={
                <Button variant="primary" onClick={() => d.openModal('new-maintenance')}>
                  New request
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {d.maintenance.map((item) => {
                const isEscalated = crossedEscalationThreshold(item);

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-4 ${
                      isEscalated ? 'border-[var(--kpi-red)] bg-[var(--danger-soft)]' : 'border-line bg-subtle'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-heading">
                          {item.title}
                          {isEscalated && (
                            <Badge tone="danger" className="ml-2">
                              Escalated
                            </Badge>
                          )}
                        </h3>
                        <p className="text-sm text-muted">
                          {item.property_name || 'Property'} • {item.tenant_name || 'No tenant'} —
                          isolated to your properties
                        </p>
                      </div>
                      <Badge tone={item.priority === 'urgent' ? 'danger' : item.priority === 'high' ? 'warning' : 'neutral'}>
                        {item.priority}
                      </Badge>
                    </div>

                    <p className="mt-2 text-sm text-muted">{item.description}</p>
                    <p className="mt-1 text-xs text-faint">
                      Status: <span className="font-medium text-ink">{item.status}</span> • Created{' '}
                      {new Date(item.created_at).toLocaleString()}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.status === 'open' && (
                        <Button
                          variant="primary"
                          className="min-h-11 px-3 text-xs"
                          onClick={() => void d.handleMaintenanceStatusChange(item.id, 'in_progress')}
                        >
                          Start → In progress
                        </Button>
                      )}
                      {item.status === 'in_progress' && (
                        <Button
                          variant="primary"
                          className="min-h-11 px-3 text-xs"
                          onClick={() => void d.handleMaintenanceStatusChange(item.id, 'resolved')}
                        >
                          Resolve
                        </Button>
                      )}
                      {item.status === 'resolved' && (
                        <Button
                          variant="secondary"
                          className="min-h-11 px-3 text-xs"
                          onClick={() => void d.handleMaintenanceStatusChange(item.id, 'closed')}
                        >
                          Close
                        </Button>
                      )}
                      {item.priority !== 'urgent' &&
                        item.status !== 'closed' &&
                        item.status !== 'resolved' && (
                          <Button
                            variant="danger"
                            className="min-h-11 px-3 text-xs"
                            onClick={() => void d.handleMaintenanceEscalate(item.id)}
                          >
                            Escalate to urgent
                          </Button>
                        )}
                      <Button
                        variant="secondary"
                        className="min-h-11 px-3 text-xs"
                        onClick={() => void d.handleMaintenanceDelete(item.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
