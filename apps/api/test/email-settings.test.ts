import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  row: null as null | { value: unknown; updatedAt: Date },
  verify: vi.fn(async () => true),
  sent: [] as Array<Record<string, unknown>>,
  transports: [] as Array<Record<string, any>>,
}));

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    siteSetting: {
      findUnique: async () => h.row,
      upsert: async ({ create }: { create: { value: unknown } }) => {
        h.row = { value: create.value, updatedAt: new Date() };
      },
      deleteMany: async () => {
        h.row = null;
      },
    },
  },
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: (opts: Record<string, any>) => {
      h.transports.push(opts);
      return {
        verify: h.verify,
        sendMail: async (m: Record<string, unknown>) => {
          h.sent.push(m);
        },
        close() {},
      };
    },
  },
}));

import {
  clearEmailSettings,
  currentMailServer,
  emailSettingsView,
  saveEmailSettings,
} from '../src/services/email-settings';
import { sendMailStrict } from '../src/lib/mailer';

const input = {
  host: 'smtp.example.com',
  port: 587,
  secure: false,
  username: 'mailer@example.com',
  password: 'hunter2',
  from: 'Purple Voice <no-reply@example.com>',
  supportEmails: 'help@example.com, ops@example.com',
};

beforeEach(async () => {
  h.row = null;
  h.sent = [];
  h.transports = [];
  h.verify.mockClear();
  h.verify.mockResolvedValue(true);
  await clearEmailSettings();
});

describe('platform email settings', () => {
  it('uses the saved server, and never stores the password in plain text', async () => {
    await saveEmailSettings(input);
    expect(JSON.stringify(h.row?.value)).not.toContain('hunter2');
    const server = await currentMailServer();
    expect(server).toMatchObject({
      host: 'smtp.example.com',
      user: 'mailer@example.com',
      pass: 'hunter2',
      from: 'Purple Voice <no-reply@example.com>',
    });
    const view = await emailSettingsView();
    expect(view).toMatchObject({ source: 'database', hasPassword: true });
    expect(JSON.stringify(view)).not.toContain('hunter2');
  });

  it('keeps the saved password when the field is left blank', async () => {
    await saveEmailSettings(input);
    await saveEmailSettings({ ...input, password: '', port: 465, secure: true });
    expect((await currentMailServer())?.pass).toBe('hunter2');
  });

  it('drops the saved password when the username changes and none is given', async () => {
    await saveEmailSettings(input);
    await saveEmailSettings({ ...input, username: 'other@example.com', password: '' });
    expect((await currentMailServer())?.pass).toBeUndefined();
  });

  it('refuses to save settings the server rejects', async () => {
    h.verify.mockRejectedValueOnce(new Error('Invalid login'));
    await expect(saveEmailSettings(input)).rejects.toThrow(/Could not sign in to smtp.example.com/);
    expect(h.row).toBeNull();
  });

  it('sends mail through the saved server', async () => {
    await saveEmailSettings(input);
    const r = await sendMailStrict({ to: 'a@b.co', subject: 'Hi', text: 'Hello' });
    expect(r.sent).toBe(true);
    expect(h.sent[0]).toMatchObject({ to: 'a@b.co', from: 'Purple Voice <no-reply@example.com>' });
  });

  it('reports that nothing was sent when no server is set up', async () => {
    const r = await sendMailStrict({ to: 'a@b.co', subject: 'Hi', text: 'Hello' });
    expect(r.sent).toBe(false);
    expect(h.sent).toHaveLength(0);
  });
});
