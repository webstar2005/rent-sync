import { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { readSheet } from 'read-excel-file/browser';
import { bulkImportTenants } from '../lib/api/tenants';
import type { Property } from '../lib/api/properties';
import type { Tenant } from '../lib/api/tenants';

type RawRow = {
  'Property Name'?: string;
  'Unit Number'?: string;
  'Tenant Name'?: string;
  Phone?: string;
  'Rent Amount'?: string;
  'Lease Start'?: string;
  'Lease End'?: string;
  // also allow lower case variants
  [key: string]: any;
};

type PreviewRow = {
  idx: number;
  raw: RawRow;
  edited: RawRow;
  status: 'valid' | 'needs_fixing';
  reason: string;
  normalizedPhone: string | null;
};

const HEADERS = ['Property Name', 'Unit Number', 'Tenant Name', 'Phone', 'Rent Amount', 'Lease Start', 'Lease End'] as const;

// Neutralize spreadsheet formula injection when re-exporting user-supplied cells to CSV
// (cells starting with = + - @ tab/CR/LF execute as formulas in Excel/Sheets).
const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

function csvSafeCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return CSV_FORMULA_PREFIX.test(s) ? `'${s}` : s;
}

function normalizeKenyanPhone(raw: string): { valid: boolean; normalized: string | null; reason?: string } {
  const s = String(raw ?? '').trim().replace(/\s+/g, '').replace(/-/g, '');
  if (!s) return { valid: true, normalized: null }; // allow blank? but spec says Phone must match if present — we'll treat blank as invalid for bulk? We'll allow blank as needs fixing? Actually tenant phone is optional in normal create but bulk says must match — we'll require if present
  const cleaned = s.startsWith('+') ? s.slice(1) : s;
  if (/^07\d{8}$/.test(cleaned)) return { valid: true, normalized: `254${cleaned.slice(1)}` };
  if (/^2547\d{8}$/.test(cleaned)) return { valid: true, normalized: cleaned };
  if (/^7\d{8}$/.test(cleaned)) return { valid: true, normalized: `254${cleaned}` };
  return { valid: false, normalized: null, reason: 'Phone must be 07XXXXXXXX or 2547XXXXXXXX' };
}

function toDisplayDate(v: any): string {
  if (!v) return '';
  const s = String(v).trim();
  if (!s) return '';
  // Excel may give number (serial) — handled by XLSX parsing already converts? We'll treat as string
  return s;
}

function validateRows(
  rows: RawRow[],
  properties: Property[],
  tenants: Tenant[]
): PreviewRow[] {
  const propByName = new Map(properties.map((p) => [p.name.trim().toLowerCase(), p]));
  const occupied = new Set(
    tenants.filter((t) => t.status === 'active').map((t) => {
      const prop = properties.find((p) => p.id === t.property_id);
      const pname = (prop?.name ?? '').trim().toLowerCase();
      return `${pname}|${String(t.unit_number).trim().toLowerCase()}`;
    })
  );
  const seenInBatch = new Set<string>();
  return rows.map((r, i) => {
    // normalize header case: try both
    const get = (k: string) => r[k] ?? r[k.toLowerCase()] ?? r[k.toUpperCase()] ?? '';
    const propertyName = String(get('Property Name') ?? '').trim();
    const unitNumber = String(get('Unit Number') ?? '').trim();
    const tenantName = String(get('Tenant Name') ?? '').trim();
    const phoneRaw = String(get('Phone') ?? '').trim();
    const rentRaw = String(get('Rent Amount') ?? '').trim();
    const leaseStartRaw = toDisplayDate(get('Lease Start'));
    const leaseEndRaw = toDisplayDate(get('Lease End'));

    const errors: string[] = [];
    let normalizedPhone: string | null = null;

    if (!tenantName) errors.push('Tenant Name is required');
    if (!unitNumber) errors.push('Unit Number is required');
    if (!propertyName) errors.push('Property Name is required');

    if (phoneRaw) {
      const ph = normalizeKenyanPhone(phoneRaw);
      if (!ph.valid) errors.push(ph.reason!);
      else normalizedPhone = ph.normalized;
    } else {
      // Phone optional? spec says must match Kenyan format — if blank, mark needs fixing? We'll allow blank as valid but normalize to null
      // To follow spec strictly, blank phone is not valid? We'll treat blank as needs fixing for bulk if empty? But tenant phone is optional in single create, so allow blank.
      normalizedPhone = null;
    }

    const rentAmount = Number(rentRaw.replace(/,/g, '').trim());
    if (!rentRaw || Number.isNaN(rentAmount) || rentAmount <= 0) errors.push('Rent Amount must be a positive number');

    let leaseStart: Date | null = null;
    let leaseEnd: Date | null = null;
    if (leaseStartRaw) {
      const d = new Date(leaseStartRaw);
      if (Number.isNaN(d.getTime())) errors.push('Lease Start is not a valid date');
      else leaseStart = d;
    }
    if (leaseEndRaw) {
      const d = new Date(leaseEndRaw);
      if (Number.isNaN(d.getTime())) errors.push('Lease End is not a valid date');
      else leaseEnd = d;
    }
    if (leaseStart && leaseEnd && leaseEnd < leaseStart) errors.push('Lease End cannot be before Lease Start');

    if (propertyName) {
      const prop = propByName.get(propertyName.trim().toLowerCase());
      if (!prop) errors.push(`Property not found: "${propertyName}" — unit not found`);
    }

    const key = `${propertyName.toLowerCase()}|${unitNumber.toLowerCase()}`;
    if (propertyName && unitNumber) {
      if (seenInBatch.has(key)) errors.push(`Duplicate Unit Number in upload: ${unitNumber} for ${propertyName}`);
      else seenInBatch.add(key);
      if (occupied.has(key)) errors.push(`Unit already has an active tenant: ${unitNumber} in ${propertyName}`);
    }

    const edited: RawRow = {
      'Property Name': propertyName,
      'Unit Number': unitNumber,
      'Tenant Name': tenantName,
      Phone: phoneRaw,
      'Rent Amount': rentRaw,
      'Lease Start': leaseStartRaw,
      'Lease End': leaseEndRaw,
    };

    return {
      idx: i,
      raw: r,
      edited,
      status: errors.length === 0 ? 'valid' : 'needs_fixing',
      reason: errors.join('; '),
      normalizedPhone,
    };
  });
}

export function BulkTenantImport({
  properties,
  tenants,
  onImported,
}: {
  properties: Property[];
  tenants: Tenant[];
  onImported: (importedTenants?: Tenant[]) => Promise<void>;
}) {
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; skippedRows: any[] } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const summary = useMemo(() => {
    if (!preview) return null;
    const valid = preview.filter((r) => r.status === 'valid').length;
    return { valid, total: preview.length, skipped: preview.length - valid };
  }, [preview]);

  const downloadTemplate = () => {
    const csv = [
      HEADERS.join(','),
      'Sunset Apartments,4B,Jane Mwangi,0712345678,25000,2025-01-01,2025-12-31',
      'Sunset Apartments,2A,John Doe,254712345678,22000,2025-02-01,',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rent-sync-tenant-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCsv = (file: File) =>
    new Promise<RawRow[]>((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
        complete: (res) => {
          if (res.errors.length > 0) console.warn(res.errors);
          resolve(res.data as RawRow[]);
        },
        error: reject,
      });
    });

  const parseXlsx = async (file: File): Promise<RawRow[]> => {
    // readSheet parses the first sheet and returns an array of rows (arrays of cells).
    const rows = (await readSheet(file)) as unknown[][];
    const [headerRow, ...dataRows] = rows;
    if (!headerRow || headerRow.length === 0) return [];
    const headerIndex = new Map<string, number>();
    headerRow.forEach((cell, i) => {
      const key = String(cell ?? '').trim().toLowerCase();
      if (key && !headerIndex.has(key)) headerIndex.set(key, i);
    });
    return dataRows.map((row) => {
      const o: RawRow = {};
      for (const h of HEADERS) {
        const idx = headerIndex.get(h.toLowerCase());
        o[h] = idx !== undefined && row[idx] !== null && row[idx] !== undefined ? String(row[idx]) : '';
      }
      return o;
    });
  };

  const handleFile = async (file: File) => {
    setError(null);
    setWarning(null);
    setResult(null);
    setFileName(file.name);

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx'].includes(ext ?? '')) {
      setError('Wrong file type — please upload .csv or .xlsx (the template is CSV).');
      setPreview(null);
      return;
    }

    try {
      let rows: RawRow[] = [];
      if (ext === 'csv') rows = await parseCsv(file);
      else rows = await parseXlsx(file);

      // Filter out completely empty rows
      rows = rows.filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== ''));

      if (rows.length === 0) {
        setError('Empty file — no rows found. Add at least one tenant row below the headers.');
        setPreview(null);
        return;
      }
      if (rows.length > 500) {
        setWarning(`Large file: ${rows.length} rows. Importing ${rows.length} rows may take a moment — please keep this tab open.`);
      }

      const validated = validateRows(rows, properties, tenants);
      setPreview(validated);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to parse file');
      setPreview(null);
    }
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const updateCell = (idx: number, field: keyof RawRow, value: string) => {
    if (!preview) return;
    const next = [...preview];
    const row = { ...next[idx] };
    const edited = { ...row.edited, [field]: value };
    row.edited = edited;
    // re-validate this single row against others? For simplicity re-validate all from edited values
    const allEdited = next.map((r, i) => (i === idx ? edited : r.edited));
    const revalidated = validateRows(allEdited as RawRow[], properties, tenants);
    setPreview(revalidated);
  };

  const handleImport = async () => {
    if (!preview) return;
    const validRows = preview.filter((r) => r.status === 'valid');
    if (validRows.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      const payload = validRows.map((r) => ({
        property_name: String(r.edited['Property Name']).trim(),
        unit_number: String(r.edited['Unit Number']).trim(),
        tenant_name: String(r.edited['Tenant Name']).trim(),
        phone: r.normalizedPhone ?? (String(r.edited['Phone'] ?? '').trim() || undefined),
        rent_amount: String(r.edited['Rent Amount']).trim(),
        lease_start: String(r.edited['Lease Start'] ?? '').trim() || null,
        lease_end: String(r.edited['Lease End'] ?? '').trim() || null,
      }));
      const res = await bulkImportTenants({ tenants: payload });
      setResult({ imported: res.imported, skipped: res.skipped + (preview.length - validRows.length), skippedRows: res.skippedRows });
      await onImported(res.tenants);
      // Keep preview but mark imported rows as done? Clear after success
      setPreview(null);
      setFileName(null);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const downloadSkipped = () => {
    if (!result?.skippedRows?.length && preview) {
      // download currently skipped (needs fixing) as CSV
      const skipped = preview.filter((r) => r.status === 'needs_fixing');
      if (skipped.length === 0) return;
      const rows = skipped.map((r) => ({
        'Property Name': r.edited['Property Name'],
        'Unit Number': r.edited['Unit Number'],
        'Tenant Name': r.edited['Tenant Name'],
        Phone: r.edited['Phone'],
        'Rent Amount': r.edited['Rent Amount'],
        'Lease Start': r.edited['Lease Start'],
        'Lease End': r.edited['Lease End'],
        Reason: r.reason,
      }));
      const safeRows = rows.map((r) => {
        const entries = Object.entries(r).map(([k, v]) => [k, csvSafeCell(v)]);
        return Object.fromEntries(entries);
      });
      const csv = Papa.unparse(safeRows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rent-sync-skipped-rows.csv';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (!result) return;
    const csv = Papa.unparse(
      result.skippedRows.map((r: any) => {
        const cells = {
          'Property Name': r.propertyName,
          'Unit Number': r.unitNumber,
          'Tenant Name': r.tenantName,
          Reason: r.reason,
        };
        return Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, csvSafeCell(v)]));
      })
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rent-sync-skipped-rows.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-3xl border border-[#2C2326] bg-[#161112] p-6 shadow-[0_12px_26px_rgba(0,0,0,0.4)]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-[#F6F2F3]">Bulk import tenants</h2>
        <button
          type="button"
          onClick={downloadTemplate}
          className="rounded-full border border-[#33282C] bg-[#161112] px-4 py-2 text-sm font-medium text-[#CFC5CA] hover:border-[#7A3B4C] hover:text-[#C65A70]"
        >
          Download template
        </button>
      </div>

      {!preview && !result && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center ${isDragging ? 'border-[#7A1428] bg-[#201A1C]' : 'border-[#3A2E32] bg-[#1C1618]'}`}
        >
          <p className="text-sm font-medium text-[#F6F2F3]">Import from spreadsheet</p>
          <p className="mt-1 text-xs text-[#A49DA1]">Accepts .csv and .xlsx — use the template headers (no column mapping yet).</p>
          <label className="mt-4 cursor-pointer rounded-full bg-[#7A1428] px-5 py-2 text-sm font-semibold text-white hover:bg-[#8E1A30]">
            Choose file
            <input type="file" accept=".csv,.xlsx" onChange={onFileInput} className="hidden" />
          </label>
          <p className="mt-2 text-xs text-[#8A8085]">Parsing happens in your browser — nothing is saved until you click Import.</p>
        </div>
      )}

      {error && <p className="mt-4 rounded-xl bg-[#2E1519] px-3 py-2 text-sm text-[#F08E9B]" role="alert">{error}</p>}
      {warning && <p className="mt-4 rounded-xl bg-[#2B2116] px-3 py-2 text-sm text-[#F2C060]">{warning}</p>}

      {preview && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-[#F6F2F3]">
              {summary?.valid} of {summary?.total} rows ready to import {fileName && <span className="font-normal text-[#A49DA1]">— {fileName}</span>}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setFileName(null);
                  setError(null);
                  setWarning(null);
                }}
                className="rounded-full border border-[#2A2225] bg-[#161112] px-4 py-1.5 text-sm font-medium text-[#C9C0C4]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={downloadSkipped}
                disabled={!preview.some((r) => r.status === 'needs_fixing') && !result?.skippedRows?.length}
                className="rounded-full border border-[#33282C] bg-[#161112] px-4 py-1.5 text-sm font-medium text-[#CFC5CA] disabled:opacity-50"
              >
                Download skipped CSV
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || (summary?.valid ?? 0) === 0}
                className="rounded-full bg-[#7A1428] px-5 py-1.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#8E1A30]"
              >
                {importing ? 'Importing...' : `Import ${summary?.valid} tenants`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#2C2326]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#221C1E] text-[#B5ABB0]">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Property Name</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2">Tenant Name</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Rent</th>
                  <th className="px-3 py-2">Lease Start</th>
                  <th className="px-3 py-2">Lease End</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.idx} className={row.status === 'valid' ? 'bg-[#161112]' : 'bg-[#2E1519]'}>
                    <td className="px-3 py-2 text-[#A49DA1]">{row.idx + 1}</td>
                    {(HEADERS as readonly string[]).map((h) => (
                      <td key={h} className="px-2 py-1">
                        <input
                          value={String(row.edited[h] ?? '')}
                          onChange={(e) => updateCell(row.idx, h as any, e.target.value)}
                          className={`w-full rounded border px-2 py-1 text-sm ${row.status === 'valid' ? 'border-[#2A2225] bg-[#161112]' : 'border-[#4A2127] bg-[#161112]'}`}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      {row.status === 'valid' ? (
                        <span className="rounded-full bg-[#14211B] px-2 py-1 text-xs font-semibold text-[#4ADE80]">Valid</span>
                      ) : (
                        <span className="rounded-full bg-[#33161B] px-2 py-1 text-xs font-semibold text-[#F08E9B]" title={row.reason}>
                          Needs fixing
                        </span>
                      )}
                      {row.status === 'needs_fixing' && <div className="mt-1 max-w-[200px] text-xs text-[#F47C8E]">{row.reason}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {importing && <div className="mt-3 flex items-center gap-2 text-sm text-[#A49DA1]"><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#3A3134] border-t-[#C65A70]" /> Importing in a single transaction…</div>}
        </div>
      )}

      {result && (
        <div className="mt-6 rounded-2xl border border-[#261F22] bg-[#141012] p-4">
          <p className="text-sm font-semibold text-[#F6F2F3]">{result.imported} tenants imported, {result.skipped} skipped</p>
          <p className="mt-1 text-xs text-[#A49DA1]">Valid rows were saved in one transaction per batch (tenant + unit occupied). Skipped rows were not saved.</p>
          {result.skipped > 0 && (
            <button type="button" onClick={downloadSkipped} className="mt-3 rounded-full bg-[#161112] px-4 py-1.5 text-sm font-medium text-[#C65A70] shadow-sm">
              Download skipped rows CSV
            </button>
          )}
          <button
            type="button"
            onClick={() => setResult(null)}
            className="ml-2 rounded-full px-4 py-1.5 text-sm text-[#B0A8AD]"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
