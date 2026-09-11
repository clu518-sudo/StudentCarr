import React from 'react';

// Presentation-only icons shared by the dashboard and assistant controls.
const paths = {
  applications: 'M8 4H6a2 2 0 0 0-2 2v14h16V6a2 2 0 0 0-2-2h-2M8 3h8v4H8zM8 12h8M8 16h5',
  jobs: 'M8 7V4h8v3M3 7h18v13H3zM3 11l9 4 9-4M12 12v4',
  skills: 'm12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3z',
  projects: 'M3 7V5h7l2 3h9v12H3V7zM8 13l-2 2 2 2M16 13l2 2-2 2',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  check: 'm5 12 4 4L19 6',
  sync: 'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  send: 'm5 12 14-8-5 16-3-6-6-2Zm6 2 8-10',
  chevron: 'm9 5 7 7-7 7',
};

const InterfaceIcon = ({ name, className = '' }) => (
  <svg className={`sc-interface-icon ${className}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={paths[name] || paths.arrow} />
  </svg>
);

export default InterfaceIcon;
