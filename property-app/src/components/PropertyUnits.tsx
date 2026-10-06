import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { createUnit, deleteUnit, getUnits, updateUnit, type Unit } from '../lib/api/units';
import type { Property } from '../lib/api/properties';
import type { Tenant } from '../lib/api/tenants';
import { kes } from '../lib/format';

// The units of one property: the list (search, status filter, paging), create/edit/delete, and the
// unit detail modal.
//
// This used to live inline in App.tsx, where it was effectively dead. The section only rendered
// once a property was already selected and nothing on the dashboard ever selected one, and the
// form's visibility was derived from the "saving" flag, so "Add house" never opened it either.
// Selection now belongs to App - the Units button on a property card passes the id down - and the
// component is keyed on that id, so switching property resets search, page and open forms instead
// of carrying them across to a different list.
//
// Listing is an effect keyed on property/search/filter/page rather than a function App calls. The
// old search box only wrote state nothing read, so typing never reloaded the table.

type UnitStatusFilter = 'all' | 'vacant' | 'occupied' | 'maintenance' | 'reserved';

type UnitFormState = {
  unit_number: string;
  unit_type: Unit['unit_type'] | '';
  floor: string;
  size_sqm: string;
  monthly_rent: string;
  status: Unit['status'] | '';
  tenant_id: string;
  description: string;
};

const EMPTY_FORM: UnitFormState = {
  unit_number: '',
  unit_type: '',
  floor: '',
  size_sqm: '',
  monthly_rent: '0',
  status: 'vacant',
  tenant_id: '',
  description: '',
};

export default function PropertyUnits({
  propertyId,
  properties,
  tenants,
  onUnitsChanged,
}: {
  propertyId: number;
  properties: Property[];
  tenants: Tenant[];
  // The unit count a plan is billed against lives on the property row, so App re-reads it after
  // every write here.
  onUnitsChanged: () => void;
}) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState<UnitStatusFilter>('all');
  // Two states, not one: the box echoes every keystroke while the request that follows it waits,
  // otherwise typing a unit number fires one request per character.
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [form, setForm] = useState<UnitFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingUnitId, setDeletingUnitId] = useState<number | null>(null);
  const [error, setError] = useState('');
  // Bumped after a write so the list refetches without a callback threaded through every form.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    getUnits(propertyId, {
      search,
      status: statusFilter,
      page: pagination.page,
      limit: pagination.limit,
      sort: 'unit_number',
      order: 'asc',
    })
      .then((res) => {
        if (cancelled) return;
        setUnits(res.units);
        setPagination((prev) => ({ ...prev, ...res.pagination }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('Failed to load units:', err);
        setError('Failed to load units');
      });

    return () => {
      cancelled = true;
    };
  }, [propertyId, search, statusFilter, pagination.page, pagination.limit, refreshKey]);

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setFormErrors({});
  }

  function openUnitDetail(unit: Unit) {
    setSelectedUnit(unit);
  }

  function closeUnitDetail() {
    setSelectedUnit(null);
  }

  function openCreateUnit() {
    setEditingUnitId(null);
    setFormOpen(true);
    resetForm();
    setError('');
  }

  function startEditUnit(unit: Unit) {
    setEditingUnitId(unit.id);
    setForm({
      unit_number: unit.unit_number,
      unit_type: unit.unit_type || '',
      floor: String(unit.floor ?? ''),
      size_sqm: String(unit.size_sqm ?? ''),
      monthly_rent: String(unit.monthly_rent ?? 0),
      status: unit.status,
      tenant_id: String(unit.tenant_id ?? ''),
      description: unit.description || '',
    });
    setFormErrors({});
    setFormOpen(true);
    setError('');
  }

  function cancelForm() {
    setFormOpen(false);
    setEditingUnitId(null);
    resetForm();
    setError('');
  }

  function afterWrite() {
    setRefreshKey((key) => key + 1);
    onUnitsChanged();
  }

  async function handleCreateUnit(event: FormEvent) {
    event.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.unit_number.trim()) errs.unit_number = 'Unit number is required';
    if (!form.monthly_rent || Number(form.monthly_rent) < 0) errs.monthly_rent = 'Monthly rent must be >= 0';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    setError('');
    try {
      await createUnit(propertyId, {
        unit_number: form.unit_number.trim(),
        unit_type: form.unit_type === '' ? undefined : form.unit_type,
        floor: form.floor ? Number(form.floor) : undefined,
        size_sqm: form.size_sqm ? Number(form.size_sqm) : undefined,
        monthly_rent: Number(form.monthly_rent),
        status: form.status === '' ? 'vacant' : form.status,
        tenant_id: form.tenant_id ? Number(form.tenant_id) : undefined,
        description: form.description || undefined,
      });
      cancelForm();
      afterWrite();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create unit');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateUnit(unitId: number, event: FormEvent) {
    event.preventDefault();
    const errs: Record<string, string> = {};
    if (form.unit_number && !form.unit_number.trim()) errs.unit_number = 'Unit number cannot be empty';
    if (form.monthly_rent !== '' && Number(form.monthly_rent) < 0) errs.monthly_rent = 'Monthly rent must be >= 0';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    setError('');
    try {
      // Cleared fields are sent as null, not omitted: omitting means "leave this alone" and would
      // make it impossible to unassign a tenant or blank a floor.
      const payload: Record<string, any> = {};
      if (form.unit_number !== '') payload.unit_number = form.unit_number.trim();
      if (form.unit_type !== '') payload.unit_type = form.unit_type;
      if (form.floor !== '') payload.floor = form.floor ? Number(form.floor) : null;
      if (form.size_sqm !== '') payload.size_sqm = form.size_sqm ? Number(form.size_sqm) : null;
      if (form.monthly_rent !== '') payload.monthly_rent = Number(form.monthly_rent);
      if (form.status !== '') payload.status = form.status;
      if (form.tenant_id !== '') payload.tenant_id = form.tenant_id ? Number(form.tenant_id) : null;
      if (form.description !== '') payload.description = form.description;

      await updateUnit(unitId, payload);
      cancelForm();
      afterWrite();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update unit');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteUnit(unitId: number) {
    if (!confirm('Delete this unit? This will unassign any tenant. This cannot be undone.')) return;
    setDeletingUnitId(unitId);
    try {
      await deleteUnit(unitId);
      closeUnitDetail();
      afterWrite();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete unit');
    } finally {
      setDeletingUnitId(null);
    }
  }

  function handleUnitSearch(event: ChangeEvent<HTMLInputElement>) {
    setSearchInput(event.target.value);
  }

  function handleUnitStatusFilterChange(next: UnitStatusFilter) {
    setStatusFilter(next);
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }

  function handleUnitPageChange(page: number) {
    setPagination((prev) => ({ ...prev, page }));
  }

  return (
    <>
            <section id="section-units" className="mt-8 rounded-3xl border border-[#2C2326] bg-[#161112] p-4 sm:p-6 shadow-[0_12px_26px_rgba(0,0,0,0.4)]">
              {error && !formOpen && (
                <p className="mb-4 rounded-xl border border-[#4A2127] bg-[#2E1519] p-3 text-sm text-[#F08E9B]">{error}</p>
              )}
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[#F6F2F3]">
                    Units â€” {properties.find(p => p.id === propertyId)?.name}
                  </h2>
                  <p className="mt-1 text-sm text-[#A99FA3]">
                    {units.filter(u => u.status === 'occupied').length} occupied Â· {units.filter(u => u.status === 'vacant').length} vacant Â· {units.filter(u => u.status === 'maintenance').length} maintenance Â· {units.filter(u => u.status === 'reserved').length} reserved
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openCreateUnit()}
                    className="rounded-full bg-[#7A1428] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#8E1A30]"
                  >
                    Add house
                  </button>
                </div>
              </div>

              {/* Summary bar */}
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
                <div className="rounded-xl bg-[#221C1E] p-3">
                  <p className="text-[#A99FA3]">Total units</p>
                  <p className="mt-1 font-semibold text-[#F6F2F3]">{units.length}</p>
                </div>
                <div className="rounded-xl bg-[#201A1C] p-3">
                  <p className="text-[#A99FA3]">Occupied</p>
                  <p className="mt-1 font-semibold text-[#4ADE80]">{units.filter(u => u.status === 'occupied').length}</p>
                </div>
                <div className="rounded-xl bg-[#1C1618] p-3">
                  <p className="text-[#A99FA3]">Vacant</p>
                  <p className="mt-1 font-semibold text-[#F0B84B]">{units.filter(u => u.status === 'vacant').length}</p>
                </div>
                <div className="rounded-xl bg-[#2B1A1E] p-3">
                  <p className="text-[#A99FA3]">Monthly rent</p>
                  <p className="mt-1 font-semibold text-[#C65A70]">{kes(units.reduce((sum, u) => sum + Number(u.monthly_rent), 0))}</p>
                </div>
              </div>

              {/* Search & Filter */}
              <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_140px_140px]">
                <input
                  value={searchInput}
                  onChange={handleUnitSearch}
                  placeholder="Search unit number, type, or tenant..."
                  className="w-full rounded-xl border border-[#261F22] bg-[#1C1618] px-3 py-2.5 text-sm text-[#C9C0C4] outline-none ring-0"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => handleUnitStatusFilterChange(e.target.value as 'all' | 'vacant' | 'occupied' | 'maintenance' | 'reserved')}
                  className="rounded-xl border border-[#261F22] bg-[#1C1618] px-3 py-2.5 text-sm text-[#C9C0C4] outline-none ring-0"
                >
                  <option value="all">All statuses</option>
                  <option value="vacant">Vacant</option>
                  <option value="occupied">Occupied</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="reserved">Reserved</option>
                </select>
              </div>

              {/* Units table / cards */}
              <div className="space-y-3">
                {units.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#3A2E32] bg-[#1C1618] p-6 text-center text-sm text-[#A49DA1]">
                    <p className="font-medium text-[#F6F2F3]">No units yet</p>
                    <p className="mt-1">Click "Add house" to create your first unit</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden overflow-x-auto rounded-2xl border border-[#2C2326] lg:block">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-[#221C1E] text-[#B5ABB0]">
                          <tr>
                            <th className="px-3 py-2 font-medium">Unit</th>
                            <th className="px-3 py-2 font-medium">Type</th>
                            <th className="px-3 py-2 font-medium">Floor</th>
                            <th className="px-3 py-2 font-medium">Rent</th>
                            <th className="px-3 py-2 font-medium">Status</th>
                            <th className="px-3 py-2 font-medium">Tenant</th>
                            <th className="px-3 py-2 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {units.map((unit) => (
                            <tr key={unit.id} className="border-t border-[#2A2225] hover:bg-[#1C1618] cursor-pointer" onClick={() => openUnitDetail(unit)}>
                              <td className="px-3 py-2 font-medium text-[#F6F2F3]">{unit.unit_number}</td>
                              <td className="px-3 py-2 text-[#D9D2D6]">{unit.unit_type ? unit.unit_type.replace('_', ' ') : 'â€”'}</td>
                              <td className="px-3 py-2 text-[#D9D2D6]">{unit.floor != null ? unit.floor : 'â€”'}</td>
                              <td className="px-3 py-2 text-[#D9D2D6]">{kes(unit.monthly_rent)}</td>
                              <td className="px-3 py-2">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  unit.status === 'occupied' ? 'bg-[#14211B] text-[#4ADE80]' :
                                  unit.status === 'vacant' ? 'bg-[#2B2116] text-[#F0B84B]' :
                                  unit.status === 'maintenance' ? 'bg-[#33161B] text-[#F08E9B]' :
                                  'bg-[#2B1A1E] text-[#C65A70]'
                                }`}>
                                  {unit.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-[#D9D2D6]">{unit.tenant_name || 'â€”'}</td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); startEditUnit(unit); }}
                                    className="rounded-full border border-[#33282C] bg-[#161112] px-2 py-1 text-xs font-medium text-[#CFC5CA] hover:border-[#7A3B4C] hover:text-[#C65A70]"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteUnit(unit.id); }}
                                    disabled={deletingUnitId === unit.id}
                                    className="rounded-full border border-[#4A2127] bg-[#2E1519] px-2 py-1 text-xs font-medium text-[#F08E9B] hover:bg-[#3D1A1F] disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {deletingUnitId === unit.id ? 'â€¦' : 'Del'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="lg:hidden space-y-3">
                      {units.map((unit) => (
                        <div key={unit.id} className="rounded-2xl border border-[#2C2326] bg-[#1C1618] p-4" onClick={() => openUnitDetail(unit)}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-[#F6F2F3]">{unit.unit_number}</p>
                              <p className="text-xs text-[#A99FA3]">{unit.unit_type ? unit.unit_type.replace('_', ' ') : 'â€”'} Â· {unit.floor != null ? `Floor ${unit.floor}` : 'No floor'}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                              unit.status === 'occupied' ? 'bg-[#14211B] text-[#4ADE80]' :
                              unit.status === 'vacant' ? 'bg-[#2B2116] text-[#F0B84B]' :
                              unit.status === 'maintenance' ? 'bg-[#33161B] text-[#F08E9B]' :
                              'bg-[#2B1A1E] text-[#C65A70]'
                            }`}>
                              {unit.status}
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-[#B0A8AD]">
                            <p>Rent: <span className="text-[#F6F2F3]">{kes(unit.monthly_rent)}</span></p>
                            <p>Tenant: <span className="text-[#F6F2F3]">{unit.tenant_name || 'â€”'}</span></p>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); startEditUnit(unit); }}
                              className="flex-1 rounded-full border border-[#33282C] bg-[#161112] px-3 py-1.5 text-xs font-medium text-[#CFC5CA] hover:border-[#7A3B4C]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDeleteUnit(unit.id); }}
                              disabled={deletingUnitId === unit.id}
                              className="flex-1 rounded-full border border-[#4A2127] bg-[#2E1519] px-3 py-1.5 text-xs font-medium text-[#F08E9B] disabled:opacity-50"
                            >
                              {deletingUnitId === unit.id ? 'Deletingâ€¦' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleUnitPageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="rounded-full border border-[#33282C] bg-[#161112] px-3 py-1.5 text-xs font-medium text-[#CFC5CA] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-[#A99FA3]">
                      Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUnitPageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                      className="rounded-full border border-[#33282C] bg-[#161112] px-3 py-1.5 text-xs font-medium text-[#CFC5CA] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}

                {/* Create/Edit unit form */}
                {formOpen && (
                  <form onSubmit={(e) => editingUnitId ? handleUpdateUnit(editingUnitId!, e) : handleCreateUnit(e)} className="mt-6 rounded-xl border border-[#3A2E32] bg-[#161112] p-4 space-y-4">
                    <h3 className="text-lg font-semibold text-[#F6F2F3]">{editingUnitId ? 'Edit unit' : 'Add unit'}</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Unit number</label>
                        <input
                          value={form.unit_number}
                          onChange={(e) => setForm({ ...form, unit_number: e.target.value })}
                          className={`w-full rounded-lg border px-3 py-2 ${formErrors.unit_number ? 'border-[#5C2730]' : 'border-[#2A2225]'}`}
                          placeholder="e.g. A-101"
                        />
                        {formErrors.unit_number && <p className="mt-1 text-xs text-[#F47C8E]">{formErrors.unit_number}</p>}
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Type</label>
                        <select
                          value={form.unit_type}
                          onChange={(e) => setForm({ ...form, unit_type: e.target.value as Unit['unit_type'] })}
                          className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2"
                        >
                          <option value="">Select type</option>
                          <option value="bedsitter">Bedsitter</option>
                          <option value="1_bedroom">1 Bedroom</option>
                          <option value="2_bedroom">2 Bedrooms</option>
                          <option value="3_bedroom">3 Bedrooms</option>
                          <option value="commercial">Commercial</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Floor</label>
                        <input
                          type="number"
                          min="-5"
                          max="100"
                          value={form.floor}
                          onChange={(e) => setForm({ ...form, floor: e.target.value })}
                          className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2"
                          placeholder="e.g. 1"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Size (sqm)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={form.size_sqm}
                          onChange={(e) => setForm({ ...form, size_sqm: e.target.value })}
                          className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2"
                          placeholder="e.g. 45.5"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Monthly rent (KES)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.monthly_rent}
                          onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })}
                          className={`w-full rounded-lg border px-3 py-2 ${formErrors.monthly_rent ? 'border-[#5C2730]' : 'border-[#2A2225]'}`}
                        />
                        {formErrors.monthly_rent && <p className="mt-1 text-xs text-[#F47C8E]">{formErrors.monthly_rent}</p>}
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Status</label>
                        <select
                          value={form.status}
                          onChange={(e) => setForm({ ...form, status: e.target.value as Unit['status'] })}
                          className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2"
                        >
                          <option value="vacant">Vacant</option>
                          <option value="occupied">Occupied</option>
                          <option value="maintenance">Maintenance</option>
                          <option value="reserved">Reserved</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Assign tenant</label>
                        <select
                          value={form.tenant_id}
                          onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}
                          className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2"
                        >
                          <option value="">Unassigned</option>
                          {tenants.filter(t => t.property_id === propertyId && (t.status === 'active' || t.status === 'pending')).map((tenant) => (
                            <option key={tenant.id} value={tenant.id}>{tenant.name} â€” {tenant.unit_number || 'no unit'}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Description</label>
                        <textarea
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          rows={2}
                          className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2"
                          placeholder="Optional notes..."
                        />
                      </div>
                    </div>
                    {error && <p className="text-sm text-[#F47C8E]">{error}</p>}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 rounded-lg bg-[#7A1428] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {saving ? 'Savingâ€¦' : editingUnitId ? 'Save changes' : 'Add unit'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelForm}
                        className="flex-1 rounded-lg border border-[#33282C] bg-[#161112] px-4 py-2 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </section>
        {selectedUnit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
            <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-3xl border border-[#261F22] bg-[#161112] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C65A70]">Unit details</p>
                  <h3 className="mt-2 text-2xl font-bold text-[#F6F2F3]">{selectedUnit.unit_number}</h3>
                  <p className="text-sm text-[#A99FA3]">
                    {properties.find((property) => property.id === selectedUnit.property_id)?.name ?? 'Unknown property'}
                    {selectedUnit.floor != null && ` â€¢ Floor ${selectedUnit.floor}`}
                    {selectedUnit.unit_type && ` â€¢ ${selectedUnit.unit_type.replace('_', ' ')}`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeUnitDetail}
                  className="rounded-full border border-[#33282C] bg-[#201A1C] px-3 py-1.5 text-sm font-medium text-[#CFC5CA]"
                >
                  Close
                </button>
              </div>

              <div className="mb-6 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl bg-[#221C1E] p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-[#B5ABB0]">Status</p>
                  <p className="mt-2 text-lg font-semibold text-[#F6F2F3]">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                      selectedUnit.status === 'occupied' ? 'bg-[#14211B] text-[#4ADE80]' :
                      selectedUnit.status === 'vacant' ? 'bg-[#2B2116] text-[#F0B84B]' :
                      selectedUnit.status === 'maintenance' ? 'bg-[#33161B] text-[#F08E9B]' :
                      'bg-[#2B1A1E] text-[#C65A70]'
                    }`}>
                      {selectedUnit.status}
                    </span>
                  </p>
                </div>
                <div className="rounded-2xl bg-[#221C1E] p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-[#B5ABB0]">Monthly rent</p>
                  <p className="mt-2 text-lg font-semibold text-[#F6F2F3]">{kes(selectedUnit.monthly_rent)}</p>
                </div>
                <div className="rounded-2xl bg-[#221C1E] p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-[#B5ABB0]">Tenant</p>
                  <p className="mt-2 text-lg font-semibold text-[#F6F2F3]">{selectedUnit.tenant_name || 'â€”'}</p>
                </div>
                <div className="rounded-2xl bg-[#221C1E] p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-[#B5ABB0]">Size</p>
                  <p className="mt-2 text-lg font-semibold text-[#F6F2F3]">{selectedUnit.size_sqm ? `${selectedUnit.size_sqm} sqm` : 'â€”'}</p>
                </div>
              </div>

              <div className="mb-6 grid gap-3 md:grid-cols-2">
                {selectedUnit.tenant_id && (
                  <div className="rounded-2xl border border-[#2C2326] bg-[#1C1618] p-4">
                    <h4 className="mb-3 text-lg font-semibold text-[#F6F2F3]">Current renter</h4>
                    <p className="font-semibold text-[#F6F2F3]">{selectedUnit.tenant_name}</p>
                    {selectedUnit.tenant_phone && <p className="mt-1 text-sm text-[#A99FA3]">Phone: {selectedUnit.tenant_phone}</p>}
                    {selectedUnit.tenant_email && <p className="mt-1 text-sm text-[#A99FA3]">Email: {selectedUnit.tenant_email}</p>}
                    {selectedUnit.tenant_monthly_rent && <p className="mt-1 text-sm text-[#A99FA3]">Rent: {kes(selectedUnit.tenant_monthly_rent)}</p>}
                    {selectedUnit.lease_start && <p className="mt-1 text-sm text-[#A99FA3]">Lease start: {selectedUnit.lease_start}</p>}
                    {selectedUnit.lease_end && <p className="mt-1 text-sm text-[#A99FA3]">Lease end: {selectedUnit.lease_end}</p>}
                    <p className="mt-1 text-sm text-[#A99FA3]">Status: {selectedUnit.tenant_status}</p>
                  </div>
                )}
                <div className="rounded-2xl border border-[#2C2326] bg-[#1C1618] p-4">
                  <h4 className="mb-3 text-lg font-semibold text-[#F6F2F3]">Unit info</h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#A99FA3]">Unit number</dt>
                      <dd className="text-right text-[#D9D2D6]">{selectedUnit.unit_number}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#A99FA3]">Type</dt>
                      <dd className="text-right text-[#D9D2D6]">{selectedUnit.unit_type ? selectedUnit.unit_type.replace('_', ' ') : 'â€”'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#A99FA3]">Floor</dt>
                      <dd className="text-right text-[#D9D2D6]">{selectedUnit.floor != null ? selectedUnit.floor : 'â€”'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#A99FA3]">Size</dt>
                      <dd className="text-right text-[#D9D2D6]">{selectedUnit.size_sqm ? `${selectedUnit.size_sqm} sqm` : 'â€”'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#A99FA3]">Monthly rent</dt>
                      <dd className="text-right text-[#D9D2D6]">{kes(selectedUnit.monthly_rent)}</dd>
                    </div>
                    {selectedUnit.description && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-[#A99FA3]">Description</dt>
                        <dd className="text-right text-[#D9D2D6]">{selectedUnit.description}</dd>
                      </div>
                    )}
                    {selectedUnit.landlord_name && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-[#A99FA3]">Overseeing landlord</dt>
                        <dd className="text-right text-[#D9D2D6]">{selectedUnit.landlord_name} ({selectedUnit.landlord_email})</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>

              {/* Payment history */}
              {selectedUnit.payment_history && selectedUnit.payment_history.length > 0 && (
                <div>
                  <h4 className="mb-3 text-lg font-semibold text-[#F6F2F3]">Payment history</h4>
                  <div className="space-y-3">
                    {selectedUnit.payment_history.map((payment) => (
                      <div key={payment.id} className="rounded-2xl border border-[#2C2326] bg-[#1C1618] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold text-[#F6F2F3]">{kes(payment.amount)}</p>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${
                            payment.matched === false ? 'bg-[#3A1414] text-[#F08A8A]' : 'bg-[#152A1C] text-[#6FCF97]'
                          }`}>
                            {payment.matched === false ? 'Needs reconciliation' : payment.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[#A99FA3]">
                          {payment.tenant_name || 'Unidentified tenant'}
                          {' Â· '}
                          {payment.invoice_number || 'Not matched'}
                        </p>
                        <p className="mt-1 text-xs text-[#8A8085]">{new Date(payment.paid_at).toLocaleString()}</p>
                        <dl className="mt-3 space-y-1 text-sm">
                          <div className="flex justify-between gap-3">
                            <dt className="text-[#A99FA3]">Method</dt>
                            <dd className="text-right capitalize text-[#D9D2D6]">
                              {String(payment.payment_method).replace(/_/g, ' ')}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-[#A99FA3]">Channel</dt>
                            <dd className="text-right text-[#D9D2D6]">
                              {payment.channel_short_code || 'â€”'}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-[#A99FA3]">Reference</dt>
                            <dd className="truncate text-right text-[#D9D2D6]">
                              {payment.reference || payment.transaction_ref || 'â€”'}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedUnit.payment_history && selectedUnit.payment_history.length === 0 && (
                <p className="rounded-2xl border border-dashed border-[#3A2E32] bg-[#1C1618] p-4 text-sm text-[#A49DA1]">
                  No payment history for this unit yet.
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => startEditUnit(selectedUnit)}
                  className="rounded-xl border border-[#33282C] bg-[#161112] px-4 py-2 text-sm font-medium text-[#CFC5CA] hover:border-[#7A3B4C] hover:text-[#C65A70]"
                >
                  Edit unit
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}