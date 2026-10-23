import { Link } from 'react-router-dom';
import DecryptedText from '../components/rb/DecryptedText';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center py-32 text-center">
      <p className="font-display text-8xl font-bold tracking-tighter text-accent">
        <DecryptedText text="404" animateOn="view" sequential speed={60} />
      </p>
      <p className="mt-4 font-display text-2xl font-bold">This track skipped a beat</p>
      <p className="mt-2 text-ink-3">The page you're looking for doesn't exist.</p>
      <Link to="/" className="mt-8 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:scale-105">
        Back to Home
      </Link>
    </div>
  );
}
