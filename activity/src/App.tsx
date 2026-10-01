import { useCallback, useEffect, useState } from 'react';
import type { HomeSummary } from '../../src/features/activity/activity.types';
import { Backdrop } from './components/Backdrop';
import { BottomNav, Sidebar } from './components/Navigation';
import { PackTheater } from './components/theater/PackTheater';
import { ErrorScreen, SplashScreen } from './components/Screens';
import { fetchHome } from './lib/api';
import { startLive } from './lib/live';
import { connect, describeError, type Session } from './lib/session';
import { SECTIONS, type SectionId } from './navigation';
import { ComingSoon } from './pages/ComingSoon';
import { Home } from './pages/Home';
import { Packs } from './pages/Packs';

type State = { status: 'loading' } | { status: 'error'; message: string; detail: string } | { status: 'ready'; session: Session; home: HomeSummary };

export function App() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [section, setSection] = useState<SectionId>('home');

  const start = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const session = await connect();
      setState({ status: 'ready', session, home: await fetchHome(session) });
    } catch (error) {
      console.error(error);
      setState({ status: 'error', message: 'La connexion avec Discord a échoué. Vérifie ta connexion puis réessaie.', detail: describeError(error) });
    }
  }, []);

  useEffect(() => {
    void start();
  }, [start]);

  const session = state.status === 'ready' ? state.session : null;
  const user = state.status === 'ready' ? state.home.user : null;

  useEffect(() => {
    if (session && user) return startLive(session, user);
  }, [session, user?.id]);

  const refreshHome = useCallback(() => {
    if (!session) return;
    void fetchHome(session).then(home => setState({ status: 'ready', session, home }));
  }, [session]);

  return (
    <>
      <Backdrop />
      {state.status === 'loading' && <SplashScreen />}
      {state.status === 'error' && <ErrorScreen message={state.message} detail={state.detail} onRetry={start} />}
      {state.status === 'ready' && (
        <div className="flex h-full">
          <Sidebar active={section} onSelect={setSection} user={state.home.user} />
          <main className="min-w-0 flex-1 overflow-y-auto px-4 pb-28 pt-5 md:px-8 md:pb-8">
            {state.session.mode === 'preview' && (
              <p className="mb-4 inline-block rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-200">
                Aperçu hors Discord — données d'exemple
              </p>
            )}
            <div className="mx-auto max-w-6xl">
              {section === 'home' ? (
                <Home home={state.home} onNavigate={setSection} />
              ) : section === 'packs' ? (
                <Packs session={state.session} />
              ) : (
                <ComingSoon key={section} section={SECTIONS.find(s => s.id === section)!} />
              )}
            </div>
          </main>
          <BottomNav active={section} onSelect={setSection} />
          <PackTheater me={state.home.user} mapboxToken={state.session.config.mapboxToken} onOwnShowEnd={refreshHome} />
        </div>
      )}
    </>
  );
}
