'use client';

import Link from 'next/link';
import { CalendarCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { EmptyState, Loading, PageHeader, StatusBadge, useAction } from '@/components/ui';
import { formatDateTime } from '@/lib/format';

interface Appointment {
  id: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  startsAt: string;
  status: string;
  notes: string | null;
  callId: string | null;
  externalEventUrl: string | null;
}

export default function AppointmentsPage() {
  const { data, reload } = useApi<{ appointments: Appointment[] }>('/app/appointments');
  const { run } = useAction();
  if (!data) return <Loading />;
  const now = Date.now();
  const upcoming = data.appointments.filter((a) => new Date(a.startsAt).getTime() >= now);
  const past = data.appointments.filter((a) => new Date(a.startsAt).getTime() < now).reverse();

  const setStatus = (id: string, status: string) =>
    run(async () => {
      await api(`/app/appointments/${id}`, { method: 'PATCH', body: { status } });
      await reload();
    }, 'Appointment updated');

  const list = (items: Appointment[]) => (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Who</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id}>
              <td className="whitespace-nowrap font-semibold">{formatDateTime(a.startsAt)}</td>
              <td>
                <p className="font-medium">{a.contactName}</p>
                <p className="num text-xs text-muted">
                  {a.contactPhone}
                  {a.contactEmail ? ` · ${a.contactEmail}` : ''}
                </p>
                {a.notes && <p className="mt-1 max-w-md text-xs text-ink-soft">{a.notes}</p>}
              </td>
              <td>
                <StatusBadge status={a.status} />
              </td>
              <td className="whitespace-nowrap text-right">
                {a.callId && (
                  <Link href={`/dashboard/calls/${a.callId}`} className="btn btn-ghost btn-sm">
                    Call
                  </Link>
                )}
                {a.status === 'SCHEDULED' && (
                  <>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setStatus(a.id, 'COMPLETED')}
                    >
                      Mark held
                    </button>
                    <button
                      className="btn btn-ghost btn-sm text-danger"
                      onClick={() => setStatus(a.id, 'CANCELED')}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Appointments"
        description="Meetings your agents booked. Linked calendars get the event automatically."
      />
      {data.appointments.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No appointments yet"
          body="Turn on appointment booking for an agent and connect Google Calendar."
          action={
            <Link href="/dashboard/agents" className="btn btn-primary">
              Open agents
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="mb-3 font-semibold">Upcoming</h2>
            {upcoming.length ? (
              list(upcoming)
            ) : (
              <p className="text-sm text-muted">Nothing upcoming.</p>
            )}
          </div>
          {past.length > 0 && (
            <div>
              <h2 className="mb-3 font-semibold">Past 30 days</h2>
              {list(past)}
            </div>
          )}
        </div>
      )}
    </>
  );
}
