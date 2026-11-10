import { redirect } from 'next/navigation';

/** Website traffic is the admin dashboard now. */
export default function Page() {
  redirect('/admin');
}
