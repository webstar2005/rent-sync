import { useDashboard } from './context';
import { Button, Drawer, ErrorBanner, Field, Modal } from './ui';
import { BulkTenantImport } from '../components/BulkTenantImport';
import { kes } from '../lib/format';

function AddPropertyDrawer() {
  const d = useDashboard();
  const open = d.modal === 'add-property';

  return (
    <Drawer
      open={open}
      onClose={d.closeModal}
      title="Add property"
      description="Name, address, units and the day rent is due."
    >
      <form className="space-y-4" onSubmit={(event) => void d.handlePropertySubmit(event)}>
        <Field label="Property name" htmlFor="prop-name" error={d.propertyErrors.name}>
          <input
            id="prop-name"
            value={d.propertyForm.name}
            onChange={(event) => d.setPropertyForm({ ...d.propertyForm, name: event.target.value })}
            className="rs-field"
            placeholder="Sunset Apartments"
            aria-invalid={Boolean(d.propertyErrors.name)}
          />
        </Field>

        <Field label="Address" htmlFor="prop-address" error={d.propertyErrors.address}>
          <input
            id="prop-address"
            value={d.propertyForm.address}
            onChange={(event) => d.setPropertyForm({ ...d.propertyForm, address: event.target.value })}
            className="rs-field"
            placeholder="12 River Road"
            aria-invalid={Boolean(d.propertyErrors.address)}
          />
        </Field>

        <Field label="Units" htmlFor="prop-units" error={d.propertyErrors.units}>
          <input
            id="prop-units"
            type="number"
            min="1"
            placeholder="e.g. 72"
            value={d.propertyForm.units}
            onChange={(event) => d.setPropertyForm({ ...d.propertyForm, units: event.target.value })}
            className="rs-field"
            aria-invalid={Boolean(d.propertyErrors.units)}
          />
        </Field>

        <Field
          label="Rent due day (landlord dictates)"
          htmlFor="prop-due"
          error={d.propertyErrors.rent_due_day}
          hint="Invoices are dated to this day, so you can start collecting from the 1st. Use Generate invoices to create them."
        >
          <select
            id="prop-due"
            value={d.propertyForm.rent_due_day}
            onChange={(event) =>
              d.setPropertyForm({ ...d.propertyForm, rent_due_day: event.target.value })
            }
            className="rs-field"
            aria-invalid={Boolean(d.propertyErrors.rent_due_day)}
          >
            {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((day) => (
              <option key={day} value={day}>
                {day}th of each month
              </option>
            ))}
          </select>
        </Field>

        <ErrorBanner>{d.error}</ErrorBanner>

        <Button type="submit" variant="primary" className="w-full" disabled={d.loading}>
          {d.loading ? 'Saving...' : 'Save property'}
        </Button>
      </form>
    </Drawer>
  );
}

function AddTenantDrawer() {
  const d = useDashboard();
  const open = d.modal === 'add-tenant';

  return (
    <Drawer open={open} onClose={d.closeModal} title="Add tenant" description="One tenant, one flat.">
      <form className="space-y-4" onSubmit={(event) => void d.handleTenantSubmit(event)}>
        <Field label="Property" htmlFor="tenant-property">
          <select
            id="tenant-property"
            value={d.tenantForm.property_id}
            onChange={(event) => d.setTenantForm({ ...d.tenantForm, property_id: event.target.value })}
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

        <Field label="Name" htmlFor="tenant-name">
          <input
            id="tenant-name"
            value={d.tenantForm.name}
            onChange={(event) => d.setTenantForm({ ...d.tenantForm, name: event.target.value })}
            className="rs-field"
          />
        </Field>

        <Field label="Phone" htmlFor="tenant-phone">
          <input
            id="tenant-phone"
            value={d.tenantForm.phone}
            onChange={(event) => d.setTenantForm({ ...d.tenantForm, phone: event.target.value })}
            className="rs-field"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Unit" htmlFor="tenant-unit">
            <input
              id="tenant-unit"
              value={d.tenantForm.unit_number}
              onChange={(event) => d.setTenantForm({ ...d.tenantForm, unit_number: event.target.value })}
              className="rs-field"
            />
          </Field>
          <Field label="Rent" htmlFor="tenant-rent">
            <input
              id="tenant-rent"
              type="number"
              value={d.tenantForm.monthly_rent}
              onChange={(event) => d.setTenantForm({ ...d.tenantForm, monthly_rent: event.target.value })}
              className="rs-field"
            />
          </Field>
        </div>

        <ErrorBanner>{d.error}</ErrorBanner>

        <Button type="submit" variant="primary" className="w-full" disabled={d.loading}>
          {d.loading ? 'Saving...' : 'Add tenant'}
        </Button>
      </form>
    </Drawer>
  );
}

function BulkImportDrawer() {
  const d = useDashboard();
  const open = d.modal === 'import-tenants';

  return (
    <Drawer
      open={open}
      onClose={d.closeModal}
      title="Bulk import"
      description="Download the template, fill it in, and import the list. Parsing happens in your browser."
    >
      <BulkTenantImport
        properties={d.properties}
        tenants={d.tenants}
        onImported={(imported) => d.handleTenantsImported(imported)}
      />
    </Drawer>
  );
}

function AddChannelDrawer() {
  const d = useDashboard();
  const open = d.modal === 'add-channel';

  return (
    <Drawer
      open={open}
      onClose={d.closeModal}
      title="Add payment channel"
      description="PayHero requires an ownership-confirmation step before incoming payments activate."
    >
      <form className="space-y-4" onSubmit={(event) => void d.handlePaymentChannelSubmit(event)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Channel type" htmlFor="ch-type">
            <select
              id="ch-type"
              value={d.paymentChannelForm.channel_type}
              onChange={(event) =>
                d.setPaymentChannelForm({
                  ...d.paymentChannelForm,
                  channel_type: event.target.value as typeof d.paymentChannelForm.channel_type,
                })
              }
              className="rs-field"
            >
              <option value="paybill">Paybill</option>
              <option value="till">Till</option>
              <option value="bank">Bank</option>
            </select>
          </Field>

          <Field label="Short code / Paybill / Till / Bank number" htmlFor="ch-code">
            <input
              id="ch-code"
              value={d.paymentChannelForm.short_code}
              onChange={(event) =>
                d.setPaymentChannelForm({ ...d.paymentChannelForm, short_code: event.target.value })
              }
              placeholder="e.g. 522522"
              className="rs-field"
            />
          </Field>
        </div>

        <Field label="Account number (bank / paybill account — optional)" htmlFor="ch-acct">
          <input
            id="ch-acct"
            value={d.paymentChannelForm.account_number}
            onChange={(event) =>
              d.setPaymentChannelForm({ ...d.paymentChannelForm, account_number: event.target.value })
            }
            className="rs-field"
          />
        </Field>

        <Field label="Description" htmlFor="ch-desc">
          <input
            id="ch-desc"
            value={d.paymentChannelForm.description}
            onChange={(event) =>
              d.setPaymentChannelForm({ ...d.paymentChannelForm, description: event.target.value })
            }
            placeholder="e.g. Main Paybill"
            className="rs-field"
          />
        </Field>

        <ErrorBanner>{d.paymentChannelError}</ErrorBanner>

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={d.paymentChannelLoading || !d.paymentChannelForm.short_code.trim()}
        >
          {d.paymentChannelLoading ? 'Registering with PayHero...' : 'Add payment channel'}
        </Button>
      </form>
    </Drawer>
  );
}

function NewMaintenanceDrawer() {
  const d = useDashboard();
  const open = d.modal === 'new-maintenance';

  return (
    <Drawer
      open={open}
      onClose={d.closeModal}
      title="New maintenance request"
      description="Log a repair and it stays tracked until it is resolved."
    >
      <form className="space-y-4" onSubmit={(event) => void d.handleMaintenanceSubmit(event)}>
        <Field label="Property" htmlFor="mnt-property">
          <select
            id="mnt-property"
            value={d.maintenanceForm.property_id}
            onChange={(event) =>
              d.setMaintenanceForm({ ...d.maintenanceForm, property_id: event.target.value })
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

        <Field label="Tenant" htmlFor="mnt-tenant">
          <select
            id="mnt-tenant"
            value={d.maintenanceForm.tenant_id}
            onChange={(event) =>
              d.setMaintenanceForm({ ...d.maintenanceForm, tenant_id: event.target.value })
            }
            className="rs-field"
          >
            <option value="">Optional tenant</option>
            {d.tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Title" htmlFor="mnt-title">
          <input
            id="mnt-title"
            value={d.maintenanceForm.title}
            onChange={(event) => d.setMaintenanceForm({ ...d.maintenanceForm, title: event.target.value })}
            className="rs-field"
          />
        </Field>

        <Field label="Priority" htmlFor="mnt-priority">
          <select
            id="mnt-priority"
            value={d.maintenanceForm.priority}
            onChange={(event) =>
              d.setMaintenanceForm({ ...d.maintenanceForm, priority: event.target.value })
            }
            className="rs-field"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </Field>

        <Field label="Description" htmlFor="mnt-description">
          <textarea
            id="mnt-description"
            value={d.maintenanceForm.description}
            onChange={(event) =>
              d.setMaintenanceForm({ ...d.maintenanceForm, description: event.target.value })
            }
            rows={3}
            className="rs-field"
          />
        </Field>

        <Field label="Status" htmlFor="mnt-status">
          <select
            id="mnt-status"
            value={d.maintenanceForm.status}
            onChange={(event) => d.setMaintenanceForm({ ...d.maintenanceForm, status: event.target.value })}
            className="rs-field"
          >
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </Field>

        <ErrorBanner>{d.error}</ErrorBanner>

        <Button type="submit" variant="primary" className="w-full" disabled={d.loading}>
          {d.loading ? 'Saving...' : 'Create maintenance request'}
        </Button>
      </form>
    </Drawer>
  );
}

function TenantDetailModal() {
  const d = useDashboard();
  const open = d.selectedTenant !== null && d.selectedTenantSummary !== null;
  if (!open) return null;

  const tenant = d.selectedTenant!;
  const summary = d.selectedTenantSummary!;

  return (
    <Modal
      open={open}
      onClose={() => d.setSelectedTenantId(null)}
      title={tenant.name}
      description={
        <>
          {d.properties.find((property) => property.id === tenant.property_id)?.name ??
            'Unknown property'}{' '}
          • Unit {tenant.unit_number}
        </>
      }
      size="xl"
    >
      <p className="rs-label mb-4 text-accent">Tenant details</p>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border-l-4 border-line bg-subtle p-4">
          <p className="rs-label">Status</p>
          <p className="mt-2 text-lg font-semibold text-heading">{summary.label}</p>
        </div>
        <div className="rounded-xl border-l-4 border-[var(--kpi-amber)] bg-subtle p-4">
          <p className="rs-label">Total due</p>
          <p className="mt-2 text-lg font-semibold text-heading">{kes(summary.amountDue)}</p>
        </div>
        <div className="rounded-xl border-l-4 border-[var(--kpi-blue)] bg-subtle p-4">
          <p className="rs-label">Monthly rent</p>
          <p className="mt-2 text-lg font-semibold text-heading">{kes(tenant.monthly_rent)}</p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <Button
          variant="secondary"
          disabled={d.loading}
          onClick={() => void d.handleTenantLifecycleAction(tenant.id, 'moved_out')}
        >
          Mark moved out
        </Button>
        <Button
          variant="secondary"
          disabled={d.loading}
          onClick={() => void d.handleTenantLifecycleAction(tenant.id, 'archived')}
        >
          Archive tenant
        </Button>
        <Button
          variant="danger"
          disabled={d.loading}
          onClick={() => void d.handleTenantLifecycleAction(tenant.id, 'delete')}
        >
          Delete tenant
        </Button>
      </div>

      <ErrorBanner>{d.error}</ErrorBanner>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold text-heading">Invoices</h4>
          <div className="space-y-3">
            {d.selectedTenantInvoices.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line-strong p-3 text-sm text-muted">
                No invoices yet.
              </p>
            ) : (
              d.selectedTenantInvoices.map((invoice) => {
                const invoicePayments = d.payments.filter(
                  (payment) => payment.invoice_id === invoice.id
                );
                const invoicePaid = invoicePayments
                  .filter((payment) => payment.status === 'completed')
                  .reduce((sum, payment) => sum + Number(payment.amount), 0);
                const recording = d.recordingInvoiceId === invoice.id;

                return (
                  <div key={invoice.id} className="rounded-xl border border-line bg-subtle p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-heading">{invoice.invoice_number}</p>
                      <span className="rounded-full bg-accent-soft px-2 py-1 text-[11px] font-semibold uppercase text-accent">
                        {invoice.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted">Due: {invoice.due_date}</p>
                    <p className="text-sm text-muted">Amount: {kes(invoice.amount)}</p>
                    <p className="text-sm text-muted">Paid: {kes(invoicePaid)}</p>

                    {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                      <>
                        <Button
                          variant={recording ? 'primary' : 'secondary'}
                          className="mt-2 w-full"
                          disabled={d.savingPayment}
                          aria-expanded={recording}
                          onClick={() => {
                            if (recording) {
                              d.closeRecordPayment();
                              return;
                            }
                            d.openRecordPayment(
                              invoice,
                              tenant.id,
                              Number(invoice.amount) - invoicePaid
                            );
                          }}
                        >
                          {recording ? 'Cancel recording' : 'I already received this payment'}
                        </Button>

                        {recording && (
                          <form
                            onSubmit={(event) => void d.handleSaveRecordedPayment(event, invoice)}
                            className="mt-3 space-y-3 rounded-xl border border-line bg-card p-3"
                          >
                            <p className="text-xs text-muted">
                              For money that reached you outside a registered channel — M-Pesa Send
                              Money to your number, cash, or a bank transfer. There is no automatic
                              confirmation for these, so record it here.
                            </p>

                            <Field label="Amount received (KES)" htmlFor={`record-amount-${invoice.id}`}>
                              <input
                                id={`record-amount-${invoice.id}`}
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                value={d.recordAmount}
                                onChange={(event) => d.setRecordAmount(event.target.value)}
                                className="rs-field"
                              />
                            </Field>

                            <Field label="How did it arrive?" htmlFor={`record-method-${invoice.id}`}>
                              <select
                                id={`record-method-${invoice.id}`}
                                value={d.recordMethod}
                                onChange={(event) =>
                                  d.setRecordMethod(event.target.value as typeof d.recordMethod)
                                }
                                className="rs-field"
                              >
                                <option value="mobile_money">M-Pesa Send Money</option>
                                <option value="bank_transfer">Bank transfer</option>
                                <option value="cash">Cash</option>
                                <option value="card">Card</option>
                                <option value="other">Other</option>
                              </select>
                            </Field>

                            <Field label="Reference (optional)" htmlFor={`record-ref-${invoice.id}`}>
                              <input
                                id={`record-ref-${invoice.id}`}
                                type="text"
                                value={d.recordReference}
                                onChange={(event) => d.setRecordReference(event.target.value)}
                                placeholder="e.g. QJG7X4K2PL"
                                className="rs-field"
                              />
                            </Field>

                            <ErrorBanner>{d.recordError}</ErrorBanner>

                            <div className="flex gap-2">
                              <Button type="submit" variant="primary" className="flex-1" disabled={d.savingPayment}>
                                {d.savingPayment ? 'Saving…' : 'Save payment'}
                              </Button>
                              <Button variant="secondary" disabled={d.savingPayment} onClick={d.closeRecordPayment}>
                                Cancel
                              </Button>
                            </div>
                          </form>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            )}

            {d.recordPaymentNotice && (
              <p className="rounded-xl border border-line bg-subtle p-3 text-sm text-ink">
                {d.recordPaymentNotice}
              </p>
            )}
          </div>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-heading">Payment history</h4>
          <div className="space-y-3">
            {d.selectedTenantPayments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line-strong p-3 text-sm text-muted">
                No payments recorded.
              </p>
            ) : (
              d.selectedTenantPayments.map((payment) => (
                <div key={payment.id} className="rounded-xl border border-line bg-subtle p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-heading">{kes(payment.amount)}</p>
                    <span className="rounded-full bg-[var(--success-soft)] px-2 py-1 text-[11px] font-semibold uppercase text-[var(--success-text)]">
                      {payment.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">Method: {payment.payment_method}</p>
                  <p className="text-sm text-muted">Reference: {payment.reference || '—'}</p>
                  <p className="text-sm text-muted">
                    Paid: {payment.paid_at ? new Date(payment.paid_at).toLocaleString() : '—'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function Modals() {
  return (
    <>
      <AddPropertyDrawer />
      <AddTenantDrawer />
      <BulkImportDrawer />
      <AddChannelDrawer />
      <NewMaintenanceDrawer />
      <TenantDetailModal />
    </>
  );
}
