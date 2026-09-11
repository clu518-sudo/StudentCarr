import React, { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';

// Left navigation for the dark app shell. Routes, click handling, and the
// active-parent logic are preserved from the original sidebar; only the
// appearance, ordering, and labels are redesigned to match the reference.
const Sidebar = () => {
  const location = useLocation();
  const { user, isAdmin } = useAuth();
  const { manualProfile } = useProfile();

  // Settings (LLM setup) is admin-only in the demo deploy — the route
  // itself is also gated via AdminRoute, this just keeps the link from
  // appearing for accounts that would bounce off it.
  const navigationItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: 'dashboard'
    },
    {
      name: 'Profile',
      path: '/profile',
      icon: 'profile'
    },
    {
      name: 'Skills',
      path: '/skills',
      icon: 'skills',
      subItems: [
        { name: 'Gap Analysis', path: '/skills/gap-analysis' },
        { name: 'Learning Path', path: '/skills/learning-path' }
      ]
    },
    {
      name: 'Progress',
      path: '/progress',
      icon: 'progress'
    },
    {
      name: 'Jobs',
      path: '/jobs',
      icon: 'jobs'
    },
    {
      name: 'Applications',
      path: '/applications',
      icon: 'applications',
      subItems: [
        { name: 'Resume Builder', path: '/applications/resume-builder' },
        { name: 'Automation', path: '/applications/automation' }
      ]
    },
    {
      name: 'Interview',
      path: '/interview',
      icon: 'interview'
    },
    {
      name: 'Settings',
      path: '/settings',
      icon: 'settings'
    }
  ].filter((item) => item.name !== 'Settings' || isAdmin);

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
              title={item.name}
              aria-label={item.name}
              className={({ isActive }) =>
                `sc-nav-item${isActive || isActiveParent(item) ? ' is-active' : ''}`
              }
            >
              <span className="sc-nav-icon">
                <img
                  className="sc-sidebar-artwork"
                  src={`${import.meta.env.BASE_URL}icons/sidebar/${item.icon}-v1.webp`}
                  alt=""
                  aria-hidden="true"
                  width="32"
                  height="32"
                  draggable={false}
                  decoding="async"
                />
              </span>
              <span className="sc-nav-label">{item.name}</span>
            </NavLink>

            {item.subItems && isActiveParent(item) && (
              <div className="sc-subnav">
                {item.subItems.map((subItem) => (
                  <NavLink
                    key={subItem.name}
                    to={subItem.path}
                    title={subItem.name}
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
