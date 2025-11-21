import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to calibrate page by default
  redirect('/calibrate');
}
