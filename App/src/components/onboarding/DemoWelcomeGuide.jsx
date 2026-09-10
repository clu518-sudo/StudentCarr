import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const SEEN_KEY_PREFIX = 'sc-demo-guide-seen:';

const GUIDE_ITEMS = [
  {
    title: 'Profile',
    body: 'A sample file is already uploaded. Hit Generate to auto-fill your profile from it.',
  },
  {
    title: 'Progress',
    body: 'Connect Gmail here to track your job applications.',
  },
  {
    title: 'Chatbot',
    body: 'It uses an MCP agent, with live access to your profile and progress data.',
  },
];

// Shown once per demo account, right after the demo user lands on the
// dashboard. Gated on user.isDemo (see Backend auth.middleware.js /
// auth.service.js toSafeUser) rather than a generic "first login" flag,
// since every demo account is itself a fresh, short-lived, first-time
// session — there's no returning demo user to distinguish it from.
const DemoWelcomeGuide = () => {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const storageKey = user?.id ? `${SEEN_KEY_PREFIX}${user.id}` : null;

  useEffect(() => {
    setDismissed(false);
  }, [storageKey]);

  if (!user?.isDemo || !storageKey || dismissed) {
    return null;
  }

  let alreadySeen = false;
  try {
    alreadySeen = window.localStorage.getItem(storageKey) === '1';
  } catch {
    // localStorage unavailable (e.g. private mode) — fall through and show it.
  }
  if (alreadySeen) {
    return null;
  }

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(storageKey, '1');
    } catch {
      // Ignore — worst case the guide reappears next reload.
    }
    setDismissed(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-guide-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 id="demo-guide-title" className="text-lg font-semibold text-gray-900 mb-1">
          Welcome to your StudentCarr demo
        </h3>
        <p className="text-sm text-gray-600 mb-5">
          A quick look at what to try first:
        </p>

        <ul className="space-y-4 mb-6">
          {GUIDE_ITEMS.map((item) => (
            <li key={item.title} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                {item.title.charAt(0)}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                <p className="text-sm text-gray-600">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex justify-end">
          <button type="button" className="btn-primary" onClick={handleDismiss}>
            Got it, let's go
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemoWelcomeGuide;
