import React from 'react';

interface Props {
  message?: string | null;
  onClose?: () => void;
}

export default function InvalidatedSessionBanner({ message, onClose }: Props) {
  if (!message) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="mt-2 rounded-md border border-yellow-300 bg-yellow-100 text-yellow-900 shadow">
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M12 2a10 10 0 100 20 10 10 0 000-20zm.75 5.75a.75.75 0 10-1.5 0v6.5a.75.75 0 001.5 0v-6.5zm0 9.5a.75.75 0 10-1.5 0 .75.75 0 001.5 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{message || "You've logged in elsewhere. This session has been logged out."}</span>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={onClose}
              className="rounded p-1 text-yellow-900 hover:bg-yellow-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
