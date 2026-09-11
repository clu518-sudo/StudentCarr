import React from 'react';

// Shared presentation shell for authentication screens. It intentionally owns
// only branding and layout; each auth view keeps its existing form state,
// submission handlers, redirects, and API calls.
const AuthShell = ({ children, eyebrow = 'Career workspace' }) => (
  <main className="sc-auth sc-dark">
    <div className="sc-auth-shell">
      <section className="sc-auth-story" aria-label="About StudentCarr">
        <div className="sc-auth-brand">
          <div className="sc-auth-logo" aria-hidden="true">SC</div>
          <span>StudentCarr</span>
        </div>

        <div className="sc-auth-story-copy">
          <p className="sc-auth-eyebrow">{eyebrow}</p>
          <h1>Build your next career move with clarity.</h1>
          <p>
            Keep your profile, applications, progress, and interview preparation
            in one focused workspace.
          </p>
        </div>

        <div className="sc-auth-proof" aria-label="StudentCarr highlights">
          <div>
            <span aria-hidden="true">01</span>
            <p>One place for your career context</p>
          </div>
          <div>
            <span aria-hidden="true">02</span>
            <p>Guided next steps that stay actionable</p>
          </div>
          <div>
            <span aria-hidden="true">03</span>
            <p>You stay in control of every action</p>
          </div>
        </div>
      </section>

      <section className="sc-auth-form-panel">
        <div className="sc-auth-mobile-brand" aria-label="StudentCarr">
          <div className="sc-auth-logo" aria-hidden="true">SC</div>
          <span>StudentCarr</span>
        </div>
        {children}
        <p className="sc-auth-footer">A focused career workspace for students.</p>
      </section>
    </div>
  </main>
);

export default AuthShell;
