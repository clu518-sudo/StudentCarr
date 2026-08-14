import React, { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';

// Left navigation for the dark app shell. Routes, click handling, and the
// active-parent logic are preserved from the original sidebar; only the
// appearance, ordering, and labels are redesigned to match the reference.
const Sidebar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { manualProfile } = useProfile();

  const navigationItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
        </svg>
      )
    },
    {
      name: 'Profile',
      path: '/profile',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      name: 'Skills',
      path: '/skills',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      subItems: [
        { name: 'Gap Analysis', path: '/skills/gap-analysis' },
        { name: 'Learning Path', path: '/skills/learning-path' }
      ]
    },
    {
      name: 'Progress',
      path: '/progress',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      name: 'Jobs',
      path: '/jobs',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2h8z" />
        </svg>
      )
    },
    {
      name: 'Applications',
      path: '/applications',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      subItems: [
        { name: 'Resume Builder', path: '/applications/resume-builder' },
        { name: 'Automation', path: '/applications/automation' }
      ]
    },
    {
      name: 'Interview',
      path: '/interview',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      )
    }
  ];

  const isActiveParent = (item) => {
    if (item.subItems) {
      return item.subItems.some(subItem => location.pathname === subItem.path) || location.pathname === item.path;
    }
    return location.pathname === item.path;
  };

  // Career readiness derived from how complete the user's profile is. This uses
  // only existing profile data (no backend logic invented for it).
  const readiness = useMemo(() => {
    const profile = manualProfile || {};
    const checks = [
      Boolean(profile.personalInfo?.name),
      Boolean(profile.personalInfo?.headline),
      Boolean(profile.personalInfo?.summary),
      (profile.education?.length || 0) > 0,
      (profile.workExperience?.length || 0) > 0,
      (profile.projects?.length || 0) > 0,
      (profile.skills?.length || 0) > 0,
      (profile.preferences?.preferredRoles?.length || 0) > 0,
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }, [manualProfile]);

  const displayName = user?.name || user?.fullName || user?.email || 'Student account';
  const initials = displayName
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="sc-sidebar">
      <div className="sc-brand">
        <div className="sc-logo">SC</div>
        <span>StudentCarr</span>
      </div>

      <nav className="sc-nav">
        {navigationItems.map((item) => (
          <React.Fragment key={item.name}>
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `sc-nav-item${isActive || isActiveParent(item) ? ' is-active' : ''}`
              }
            >
              <span className="sc-nav-icon">{item.icon}</span>
              <span className="sc-nav-label">{item.name}</span>
            </NavLink>

            {item.subItems && isActiveParent(item) && (
              <div className="sc-subnav">
                {item.subItems.map((subItem) => (
                  <NavLink
                    key={subItem.name}
                    to={subItem.path}
                    className={({ isActive }) =>
                      `sc-subnav-item${isActive ? ' is-active' : ''}`
                    }
                  >
                    {subItem.name}
                  </NavLink>
                ))}
              </div>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div className="sc-account">
        <div className="sc-avatar">{initials || 'SC'}</div>
        <div className="sc-account-copy">
          <strong>{user?.name || user?.fullName || 'Student account'}</strong>
          <small>Career readiness {readiness}%</small>
          <div className="sc-account-readiness">
            <span style={{ width: `${readiness}%` }} />
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
