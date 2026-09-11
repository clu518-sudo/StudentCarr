import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../../contexts/ProfileContext';
import { useProgress } from '../../contexts/ProgressContext';
import InterfaceIcon from '../common/InterfaceIcon';

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
      icon: 'applications',
      value: applicationsCount,
      hint: gmailConnected ? 'Tracked from Gmail' : 'Connect Gmail to track',
    },
    {
      label: 'Job matches',
      icon: 'jobs',
      value: '—',
      hint: 'Run job discovery',
    },
    {
      label: 'Skills',
      icon: 'skills',
      value: skillsCount,
      hint: skillsCount ? 'On your profile' : 'Add skills to your profile',
    },
    {
      label: 'Projects',
      icon: 'projects',
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

  return (
    <div className="sc-dashboard">
      <div className="sc-dashboard-heading">
        <div className="sc-page-head">
          <p className="sc-eyebrow">Your overview</p>
          <h1>Dashboard</h1>
          <p className="sc-subtitle">
            A little progress today. More possibilities tomorrow.
          </p>
        </div>
        <button
          type="button"
          className="sc-btn"
          onClick={handleSyncMailbox}
          disabled={!gmailConnected || isSyncRunning}
          aria-busy={isSyncRunning}
          title={gmailConnected ? 'Sync progress from Gmail' : 'Connect Gmail in Progress to enable syncing'}
        >
          <InterfaceIcon name="sync" className={isSyncRunning ? 'sc-spin' : ''} />
          {isSyncRunning ? 'Syncing…' : 'Sync progress'}
        </button>
      </div>

      <section className="sc-hero">
        <div>
          <p className="sc-hero-eyebrow">Small steps. Real momentum.</p>
          <h2>Make your next move.</h2>
          <p>
            Build your story, follow your applications, and get ready for
            what comes next. Your career starts here.
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
          <div key={metric.label} className={`sc-card sc-metric sc-metric-${metric.icon}`}>
            <div className="sc-metric-heading">
              <div className="sc-metric-label">{metric.label}</div>
              <span className="sc-metric-icon"><InterfaceIcon name={metric.icon} /></span>
            </div>
            <div className="sc-metric-value">{metric.value}</div>
            <small>{metric.hint}</small>
          </div>
        ))}
      </section>

      <section className="sc-workspace-grid">
        <div className="sc-card sc-actions-card">
          <div className="sc-section-heading">
            <h3>Your next actions</h3>
            <span className="sc-count-badge">{actions.length} to explore</span>
          </div>
          <p className="sc-section-hint">Choose a focus to see your next step.</p>
          {actions.map((action) => {
            const isSelected = action.id === selectedActionId;
            return (
              <button
                key={action.id}
                type="button"
                className={`sc-task${isSelected ? ' is-selected' : ''}`}
                onClick={() => setSelectedActionId(action.id)}
                aria-pressed={isSelected}
                aria-controls="dashboard-action-detail"
              >
                <span className={`sc-task-marker ${action.dot}`} aria-hidden="true">
                  {isSelected ? <InterfaceIcon name="check" /> : <span className={`sc-dot ${action.dot}`} />}
                </span>
                <span>
                  <span className="sc-task-title" style={{ display: 'block' }}>
                    {action.title}
                  </span>
                  <span className="sc-task-meta">{action.meta}</span>
                </span>
                <InterfaceIcon name="chevron" className="sc-chevron" />
              </button>
            );
          })}
        </div>

        <div className="sc-card sc-action-detail" id="dashboard-action-detail">
          <p className="sc-eyebrow">Your selected focus</p>
          <div aria-live="polite" aria-atomic="true">
            <div key={selectedAction.id} className="sc-detail-transition">
              <h3 className="sc-detail-title">{selectedAction.title}</h3>
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
            </div>
          </div>
          <button
            type="button"
            className="sc-btn sc-btn-primary sc-full"
            onClick={() => navigate(selectedAction.to)}
          >
            {selectedAction.cta}
            <InterfaceIcon name="arrow" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default DashboardView;
