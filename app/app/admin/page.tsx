import { redirect } from 'next/navigation';

export default function Admin() {
  // Redirect to admin calibrate page by default
  redirect('/admin/calibrate');
}
