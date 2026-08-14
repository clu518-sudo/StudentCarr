import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../../contexts/ProfileContext';
import { useProgress } from '../../contexts/ProgressContext';

// Redesigned dashboard matching the StudentCarr reference: hero, metric cards,
// a "next actions" list, and a selected-detail panel. Metrics use real
// application/profile data where available; the action list provides guided
// navigation shortcuts into existing routes (no backend contracts changed).
const DashboardView = () => {
  const navigate = useNavigate();
  const { manualProfile, ensureProfileLoaded } = useProfile();
  const {
    applications,
    ensureProgressLoaded,
    handleSyncMailbox,
    isSyncRunning,
    gmailConnected,
  } = useProgress();

  useEffect(() => {
    ensureProfileLoaded?.();
    ensureProgressLoaded?.();
  }, [ensureProfileLoaded, ensureProgressLoaded]);

  const applicationsCount = applications?.length || 0;
  const skillsCount = manualProfile?.skills?.length || 0;
  const projectsCount = manualProfile?.projects?.length || 0;

  const metrics = [
    {
      label: 'Applications',
      value: applicationsCount,
      hint: gmailConnected ? 'Tracked from Gmail' : 'Connect Gmail to track',
    },
    {
      label: 'Job matches',
      value: '—',
      hint: 'Run job discovery',
    },
    {
      label: 'Skills',
      value: skillsCount,
      hint: skillsCount ? 'On your profile' : 'Add skills to your profile',
    },
    {
      label: 'Projects',
      value: projectsCount,
      hint: projectsCount ? 'Strengthen with metrics' : 'Add projects',
    },
  ];

  const actions = useMemo(
    () => [
      {
        id: 'invite',
        dot: 'yellow',
        title: 'Reply to interview invitations',
        meta: 'Progress · review and confirm drafts',
        detail:
          'Review incoming interview invitations, edit the suggested reply, and confirm before anything is sent.',
        progress: 65,
        cta: 'Open Progress',
        to: '/progress',
      },
      {
        id: 'resume',
        dot: 'blue',
        title: 'Tailor resume for your next application',
        meta: 'Applications · use profile context',
        detail:
          'Use the resume builder to tailor your resume to a specific role using your saved profile context.',
        progress: 40,
        cta: 'Open Resume Builder',
        to: '/applications/resume-builder',
      },
      {
        id: 'jobs',
        dot: 'green',
        title: 'Review new job matches',
        meta: 'Jobs · sort by skill overlap',
        detail:
          'Explore matched opportunities and compare fit against your skills and preferences.',
        progress: 20,
        cta: 'Open Jobs',
        to: '/jobs',
      },
      {
        id: 'metrics',
        dot: 'red',
        title: 'Add metrics to your project descriptions',
        meta: 'Profile · improves resume and interviews',
        detail:
          'Quantified project outcomes make your resume stronger and give the assistant better context.',
        progress: 30,
        cta: 'Open Profile',
        to: '/profile',
      },
    ],
    [],
  );

  const [selectedActionId, setSelectedActionId] = useState(actions[0].id);
  const selectedAction =
    actions.find((action) => action.id === selectedActionId) || actions[0];

  const dotEmoji = { yellow: '🟡', blue: '🔵', green: '🟢', red: '🔴' };

  return (
    <div>
      <div className="sc-topbar" style={{ position: 'static', border: 0, padding: 0, background: 'transparent', backdropFilter: 'none', marginBottom: 20 }}>
        <div className="sc-page-head" style={{ marginBottom: 0 }}>
          <h1>Dashboard</h1>
          <p className="sc-subtitle">
            Your central workspace to manage your career journey.
          </p>
        </div>
        <button
          type="button"
          className="sc-btn"
          onClick={handleSyncMailbox}
          disabled={!gmailConnected || isSyncRunning}
          title={gmailConnected ? 'Sync progress from Gmail' : 'Connect Gmail in Progress to enable syncing'}
        >
          {isSyncRunning ? '↻ Syncing…' : '↻ Sync progress'}
        </button>
      </div>

      <section className="sc-hero">
        <div>
          <h2>Today’s career command center</h2>
          <p>
            The dashboard stays visual and structured while the assistant guides
            actions on the right.
          </p>
        </div>
        <div className="sc-hero-art" aria-hidden="true">
          <div className="sc-bars">
            <span />
            <span />
            <span />
          </div>
          <div className="sc-target" />
        </div>
      </section>

      <section className="sc-metrics">
        {metrics.map((metric) => (
          <div key={metric.label} className="sc-card sc-metric">
            <div className="sc-metric-label">{metric.label}</div>
            <div className="sc-metric-value">{metric.value}</div>
            <small>{metric.hint}</small>
          </div>
        ))}
      </section>

      <section className="sc-workspace-grid">
        <div className="sc-card">
          <h3>Your next actions</h3>
          {actions.map((action) => {
            const isSelected = action.id === selectedActionId;
            return (
              <button
                key={action.id}
                type="button"
                className={`sc-task${isSelected ? ' is-selected' : ''}`}
                onClick={() => setSelectedActionId(action.id)}
              >
                <span className={`sc-dot ${action.dot}`} />
                <span>
                  <span className="sc-task-title" style={{ display: 'block' }}>
                    {action.title}
                  </span>
                  <span className="sc-task-meta">{action.meta}</span>
                </span>
                <span className="sc-chevron">›</span>
              </button>
            );
          })}
        </div>

        <div className="sc-card">
          <h3>Selected detail</h3>
          <div className="sc-task-title">
            {dotEmoji[selectedAction.dot]} {selectedAction.title}
          </div>
          <p className="sc-detail-copy">{selectedAction.detail}</p>
          <div className="sc-progress-row">
            <div className="sc-progress">
              <span style={{ width: `${selectedAction.progress}%` }} />
            </div>
            <strong>{selectedAction.progress}%</strong>
          </div>
          <p className="sc-detail-note">
            The assistant can draft and explain, but actions like sending still
            happen after your confirmation.
          </p>
          <button
            type="button"
            className="sc-btn sc-btn-primary sc-full"
            onClick={() => navigate(selectedAction.to)}
          >
            {selectedAction.cta}
          </button>
        </div>
      </section>
    </div>
  );
};

export default DashboardView;
