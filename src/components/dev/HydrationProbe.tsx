import { useEffect, useState } from 'react';

/** Spike: proves a React island hydrates under the strict CSP. Removed once the editor island exists. */
export default function HydrationProbe() {
  const [hydrated, setHydrated] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the probe's whole job is to flip after hydration
  useEffect(() => setHydrated(true), []);
  return <p data-testid="hydration-probe">{hydrated ? 'hydrated' : 'static'}</p>;
}
