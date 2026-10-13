import { ArrowRight, BookOpen, Check, Cloud, LogIn, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { BrandLogo } from './brand-logo';

function chooseDsa() {
  try {
    localStorage.setItem('manageme:start', 'dsa');
  } catch {
    // The link still works when browser storage is unavailable.
  }
}

export function LandingPage({ onSignIn, busy, error }: { onSignIn: () => void; busy: boolean; error: string }) {
  return (
    <main className="landing-root">
      <header className="landing-header">
        <a href="#/" aria-label="ManageMe home"><BrandLogo compact /></a>
        <nav aria-label="Main navigation" className="landing-nav">
          <a href="#paths">Explore</a>
          <a href="#your-data">Your data</a>
          <a href="#/dsa" onClick={chooseDsa}>DSA practice</a>
        </nav>
        <button type="button" className="landing-signin" onClick={onSignIn} disabled={busy}>
          <LogIn size={16} aria-hidden /> {busy ? 'Opening Google…' : 'Sign in'}
        </button>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow"><span className="landing-eyebrow-dot" /> A LITTLE SPACE TO MOVE FORWARD</p>
          <h1 id="landing-title">Make room for <em>meaningful progress.</em></h1>
          <p className="landing-lead">Plan your day, stay with one task, and keep your DSA practice together. ManageMe gives the important things a clear place to live.</p>
          <div className="landing-actions">
            <a className="landing-primary" href="#/dsa" onClick={chooseDsa}>Track DSA practice <ArrowRight size={18} aria-hidden /></a>
            <button type="button" className="landing-secondary" onClick={onSignIn} disabled={busy}>{busy ? 'Opening Google…' : 'Continue with Google'} <LogIn size={17} aria-hidden /></button>
          </div>
          <p className="landing-assurance"><ShieldCheck size={16} aria-hidden /> Your work is saved to your account, with a backup option for DSA notes.</p>
          {error && <p className="landing-error" role="alert">{error}</p>}
        </div>

        <div className="landing-preview" aria-label="Illustration of a ManageMe workspace">
          <div className="landing-preview-top">
            <span className="landing-preview-brand"><span className="landing-preview-mark">✦</span> A clearer day</span>
            <span className="landing-preview-date">YOUR SPACE</span>
          </div>
          <div className="landing-preview-body">
            <div className="landing-preview-main">
              <p className="landing-mini-label">TODAY</p>
              <h2>One thing at a time.</h2>
              <p className="landing-preview-subtitle">A plan you can actually see through.</p>
              <div className="landing-preview-card">
                <div className="landing-preview-card-top"><strong>Your focus</strong><span>01 / 03</span></div>
                <div className="landing-preview-task"><span className="landing-radio is-checked"><Check size={12} strokeWidth={3} aria-hidden /></span><span>Decide what matters most</span><small>Done</small></div>
                <div className="landing-preview-task"><span className="landing-radio" /><span>Make focused progress</span><small>Next</small></div>
                <div className="landing-preview-task"><span className="landing-radio" /><span>Notice what you learned</span><small>Later</small></div>
              </div>
              <div className="landing-preview-note"><Target size={17} aria-hidden /><span>Small steps still count.</span></div>
            </div>
            <aside className="landing-preview-side">
              <p className="landing-mini-label">DSA PRACTICE</p>
              <h3>Your next problem</h3>
              <p>Pick a sheet. Solve. Revise. Keep your approach close.</p>
              <div className="landing-preview-problem"><span className="landing-radio" /><span>Two Sum</span><ArrowRight size={15} aria-hidden /></div>
              <div className="landing-preview-progress"><span /></div>
              <p className="landing-preview-side-foot">Code, notes and links stay with each problem.</p>
            </aside>
          </div>
          <span className="landing-preview-caption">Illustrative preview</span>
        </div>
      </section>

      <section id="paths" className="landing-section landing-paths" aria-labelledby="paths-title">
        <div className="landing-section-heading"><p className="landing-mini-label">CHOOSE YOUR WAY IN</p><h2 id="paths-title">Two ways to find your rhythm.</h2><p>Start with what you need today. Both live in the same ManageMe account.</p></div>
        <div className="landing-path-grid">
          <a className="landing-path-card" href="#/dsa" onClick={chooseDsa}>
            <span className="landing-path-icon"><BookOpen size={22} aria-hidden /></span>
            <span className="landing-path-kicker">PRACTICE WITH INTENTION</span>
            <strong>DSA practice</strong>
            <span>Follow A2Z, NeetCode 150, or your own list. Track solutions, revisions, mistakes and useful links in one place.</span>
            <span className="landing-path-link">Open DSA practice <ArrowRight size={17} aria-hidden /></span>
          </a>
          <button type="button" className="landing-path-card" onClick={onSignIn} disabled={busy}>
            <span className="landing-path-icon is-cyan"><Sparkles size={22} aria-hidden /></span>
            <span className="landing-path-kicker">MAKE SPACE FOR TODAY</span>
            <strong>Your workspace</strong>
            <span>Keep tasks, a small habit, focus time and projects together, with your 60-day roadmap close at hand.</span>
            <span className="landing-path-link">Open your workspace <ArrowRight size={17} aria-hidden /></span>
          </button>
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
