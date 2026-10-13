import { useEffect, useState } from 'react';
import { LandingPage } from '@/components/landing-page';
import { signIn, useAppUser } from '@/lib/dsa/auth';

/**
 * The public front page. It only ever leads to DSA practice: signed-in people go straight there,
 * and signing in from here lands on DSA too. The older workspace is not reachable.
 */
export default function FrontDoor() {
  const user = useAppUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'ManageMe · DSA practice';
    if (user) window.location.replace('#/dsa');
  }, [user]);

  if (user !== null)
    return (
      <p role="status" style={{ padding: '6rem 1rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        Loading…
      </p>
    );

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      await signIn();
    } catch (problem) {
      const code = (problem as { code?: string })?.code ?? '';
      // Closing the Google window is a choice, not an error.
      if (!code.includes('popup-closed') && !code.includes('cancelled-popup')) setError('Sign-in didn’t finish. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return <LandingPage onSignIn={() => void start()} busy={busy} error={error} />;
}
