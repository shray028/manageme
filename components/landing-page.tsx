import { ArrowRight, BookOpen, Check, Cloud, LogIn, Moon, ShieldCheck, Sun, Target } from 'lucide-react';
import { useSiteTheme } from '@/lib/site-theme';
import { BrandLogo } from './brand-logo';

function chooseDsa() {
  try {
    localStorage.setItem('manageme:start', 'dsa');
  } catch {
    // The link still works when browser storage is unavailable.
  }
}

export function LandingPage({ onSignIn, busy, error }: { onSignIn: () => void; busy: boolean; error: string }) {
  const [theme, toggleTheme] = useSiteTheme();
  return (
    <main className="landing-root" data-theme={theme}>
      <header className="landing-header">
        <a href="#/" aria-label="ManageMe home"><BrandLogo compact /></a>
        <nav aria-label="Main navigation" className="landing-nav">
          <a href="#paths">Explore</a>
          <a href="#your-data">Your data</a>
          <a href="#/dsa" onClick={chooseDsa}>DSA practice</a>
        </nav>
        <div className="landing-header-actions">
          <button type="button" className="landing-theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}</button>
          <button type="button" className="landing-signin" onClick={onSignIn} disabled={busy}>
            <LogIn size={16} aria-hidden /> {busy ? 'Opening Google…' : 'Sign in'}
          </button>
        </div>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow"><span className="landing-eyebrow-dot" /> A LITTLE SPACE TO MOVE FORWARD</p>
          <h1 id="landing-title">Make room for <em>meaningful progress.</em></h1>
          <p className="landing-lead">Choose a trusted DSA sheet, solve one problem at a time, and keep your code, notes and revisions together.</p>
          <div className="landing-actions">
            <a className="landing-primary" href="#/dsa" onClick={chooseDsa}>Track DSA practice <ArrowRight size={18} aria-hidden /></a>
            <button type="button" className="landing-secondary" onClick={onSignIn} disabled={busy}>{busy ? 'Opening Google…' : 'Continue with Google'} <LogIn size={17} aria-hidden /></button>
          </div>
          <p className="landing-assurance"><ShieldCheck size={16} aria-hidden /> Your work is saved to your account, with a backup option for DSA notes.</p>
          {error && <p className="landing-error" role="alert">{error}</p>}
        </div>

        <div className="landing-preview" aria-label="Illustration of DSA practice">
          <div className="landing-preview-top">
            <span className="landing-preview-brand"><span className="landing-preview-mark">✦</span> DSA practice</span>
            <span className="landing-preview-date">YOUR PACE</span>
          </div>
          <div className="landing-preview-body">
            <div className="landing-preview-main">
              <p className="landing-mini-label">YOUR SHEET</p>
              <h2>One problem at a time.</h2>
              <p className="landing-preview-subtitle">Your next step is always clear.</p>
              <div className="landing-preview-card">
                <div className="landing-preview-card-top"><strong>Arrays and hashing</strong><span>01 / 03</span></div>
                <div className="landing-preview-task"><span className="landing-radio is-checked"><Check size={12} strokeWidth={3} aria-hidden /></span><span>Two Sum</span><small>Done</small></div>
                <div className="landing-preview-task"><span className="landing-radio" /><span>Valid Anagram</span><small>Next</small></div>
                <div className="landing-preview-task"><span className="landing-radio" /><span>Contains Duplicate</span><small>Later</small></div>
              </div>
              <div className="landing-preview-note"><Target size={17} aria-hidden /><span>Every solved problem counts.</span></div>
            </div>
            <aside className="landing-preview-side">
              <p className="landing-mini-label">REVISION</p>
              <h3>Keep the lesson.</h3>
              <p>Your approach and mistakes stay close for the next attempt.</p>
              <div className="landing-preview-problem"><span className="landing-radio" /><span>Review Two Sum</span><ArrowRight size={15} aria-hidden /></div>
              <div className="landing-preview-progress"><span /></div>
              <p className="landing-preview-side-foot">Code, notes and links stay with each problem.</p>
            </aside>
          </div>
          <span className="landing-preview-caption">Illustrative preview</span>
        </div>
      </section>

      <section id="paths" className="landing-section landing-paths" aria-labelledby="paths-title">
        <div className="landing-section-heading"><p className="landing-mini-label">A CLEAR PLACE TO START</p><h2 id="paths-title">Practice with purpose.</h2><p>Everything you need for the next attempt and the next revision.</p></div>
        <div className="landing-path-grid">
          <a className="landing-path-card" href="#/dsa" onClick={chooseDsa}>
            <span className="landing-path-icon"><BookOpen size={22} aria-hidden /></span>
            <span className="landing-path-kicker">FOLLOW A TRUSTED PATH</span>
            <strong>Choose a sheet</strong>
            <span>Follow A2Z, NeetCode 150, and other structured sheets. See what is next and pick up where you left off.</span>
            <span className="landing-path-link">Explore practice sheets <ArrowRight size={17} aria-hidden /></span>
          </a>
          <a className="landing-path-card" href="#/dsa" onClick={chooseDsa}>
            <span className="landing-path-icon is-cyan"><Target size={22} aria-hidden /></span>
            <span className="landing-path-kicker">MAKE LEARNING STICK</span>
            <strong>Save what you learned</strong>
            <span>Keep your solution, mistakes and useful links beside each problem, then return when it is time to revise.</span>
            <span className="landing-path-link">Start practising <ArrowRight size={17} aria-hidden /></span>
          </a>
        </div>
      </section>

      <section id="your-data" className="landing-section landing-data" aria-labelledby="data-title">
        <div><p className="landing-mini-label">BUILT TO STAY WITH YOU</p><h2 id="data-title">Your progress belongs to you.</h2><p>Sign in with Google to return to the same work across devices. DSA edits are kept on this device while they wait to save, and you can download a backup of your lists and notes.</p></div>
        <div className="landing-data-badges"><span><Cloud size={19} aria-hidden /> Saved to your account</span><span><ShieldCheck size={19} aria-hidden /> Private to your sign-in</span></div>
      </section>

      <footer className="landing-footer"><BrandLogo compact /><span>Make progress feel possible.</span></footer>
    </main>
  );
}
