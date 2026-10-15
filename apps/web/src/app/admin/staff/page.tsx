'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useSession } from '@/lib/session';
import { Loading, Modal, PageHeader, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';
import { formatRelative } from '@/lib/format';

interface Staff {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  suspended: boolean;
  lastLoginAt: string | null;
}

export default function StaffPage() {
  const { me } = useSession();
  const { data, reload } = useApi<{ staff: Staff[] }>('/admin/super/staff');
  const [open, setOpen] = useState(false);
  const { busy, run } = useAction();
  const update = (id: string, body: Record<string, unknown>) =>
    run(async () => {
      await api(`/admin/super/staff/${id}`, { method: 'PATCH', body });
      await reload();
    }, 'Updated');

  return (
    <>
      <PageHeader
        title="Staff"
        description="Admins manage customers, content and support. Super admins also see revenue and manage plans, staff and security."
        actions={
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <Plus size={16} aria-hidden="true" /> Add staff
          </button>
        }
      />
      {!data ? (
        <Loading />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col">Role</th>
                <th scope="col">Last sign-in</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.staff.map((s) => {
                const self = s.id === me?.user.id;
                return (
                  <tr key={s.id}>
                    <td>
                      <p className="font-semibold">
                        {s.name}
                        {self && <span className="ml-2 text-xs text-muted">(you)</span>}
                      </p>
                      <p className="text-xs text-muted">{s.email}</p>
                    </td>
                    <td>
                      <select
                        className="select h-9 w-auto"
                        aria-label={`Role for ${s.name}`}
                        value={s.role}
                        disabled={self || busy}
                        onChange={(e) => update(s.id, { role: e.target.value })}
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="SUPER_ADMIN">Super admin</option>
                      </select>
                    </td>
                    <td className="text-muted">{formatRelative(s.lastLoginAt)}</td>
                    <td className="text-right">
                      {!self && (
                        <button
                          className={
                            s.suspended
                              ? 'btn btn-secondary btn-sm'
                              : 'btn btn-ghost btn-sm text-danger'
                          }
                          disabled={busy}
                          onClick={() => update(s.id, { suspended: !s.suspended })}
                        >
                          {s.suspended ? 'Restore access' : 'Suspend'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add a staff member">
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget));
            const ok = await run(async () => {
              await api('/admin/super/staff', { body: f });
              return true;
            }, 'Staff member added');
            if (ok) {
              setOpen(false);
              await reload();
            }
          }}
        >
          <Field id="name" label="Name">
            <input id="name" name="name" className="input" required />
          </Field>
          <Field id="email" label="Email">
            <input id="email" name="email" type="email" className="input" required />
          </Field>
          <Field id="role" label="Role">
            <select id="role" name="role" className="select" defaultValue="ADMIN">
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super admin</option>
            </select>
          </Field>
          <Field
            id="password"
            label="Temporary password"
            help="Share it securely; they should change it after signing in."
          >
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              required
              minLength={10}
              autoComplete="new-password"
            />
          </Field>
          <button className="btn btn-primary w-full" disabled={busy}>
            Add
          </button>
        </form>
      </Modal>
    </>
  );
}
