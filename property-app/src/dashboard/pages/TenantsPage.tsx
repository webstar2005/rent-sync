import { useDashboard } from '../context';
import { Badge, Button, Card, CardHeader, EmptyState, ListSkeleton, Table, THead } from '../ui';
import { Icon } from '../shell';
import { kes } from '../../lib/format';

function statusTone(status: string) {
  if (status === 'active') return 'success' as const;
  if (status === 'pending') return 'warning' as const;
  if (status === 'moved_out') return 'danger' as const;
  return 'neutral' as const;
}

export function TenantsPage() {
  const d = useDashboard();

  return (
    <Card>
      <CardHeader
        title="Tenants"
        count={`${d.tenants.length} total`}
        subtitle="Everyone on your books, with the flat they hold and the rent they pay."
        actions={
          <>
            {d.can('bulkImport') && (
              <Button variant="secondary" onClick={() => d.openModal('import-tenants')}>
                Bulk import
              </Button>
            )}
            <Button variant="primary" onClick={() => d.openModal('add-tenant')}>
              Add tenant
            </Button>
          </>
        }
      />

      <div className="border-b border-line px-5 py-4">
        <label className="relative block sm:max-w-md">
          <span className="sr-only">Search tenants</span>
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          />
          <input
            value={d.tenantRosterSearch}
            onChange={(event) => d.setTenantRosterSearch(event.target.value)}
            placeholder="Search tenant, property, unit or phone..."
            className="rs-field pl-9"
          />
        </label>
      </div>

      <div className="p-5">
        {d.dataLoading && d.tenants.length === 0 ? (
          <ListSkeleton />
        ) : d.tenants.length === 0 ? (
          <EmptyState
            title="No tenants yet"
            description="Add one by hand or bulk import a list — either way they land here with their property, unit and monthly rent."
            action={
              <Button variant="primary" onClick={() => d.openModal('add-tenant')}>
                Add tenant
              </Button>
            }
          />
        ) : d.tenantRoster.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted">
            No tenant matches "{d.tenantRosterSearch.trim()}".
          </p>
        ) : (
          <div className="hidden sm:block">
            <Table label="Tenant roster">
              <THead columns={['Tenant', 'Property', 'Unit', 'Monthly rent', 'Status']} />
              <tbody>
                {d.tenantRoster.map((tenant) => (
                  <tr
                    key={tenant.id}
                    onClick={() => d.setSelectedTenantId(tenant.id)}
                    className="cursor-pointer border-t border-line transition hover:bg-hover"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-heading">{tenant.name}</span>
                      {tenant.phone && <span className="ml-2 text-xs text-muted">{tenant.phone}</span>}
                    </td>
                    <td className="px-4 py-3 text-muted">{tenant.property_name ?? 'Unknown property'}</td>
                    <td className="px-4 py-3 font-medium text-ink">{tenant.unit_number}</td>
                    <td className="px-4 py-3 text-ink">{kes(tenant.monthly_rent)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(tenant.status)}>{tenant.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}

        {/* Small screens: the same rows as stacked cards, so the page never scrolls sideways. */}
        {d.tenants.length > 0 && d.tenantRoster.length > 0 && (
          <div className="space-y-3 sm:hidden">
            {d.tenantRoster.map((tenant) => (
              <button
                key={tenant.id}
                type="button"
                onClick={() => d.setSelectedTenantId(tenant.id)}
                className="block w-full rounded-xl border border-line bg-subtle p-4 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-heading">{tenant.name}</p>
                    <p className="truncate text-sm text-muted">
                      {tenant.property_name ?? 'Unknown property'} • Unit {tenant.unit_number}
                    </p>
                  </div>
                  <Badge tone={statusTone(tenant.status)}>{tenant.status}</Badge>
                </div>
                <p className="mt-2 text-sm font-medium text-ink">{kes(tenant.monthly_rent)} / month</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
