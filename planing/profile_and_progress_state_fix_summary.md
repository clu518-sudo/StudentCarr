# Profile And Progress State Fix Summary

## Overview

This update fixed two frontend state persistence problems caused by route-level component unmounting:

1. The `/profile` page lost generated profile state when switching to another page.
2. The `/progress` page lost sync button state when switching pages, and it did not auto-refresh after backend sync completed later.

Both issues came from keeping long-running UI state only inside page components that are destroyed and recreated by React Router navigation.

## Profile Page Changes

### Problem

- Generated profile data was only stored in `ProfileView` local state.
- The `generatingManual` flag and abort controller also lived only inside `ProfileView`.
- Navigating away from `/profile` unmounted the page, which reset the button state and discarded the generated draft from the UI.
- The generated draft was not persisted automatically, so returning to `/profile` reloaded the older saved profile from backend storage.

### Fix

- Added `App/src/contexts/ProfileContext.jsx`.
- Wrapped the app with `ProfileProvider` in `App/src/App.jsx`.
- Moved profile-related state and actions from `ProfileView` into the shared provider:
  - `manualProfile`
  - `documents`
  - `githubUrl`
  - `generatingManual`
  - save, upload, delete, download, and generate handlers
- Updated `App/src/components/profile/ProfileView.jsx` to consume provider state instead of owning the generation lifecycle directly.
- When generation completes, the provider now persists the generated profile through the existing manual profile save API before finalizing the success state.

### Result

- Generated profile content now stays available even after switching pages.
- The generate button continues showing the correct in-progress state across navigation.
- Returning to `/profile` shows the saved generated profile instead of an older version.

## Progress Page Changes

### Problem

- `syncingMailbox` was only stored in `ProgressView` local state.
- When navigating away from `/progress`, the page unmounted and the sync button returned to its default label.
- The page only refreshed data inside the original `handleSyncMailbox()` execution path.
- If sync completed after the user switched pages, the page did not auto-update when they came back.

### Fix

- Added `App/src/contexts/ProgressContext.jsx`.
- Wrapped the app with `ProgressProvider` in `App/src/App.jsx`.
- Moved progress page state and sync lifecycle into shared provider state:
  - applications
  - email detail state
  - draft/reply state
  - Gmail status
  - sync state
  - selection state
- Updated `App/src/components/progress/ProgressView.jsx` to consume provider state.
- Added polling of Gmail sync status while backend sync status is `running`.
- When sync status changes from `running` to a finished state, the provider refreshes:
  - applications
  - related emails
  - selected email detail when applicable

### Result

- The `Sync Progress Emails` button now remains in `Syncing...` state across page switches while sync is still running.
- The page automatically refreshes data after backend sync completes.
- The UI now reflects persisted backend sync status instead of relying only on the current page instance.

## Files Added

- `App/src/contexts/ProfileContext.jsx`
- `App/src/contexts/ProgressContext.jsx`
- `planing/profile_and_progress_state_fix_summary.md`

## Files Updated

- `App/src/App.jsx`
- `App/src/components/profile/ProfileView.jsx`
- `App/src/components/progress/ProgressView.jsx`

## Verification

- Frontend production build succeeded with `npm run build` in `App/`.
