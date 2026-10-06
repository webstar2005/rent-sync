// Every amount in this product is Kenyan shillings. Formatting in one place keeps the symbol
// consistent and groups thousands, which matters once a landlord is looking at six figures of rent.
export function kes(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
