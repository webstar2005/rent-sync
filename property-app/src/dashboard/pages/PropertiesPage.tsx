import { useDashboard } from '../context';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorBanner, Field, ListSkeleton } from '../ui';
import PropertyUnits from '../../components/PropertyUnits';
import { kes } from '../../lib/format';

export function PropertiesPage() {
  const d = useDashboard();

  const addButton = (
    <Button variant="primary" onClick={() => d.openModal('add-property')}>
      Add property
    </Button>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Collections by property"
          count={`${d.properties.length} total`}
          actions={addButton}
        />
        <div className="p-5">
          <ErrorBanner>{d.error}</ErrorBanner>

          {d.dataLoading && d.properties.length === 0 ? (
            <ListSkeleton />
          ) : d.properties.length === 0 ? (
            <EmptyState
              title="No properties yet"
              description="Add your first building to start tracking units, tenants and rent."
              action={addButton}
            />
          ) : (
            <div className="space-y-4">
              {d.propertySummaries.map(
                ({
                  property,
                  totalUnits,
                  paidCount,
                  partialCount,
                  overdueCount,
                  collectedAmount,
                  outstandingAmount,
                  collectionRate,
                }) => (
                  <div key={property.id} className="rounded-xl border border-line bg-subtle p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-heading">{property.name}</h3>
                        <p className="truncate text-sm text-muted">{property.address}</p>
                      </div>
                      <Badge tone={property.status === 'active' ? 'success' : 'neutral'}>
                        {property.status}
                      </Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-muted md:grid-cols-4">
                      <p>
                        Units: {totalUnits}
                        {d.entitlement?.unitsLimit != null && (
                          <span className={d.entitlement.atUnitLimit ? 'text-[var(--danger-text)]' : 'text-faint'}>
                            {' '}
                            of {d.entitlement.unitsLimit}
                          </span>
                        )}
                      </p>
                      <p>Paid: {paidCount}</p>
                      <p>Partial: {partialCount}</p>
                      <p>Overdue: {overdueCount}</p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg border-l-4 border-[var(--kpi-green)] bg-card p-3">
                        <p className="rs-label">Collected</p>
                        <p className="mt-1 font-semibold text-heading">{kes(collectedAmount)}</p>
                      </div>
                      <div className="rounded-lg border-l-4 border-[var(--kpi-amber)] bg-card p-3">
                        <p className="rs-label">Outstanding</p>
                        <p className="mt-1 font-semibold text-heading">{kes(outstandingAmount)}</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between text-xs font-medium text-muted">
                        <span>Collection rate</span>
                        <span>{Math.round(collectionRate)}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--skeleton)]">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${Math.min(collectionRate, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant={
                          d.selectedPropertyForUnits === property.id ? 'primary' : 'secondary'
                        }
                        className="min-h-11 px-3 text-xs"
                        onClick={() =>
                          d.setSelectedPropertyForUnits(
                            d.selectedPropertyForUnits === property.id ? null : property.id
                          )
                        }
                        aria-pressed={d.selectedPropertyForUnits === property.id}
                      >
                        Units
                      </Button>
                      <Button
                        variant="secondary"
                        className="min-h-11 px-3 text-xs"
                        onClick={() => d.handlePropertyEditStart(property)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        className="min-h-11 px-3 text-xs"
                        onClick={() => void d.handlePropertyDelete(property.id)}
                        disabled={d.deletingPropertyId != null}
                      >
                        {d.deletingPropertyId === property.id ? 'Deleting…' : 'Delete'}
                      </Button>
                      <span className="ml-auto self-center text-xs text-muted">
                        Due: {property.rent_due_day ?? 5}th • {property.units} units
                      </span>
                    </div>

                    {d.editingPropertyId === property.id && (
                      <form
                        onSubmit={(event) => void d.handlePropertyUpdate(event)}
                        className="mt-4 space-y-3 rounded-xl border border-line bg-card p-4"
                      >
                        <p className="text-sm font-semibold text-heading">
                          Edit property — independent (only this property changes)
                        </p>
                        <Field label="Property name" error={d.propertyErrors.name}>
                          <input
                            value={d.editPropertyForm.name}
                            onChange={(event) =>
                              d.setEditPropertyForm({
                                ...d.editPropertyForm,
                                name: event.target.value,
                              })
                            }
                            className="rs-field"
                            aria-invalid={Boolean(d.propertyErrors.name)}
                          />
                        </Field>
                        <Field label="Address" error={d.propertyErrors.address}>
                          <input
                            value={d.editPropertyForm.address}
                            onChange={(event) =>
                              d.setEditPropertyForm({
                                ...d.editPropertyForm,
                                address: event.target.value,
                              })
                            }
                            className="rs-field"
                            aria-invalid={Boolean(d.propertyErrors.address)}
                          />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Units" error={d.propertyErrors.units}>
                            <input
                              type="number"
                              min="1"
                              value={d.editPropertyForm.units}
                              onChange={(event) =>
                                d.setEditPropertyForm({
                                  ...d.editPropertyForm,
                                  units: event.target.value,
                                })
                              }
                              className="rs-field"
                              aria-invalid={Boolean(d.propertyErrors.units)}
                            />
                          </Field>
                          <Field label="Rent due day">
                            <select
                              value={d.editPropertyForm.rent_due_day}
                              onChange={(event) =>
                                d.setEditPropertyForm({
                                  ...d.editPropertyForm,
                                  rent_due_day: event.target.value,
                                })
                              }
                              className="rs-field"
                            >
                              {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((day) => (
                                <option key={day} value={day}>
                                  {day}th
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <div className="flex gap-2">
                          <Button type="submit" variant="primary" className="flex-1" disabled={d.loading}>
                            Save
                          </Button>
                          <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={() => {
                              d.setEditingPropertyId(null);
                              d.setPropertyErrors({});
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </Card>

      {d.selectedPropertyForUnits && (
        <PropertyUnits
          key={d.selectedPropertyForUnits}
          propertyId={d.selectedPropertyForUnits}
          properties={d.properties}
          tenants={d.tenants}
          onUnitsChanged={() => {
            void d.loadProperties(true);
          }}
        />
      )}

      <Card>
        <CardHeader title="Paid vs unpaid by property" count={`${d.propertyPaymentStatus.length} properties`} />
        <div className="space-y-4 p-5">
          {d.propertyPaymentStatus.length === 0 ? (
            <p className="text-sm text-muted">No properties yet.</p>
          ) : (
            d.propertyPaymentStatus.map(({ property, paidTenants, unpaidTenants, paymentChannels }) => (
              <div key={property.id} className="rounded-xl border border-line bg-subtle p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-heading">{property.name}</h3>
                    <p className="truncate text-sm text-muted">{property.address}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {paymentChannels.map((channel) => (
                      <Badge key={channel} tone="accent">
                        {channel}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border-l-4 border-[var(--kpi-green)] bg-card p-3">
                    <p className="rs-label">Paid</p>
                    <p className="mt-2 text-lg font-semibold text-heading">{paidTenants.length} tenants</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink">
                      {paidTenants.length === 0 ? (
                        <span className="text-muted">No tenant has paid yet</span>
                      ) : (
                        paidTenants.map((tenant) => (
                          <span key={tenant.id} className="rounded-full bg-subtle px-2 py-1">
                            {tenant.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border-l-4 border-[var(--kpi-amber)] bg-card p-3">
                    <p className="rs-label">Not paid</p>
                    <p className="mt-2 text-lg font-semibold text-heading">{unpaidTenants.length} tenants</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink">
                      {unpaidTenants.length === 0 ? (
                        <span className="text-muted">All tenants are fully paid</span>
                      ) : (
                        unpaidTenants.map((tenant) => (
                          <span key={tenant.id} className="rounded-full bg-subtle px-2 py-1">
                            {tenant.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
