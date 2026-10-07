import { useDashboard } from '../context';
import { Badge, Button, Card, CardHeader, EmptyState, Table, THead, ErrorBanner, ListSkeleton } from '../ui';
import { kes } from '../../lib/format';

export function InvoicesPage() {
  const d = useDashboard();

  return (
    <Card>
      <CardHeader
        title="Recent invoices"
        count={`${d.recentInvoices.length} latest`}
        actions={
          <Button
            variant="primary"
            onClick={() => void d.handleGenerateInvoices()}
            disabled={d.generatingInvoices || !d.user}
          >
            {d.generatingInvoices ? 'Generating…' : 'Generate next month'}
          </Button>
        }
      />

      <div className="space-y-3 p-5">
        {d.invoiceNotice && <p className="text-sm font-medium text-accent">{d.invoiceNotice}</p>}
        <ErrorBanner>{d.error}</ErrorBanner>

        {d.dataLoading && d.recentInvoices.length === 0 ? (
          <ListSkeleton />
        ) : d.recentInvoices.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description="Generate next month's rent for every active tenant and it will show up here."
            action={
              <Button
                variant="primary"
                onClick={() => void d.handleGenerateInvoices()}
                disabled={d.generatingInvoices || !d.user}
              >
                {d.generatingInvoices ? 'Generating…' : 'Generate next month'}
              </Button>
            }
          />
        ) : (
          <>
            <div className="hidden sm:block">
              <Table label="Recent invoices">
                <THead columns={['Invoice', 'Tenant', 'Amount', 'Status']} />
                <tbody>
                  {d.recentInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-t border-line">
                      <td className="px-4 py-3 font-medium text-heading">{invoice.invoice_number}</td>
                      <td className="px-4 py-3 text-muted">{invoice.tenant_name || '—'}</td>
                      <td className="px-4 py-3 text-ink">{kes(invoice.amount)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={invoice.status === 'paid' ? 'success' : invoice.status === 'overdue' ? 'danger' : 'warning'}>
                          {invoice.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <div className="space-y-3 sm:hidden">
              {d.recentInvoices.map((invoice) => (
                <div key={invoice.id} className="rounded-xl border border-line bg-subtle p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-heading">{invoice.invoice_number}</p>
                    <Badge tone={invoice.status === 'paid' ? 'success' : invoice.status === 'overdue' ? 'danger' : 'warning'}>
                      {invoice.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted">{invoice.tenant_name || '—'}</p>
                  <p className="mt-1 text-sm font-medium text-ink">{kes(invoice.amount)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
