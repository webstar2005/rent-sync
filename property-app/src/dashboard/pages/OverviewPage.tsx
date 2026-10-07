import { useDashboard } from '../context';
import { Badge, Card, CardHeader, ErrorBanner, ListSkeleton, Skeleton } from '../ui';
import { Icon } from '../shell';
import SetupChecklist from '../../components/SetupChecklist';
import { kes } from '../../lib/format';

const FILTERS = ['all', 'overdue', 'partial', 'paid'] as const;

/* The four headline numbers, drawn as stadium swatches rather than bordered
   cards. Values are passed through untouched - this only decides the paint. */
function StatPill({
  shade,
  label,
  value,
  loading,
}: {
  shade: 1 | 2 | 3 | 4;
  label: string;
  value: string | number;
  loading?: boolean;
}) {
  return (
    <div className={`rs-stat rs-stat--${shade}`}>
      <p className="rs-stat-label">{label}</p>
      {loading ? (
        <Skeleton className="mt-3 h-6 w-24" />
      ) : (
        <p className="rs-stat-value">{value}</p>
      )}
    </div>
  );
}

export function OverviewPage() {
  const d = useDashboard();

  const name = d.user?.name || d.user?.email || 'there';

  return (
    <div className="space-y-6">
      <div>
        <p className="rs-label">Welcome back</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-heading">{name}</h2>
      </div>

      <div className="rs-stat-band">
        <div className="rs-stats">
          <StatPill shade={1} label="Properties" value={d.properties.length} loading={d.dataLoading} />
          <StatPill shade={2} label="Tenants" value={d.tenants.length} loading={d.dataLoading} />
          <StatPill shade={3} label="Collected" value={kes(d.totalCollected)} loading={d.dataLoading} />
          <StatPill shade={4} label="Outstanding" value={kes(d.totalOutstanding)} loading={d.dataLoading} />
        </div>
      </div>

      <SetupChecklist
        state={{
          hasProperty: d.properties.length > 0,
          hasTenant: d.tenants.length > 0,
          hasInvoice: d.invoices.length > 0,
          hasCollected: d.payments.some((payment) => payment.status === 'completed'),
          hasChannel: d.paymentChannels.length > 0,
        }}
        onAction={d.handleSetupAction}
        actionContent={{
          invoice: d.generatingInvoices ? 'Generating…' : undefined,
        }}
      />

      {d.can('reconciliation') && (
        <Card>
          <CardHeader
            title="Reconciliation"
            subtitle="How this month's payments are lining up against invoices."
          />
          <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4">
            {[
              { label: 'Unmatched', value: d.reconciliationSummary.unmatched_count, tone: 'danger' as const },
              { label: 'Duplicates', value: d.reconciliationSummary.duplicate_count, tone: 'warning' as const },
              { label: 'Manual review', value: d.reconciliationSummary.manual_review_count, tone: 'warning' as const },
              { label: 'Matched', value: d.reconciliationSummary.matched_count, tone: 'success' as const },
            ].map((entry) => (
              <div key={entry.label} className="rounded-xl border border-line bg-subtle px-4 py-3">
                <p className="rs-label">{entry.label}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xl font-semibold text-heading">{entry.value}</span>
                  <Badge tone={entry.tone}>{entry.value === 0 ? 'clear' : 'open'}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Needs attention"
          count={`${d.attentionItems.length} shown`}
          actions={
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
              {FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => d.setAttentionFilter(filter)}
                  aria-pressed={d.attentionFilter === filter}
                  className={`min-h-11 rounded-full px-3 text-xs font-semibold capitalize transition ${
                    d.attentionFilter === filter
                      ? 'bg-accent text-accent-ink'
                      : 'border border-line bg-card text-muted hover:border-line-strong'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          }
        />
        <div className="border-b border-line px-5 py-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <label className="relative block">
              <span className="sr-only">Search tenant, unit, or property</span>
              <Icon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
              />
              <input
                value={d.attentionSearch}
                onChange={(event) => d.setAttentionSearch(event.target.value)}
                placeholder="Search tenant, unit, or property"
                className="rs-field pl-9"
              />
            </label>
            <label className="block">
              <span className="sr-only">Filter by property</span>
              <select
                value={String(d.attentionPropertyFilter)}
                onChange={(event) =>
                  d.setAttentionPropertyFilter(
                    event.target.value === 'all' ? 'all' : Number(event.target.value)
                  )
                }
                className="rs-field"
              >
                <option value="all">All properties</option>
                {d.properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="space-y-3 p-5">
          <ErrorBanner>{d.error}</ErrorBanner>
          {d.dataLoading ? (
            <ListSkeleton rows={3} />
          ) : d.attentionItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted">
              {d.properties.length === 0
                ? 'No properties yet.'
                : d.tenants.length === 0
                  ? 'No tenants yet. Add one from the Tenants page to start tracking rent.'
                  : 'No tenants need attention right now.'}
            </div>
          ) : (
            d.attentionItems.map((tenant) => (
              <button
                key={tenant.id}
                type="button"
                onClick={() => d.setSelectedTenantId(tenant.id)}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-line bg-subtle p-4 text-left transition hover:border-accent hover:bg-hover"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-heading">{tenant.name}</p>
                  <p className="truncate text-sm text-muted">
                    {tenant.propertyName} • Unit {tenant.unit_number}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge
                    tone={
                      tenant.status === 'overdue'
                        ? 'danger'
                        : tenant.status === 'partial'
                          ? 'warning'
                          : 'success'
                    }
                  >
                    {tenant.label}
                  </Badge>
                  <p className="mt-2 text-sm font-medium text-ink">{kes(tenant.amountDue)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
