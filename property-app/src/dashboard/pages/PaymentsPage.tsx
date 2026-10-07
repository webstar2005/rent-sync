import { useState } from 'react';
import { useDashboard } from '../context';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorBanner, Field, ListSkeleton, Table, THead } from '../ui';
import { kes } from '../../lib/format';

type SubTab = 'received' | 'alerts' | 'manual';

export function PaymentsPage() {
  const d = useDashboard();
  const canReconcile = d.can('reconciliation');
  const [tab, setTab] = useState<SubTab>('received');

  const tabs: { id: SubTab; label: string }[] = [
    { id: 'received', label: 'Received' },
    ...(canReconcile
      ? ([
          { id: 'alerts' as const, label: 'Alerts' },
          { id: 'manual' as const, label: 'Manual reconciliation' },
        ] as const)
      : []),
  ];

  const activeTab = tabs.some((entry) => entry.id === tab) ? tab : 'received';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Payment views">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={activeTab === entry.id}
            onClick={() => setTab(entry.id)}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold transition ${
              activeTab === entry.id
                ? 'bg-accent text-accent-ink'
                : 'border border-line bg-card text-muted hover:border-line-strong'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {activeTab === 'received' && (
        <Card>
          <CardHeader
            title="Payments received"
            count={`${d.payments.length} total`}
            subtitle="Every payment recorded against your properties, newest first. Payments that could not be matched to an invoice are listed here too and flagged for reconciliation — nothing received is ever hidden."
            actions={
              d.unmatchedPaymentCount > 0 ? (
                <Badge tone="danger">{d.unmatchedPaymentCount} needing reconciliation</Badge>
              ) : undefined
            }
          />

          <div className="p-5">
            <ErrorBanner>{d.error}</ErrorBanner>

            {d.dataLoading && d.payments.length === 0 ? (
              <ListSkeleton />
            ) : d.payments.length === 0 ? (
              <EmptyState
                title="No payments recorded yet"
                description="They appear here the moment a tenant pays through your registered PayHero channel, or when you record one you already received."
              />
            ) : (
              <>
                <div className="hidden sm:block">
                  <Table label="Payments received">
                    <THead
                      columns={[
                        'Received',
                        'Tenant',
                        'Invoice',
                        'Amount',
                        'Method',
                        'Channel',
                        'Reference',
                        'Status',
                      ]}
                    />
                    <tbody>
                      {d.payments.map((payment) => (
                        <tr key={payment.id} className="border-t border-line">
                          <td className="whitespace-nowrap px-4 py-3 text-muted">
                            {new Date(payment.paid_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">{payment.tenant_name || <span className="text-faint">Unidentified</span>}</td>
                          <td className="px-4 py-3">
                            {payment.invoice_number || <span className="text-faint">Not matched</span>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-medium text-heading">
                            {kes(payment.amount)}
                          </td>
                          <td className="px-4 py-3 capitalize text-muted">
                            {String(payment.payment_method).replace(/_/g, ' ')}
                          </td>
                          <td className="px-4 py-3 text-muted">{payment.channel_short_code || '—'}</td>
                          <td className="px-4 py-3 text-muted">
                            {payment.reference || payment.transaction_ref || '—'}
                          </td>
                          <td className="px-4 py-3">
                            {payment.matched === false ? (
                              <Badge tone="danger">Needs reconciliation</Badge>
                            ) : (
                              <Badge tone="success">{payment.status}</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>

                <div className="space-y-3 sm:hidden">
                  {d.payments.map((payment) => (
                    <div key={payment.id} className="rounded-xl border border-line bg-subtle p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-heading">{kes(payment.amount)}</p>
                        {payment.matched === false ? (
                          <Badge tone="danger">Needs reconciliation</Badge>
                        ) : (
                          <Badge tone="success">{payment.status}</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {payment.tenant_name || 'Unidentified tenant'} · {payment.invoice_number || 'Not matched'}
                      </p>
                      <p className="mt-1 text-xs text-faint">{new Date(payment.paid_at).toLocaleString()}</p>
                      <dl className="mt-3 space-y-1 text-sm">
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted">Method</dt>
                          <dd className="capitalize text-ink">
                            {String(payment.payment_method).replace(/_/g, ' ')}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted">Channel</dt>
                          <dd className="text-ink">{payment.channel_short_code || '—'}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted">Reference</dt>
                          <dd className="truncate text-ink">
                            {payment.reference || payment.transaction_ref || '—'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {activeTab === 'alerts' && canReconcile && (
        <Card>
          <CardHeader title="Payment alerts" count={`${d.reconciliationAlerts.length} entries`} />
          <div className="space-y-3 p-5">
            {d.reconciliationAlerts.length === 0 ? (
              <EmptyState
                title="No reconciliation alerts"
                description="Incoming payments that cannot be matched to an invoice will show up here."
              />
            ) : (
              d.reconciliationAlerts.map((alert) => (
                <div key={alert.id} className="rounded-xl border border-line bg-subtle p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-heading">
                      {alert.tenant_name || alert.invoice_number || 'Unknown tenant'}
                    </p>
                    <Badge
                      tone={
                        alert.match_status === 'unmatched'
                          ? 'danger'
                          : alert.match_status === 'duplicate' || alert.match_status === 'manual_review'
                            ? 'warning'
                            : 'success'
                      }
                    >
                      {alert.match_status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {alert.property_name ? `${alert.property_name} • ` : ''}
                    {alert.invoice_number ? `Invoice ${alert.invoice_number} • ` : ''}
                    {alert.transaction_ref || 'No reference'}
                  </p>
                  <p className="mt-1 text-xs text-faint">{new Date(alert.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {activeTab === 'manual' && canReconcile && (
        <Card>
          <CardHeader
            title="Manual payment reconciliation"
            subtitle="Use this when a tenant pays by bank transfer or an unmatched mobile-money reference needs to be linked to the correct tenant."
          />
          <form className="space-y-4 p-5" onSubmit={(event) => void d.handleManualPaymentReconciliation(event)}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Property" htmlFor="recon-property">
                <select
                  id="recon-property"
                  value={d.manualPaymentForm.property_id}
                  onChange={(event) =>
                    d.setManualPaymentForm({ ...d.manualPaymentForm, property_id: event.target.value })
                  }
                  className="rs-field"
                >
                  <option value="">Select property</option>
                  {d.properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Tenant name" htmlFor="recon-tenant">
                <input
                  id="recon-tenant"
                  value={d.manualPaymentForm.tenant_name}
                  onChange={(event) =>
                    d.setManualPaymentForm({ ...d.manualPaymentForm, tenant_name: event.target.value })
                  }
                  className="rs-field"
                  placeholder="Jane Mwangi"
                />
              </Field>

              <Field label="Amount" htmlFor="recon-amount">
                <input
                  id="recon-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={d.manualPaymentForm.amount}
                  onChange={(event) =>
                    d.setManualPaymentForm({ ...d.manualPaymentForm, amount: event.target.value })
                  }
                  className="rs-field"
                />
              </Field>

              <Field label="Payment method" htmlFor="recon-method">
                <select
                  id="recon-method"
                  value={d.manualPaymentForm.payment_method}
                  onChange={(event) =>
                    d.setManualPaymentForm({
                      ...d.manualPaymentForm,
                      payment_method: event.target.value as typeof d.manualPaymentForm.payment_method,
                    })
                  }
                  className="rs-field"
                >
                  <option value="mobile_money">Mobile money</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </Field>

              <Field label="Transaction reference" htmlFor="recon-ref">
                <input
                  id="recon-ref"
                  value={d.manualPaymentForm.transaction_ref}
                  onChange={(event) =>
                    d.setManualPaymentForm({
                      ...d.manualPaymentForm,
                      transaction_ref: event.target.value,
                    })
                  }
                  className="rs-field"
                  placeholder="MPESA-12345 or bank transfer ref"
                />
              </Field>

              <Field label="Reference note" htmlFor="recon-note">
                <input
                  id="recon-note"
                  value={d.manualPaymentForm.reference}
                  onChange={(event) =>
                    d.setManualPaymentForm({ ...d.manualPaymentForm, reference: event.target.value })
                  }
                  className="rs-field"
                  placeholder="Jane Mwangi"
                />
              </Field>
            </div>

            <ErrorBanner>{d.error}</ErrorBanner>

            <Button type="submit" variant="primary" className="w-full" disabled={d.loading}>
              {d.loading ? 'Reconciling payment...' : 'Match payment to tenant'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
