import { useDashboard } from '../context';
import { Badge, Button, Card, CardHeader, EmptyState, ListSkeleton } from '../ui';

export function ChannelsPage() {
  const d = useDashboard();

  return (
    <Card>
      <CardHeader
        title="Payment channels (PayHero)"
        count={`${d.paymentChannels.length} registered`}
        subtitle="The Paybills, Tills and bank accounts tenants can pay into."
        actions={
          <>
            <Button variant="secondary" onClick={() => void d.loadPaymentChannels()}>
              Refresh
            </Button>
            <Button variant="primary" onClick={() => d.openModal('add-channel')}>
              Add payment channel
            </Button>
          </>
        }
      />

      <div className="space-y-3 p-5">
        {d.paymentChannelError && (
          <p role="alert" className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-text)]">
            {d.paymentChannelError}
          </p>
        )}

        {d.dataLoading && d.paymentChannels.length === 0 ? (
          <ListSkeleton />
        ) : d.paymentChannels.length === 0 ? (
          <EmptyState
            title="No payment channels yet"
            description="Register a Paybill, Till or Bank channel — PayHero requires an ownership-confirmation step before incoming payments activate."
            action={
              <Button variant="primary" onClick={() => d.openModal('add-channel')}>
                Add payment channel
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {d.paymentChannels.map((channel) => (
              <li
                key={channel.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-subtle p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-heading">
                      {channel.description || channel.short_code}
                    </span>
                    <Badge tone="accent">{channel.channel_type}</Badge>
                    <Badge tone={channel.verification_status === 'active' ? 'success' : 'warning'}>
                      {channel.verification_status}
                    </Badge>
                    {!channel.is_active && <Badge tone="neutral">deactivated</Badge>}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted">
                    Short code: {channel.short_code}
                    {channel.payhero_channel_id
                      ? ` · PayHero channel id: ${channel.payhero_channel_id}`
                      : ' · not yet confirmed by PayHero'}
                    {channel.account_number ? ` · Acct: ${channel.account_number}` : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    className="min-h-11 px-3 text-xs"
                    onClick={() => void d.handlePaymentChannelSync(channel.id)}
                  >
                    Sync status
                  </Button>
                  <Button
                    variant={channel.is_active ? 'primary' : 'secondary'}
                    className="min-h-11 px-3 text-xs"
                    onClick={() => void d.handlePaymentChannelToggle(channel)}
                  >
                    {channel.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="danger"
                    className="min-h-11 px-3 text-xs"
                    onClick={() => void d.handlePaymentChannelDelete(channel)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
