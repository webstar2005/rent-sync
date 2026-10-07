import { useDashboard } from '../context';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorBanner, Table, THead } from '../ui';
import { kes } from '../../lib/format';

export function ReportsPage() {
  const d = useDashboard();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Reports"
          subtitle={
            <>
              Arrears by property
              {d.can('collectionRate') ? ', monthly collection rate' : ''}
              {d.can('tenantStatements') ? ', and per-tenant statements' : ''}
              {d.can('csvExport') ? ' — exportable as CSV' : ''}.
            </>
          }
          actions={
            <>
              <label className="block">
                <span className="sr-only">Filter reports by property</span>
                <select
                  value={String(d.reportPropertyFilter)}
                  onChange={(event) => {
                    const next = event.target.value === 'all' ? 'all' : Number(event.target.value);
                    d.setReportPropertyFilter(next);
                    d.loadReports();
                  }}
                  className="rs-field min-h-11 w-auto"
                >
                  <option value="all">All properties</option>
                  {d.properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="secondary" onClick={() => void d.loadReports()} disabled={d.reportsLoading}>
                {d.reportsLoading ? 'Loading…' : 'Refresh'}
              </Button>
              {d.can('csvExport') && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    void d.downloadArrearsCsv(
                      d.reportPropertyFilter === 'all' ? undefined : d.reportPropertyFilter
                    )
                  }
                >
                  Arrears CSV
                </Button>
              )}
              {d.can('csvExport') && d.can('collectionRate') && (
                <Button variant="secondary" onClick={() => void d.downloadCollectionRateCsv()}>
                  Collection CSV
                </Button>
              )}
            </>
          }
        />

        <div className="space-y-6 p-5">
          <ErrorBanner>{d.reportsError}</ErrorBanner>

          <div className="grid gap-6 xl:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-heading">Arrears by property</h3>
              {d.arrears.length === 0 ? (
                <EmptyState
                  title="No arrears data"
                  description="Generate invoices and let payments reconcile to see totals."
                />
              ) : (
                <Table label="Arrears by property">
                  <THead columns={['Property', 'Invoiced', 'Paid', 'Outstanding', 'Overdue']} />
                  <tbody>
                    {d.arrears.map((row) => (
                      <tr key={row.property_id} className="border-t border-line">
                        <td className="px-4 py-3 font-medium text-heading">{row.property_name}</td>
                        <td className="px-4 py-3">{kes(row.total_invoiced)}</td>
                        <td className="px-4 py-3">{kes(row.total_paid)}</td>
                        <td className="px-4 py-3 font-semibold text-accent">{kes(row.outstanding)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={row.overdue_count > 0 ? 'danger' : 'success'}>
                            {row.overdue_count}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>

            {d.can('collectionRate') && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-heading">Collection rate (12 months)</h3>
                {d.collectionRate.length === 0 ? (
                  <EmptyState title="No monthly collection data yet" />
                ) : (
                  <Table label="Collection rate over 12 months">
                    <THead columns={['Month', 'Invoiced', 'Collected', 'Rate']} />
                    <tbody>
                      {[...d.collectionRate].reverse().map((row) => {
                        const rate = Number(row.collection_rate_pct);
                        return (
                          <tr key={row.month} className="border-t border-line">
                            <td className="px-4 py-3 font-medium text-heading">{row.month}</td>
                            <td className="px-4 py-3">{kes(row.invoiced)}</td>
                            <td className="px-4 py-3">{kes(row.collected)}</td>
                            <td className="px-4 py-3">
                              <Badge tone={rate >= 90 ? 'success' : rate >= 70 ? 'warning' : 'danger'}>
                                {rate.toFixed(1)}%
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                )}
              </div>
            )}
          </div>

          {d.can('tenantStatements') && (
            <div className="rounded-xl border border-line bg-subtle p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h3 className="text-sm font-semibold text-heading">Tenant statement</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="block">
                    <span className="sr-only">Select tenant</span>
                    <select
                      value={String(d.reportStatementTenantId)}
                      onChange={(event) => {
                        d.setReportStatementTenantId(
                          event.target.value === '' ? '' : Number(event.target.value)
                        );
                        d.setTenantStatement(null);
                      }}
                      className="rs-field min-h-11 w-auto"
                    >
                      <option value="">Select tenant</option>
                      {d.properties.map((property) => (
                        <optgroup key={property.id} label={property.name}>
                          {d.tenants
                            .filter((tenant) => tenant.property_id === property.id)
                            .map((tenant) => (
                              <option key={tenant.id} value={tenant.id}>
                                {tenant.name} — {tenant.unit_number}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <Button
                    variant="primary"
                    onClick={() => void d.handleTenantStatementLoad()}
                    disabled={d.reportStatementTenantId === ''}
                  >
                    View statement
                  </Button>
                  {d.tenantStatement && d.can('csvExport') && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void d.downloadTenantStatementCsv(
                          d.tenantStatement!.tenant.id,
                          d.tenantStatement!.tenant.name
                        )
                      }
                    >
                      Statement CSV
                    </Button>
                  )}
                </div>
              </div>

              {d.tenantStatement ? (
                d.tenantStatement.statement.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">No activity for this tenant yet.</p>
                ) : (
                  <div className="mt-3">
                    <Table label="Tenant statement">
                      <THead columns={['Type', 'Reference', 'Date', 'Amount', 'Balance']} />
                      <tbody>
                        {d.tenantStatement.statement.map((entry, index) => (
                          <tr
                            key={`${entry.ref_number}-${index}`}
                            className="border-t border-line"
                          >
                            <td className="px-4 py-3">
                              <Badge tone={entry.type === 'invoice' ? 'accent' : 'success'}>
                                {entry.type}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">{entry.ref_number}</td>
                            <td className="px-4 py-3">{new Date(entry.occurred_at).toLocaleDateString()}</td>
                            <td className="px-4 py-3">
                              {Number(entry.amount) > 0 ? '+' : ''}
                              {kes(entry.amount)}
                            </td>
                            <td className="px-4 py-3 font-semibold text-heading">
                              {kes(entry.running_balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )
              ) : (
                <p className="mt-3 text-sm text-muted">
                  Select a tenant to view their full invoice + payment history with running balance.
                </p>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
