import { useEffect, useState } from 'react';
import { useUpload } from '@/hooks/useUpload';
import { UPLOAD_STATUS } from '@/utils/upload/progressUtils';
import { useAuth } from '@/contexts/AuthContext';

export function UploadBanner() {
  const { activeUploads, isLoading, refreshActiveUploads, isConnected } = useUpload();
  const { user } = useAuth();
  const [minimized, setMinimized] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const interval = setInterval(refreshActiveUploads, 2000); // Faster updates
    return () => clearInterval(interval);
  }, [refreshActiveUploads]);

  // Filter uploads for current user
  const userUploads = activeUploads.filter(upload => 
    upload.username === user?.username && 
    upload.status !== UPLOAD_STATUS.COMPLETED
  );

  // Sort uploads by status and progress
  const sortedUploads = [...userUploads].sort((a, b) => {
    // Prioritize error states
    if (a.status === UPLOAD_STATUS.ERROR && b.status !== UPLOAD_STATUS.ERROR) return -1;
    if (b.status === UPLOAD_STATUS.ERROR && a.status !== UPLOAD_STATUS.ERROR) return 1;
    
    // Then sort by progress
    const progressA = Math.max(
      a.progress?.saving || 0,
      a.progress?.optimizing || 0,
      a.progress?.uploading || 0
    );
    const progressB = Math.max(
      b.progress?.saving || 0,
      b.progress?.optimizing || 0,
      b.progress?.uploading || 0
    );
    return progressB - progressA;
  });

  const displayUploads = showAll ? sortedUploads : sortedUploads.slice(0, 3);

  if (isLoading || userUploads.length === 0) {
    return null;
  }

  return (
    <div className={`fixed ${minimized ? 'bottom-0 right-4 w-auto' : 'bottom-0 left-0 right-0'} transition-all duration-300 ease-in-out`}>
      <div className={`bg-white/90 backdrop-blur-sm border-t border-gray-200 shadow-lg rounded-t-xl ${minimized ? 'w-72' : ''}`}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-900">
              Active Uploads ({userUploads.length})
            </h3>
            {isConnected ? (
              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                Offline
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!minimized && userUploads.length > 3 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                {showAll ? 'Show Less' : `Show All (${userUploads.length})`}
              </button>
            )}
            <button
              onClick={() => setMinimized(!minimized)}
              className="text-gray-500 hover:text-gray-700"
            >
              {minimized ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className={`${minimized ? 'hidden' : 'block'}`}>
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex flex-col space-y-3">
              {displayUploads.map((upload) => {
                // Calculate the overall progress
                const progress = Math.max(
                  upload.progress?.saving || 0,
                  upload.progress?.optimizing || 0,
                  upload.progress?.uploading || 0
                );

                // Get current phase
                const currentPhase = 
                  upload.progress?.saving > 0 ? 'Saving' :
                  upload.progress?.optimizing > 0 ? 'Optimizing' :
                  upload.progress?.uploading > 0 ? 'Uploading' :
                  'Processing';

                // Estimate time remaining based on progress rate
                const timeRemaining = upload.estimatedTimeRemaining 
                  ? Math.ceil(upload.estimatedTimeRemaining / 60)
                  : null;

                return (
                  <div
                    key={upload.id}
                    className="group relative flex items-center justify-between space-x-4 bg-white/60 rounded-lg p-3 shadow-sm hover:bg-white/80 transition-colors duration-200"
                  >
                    <div className="flex items-center space-x-4 min-w-0">
                      <div className="flex-shrink-0">
                        {upload.status === UPLOAD_STATUS.ERROR ? (
                          <div className="relative">
                            <svg
                              className="h-5 w-5 text-red-500 animate-pulse"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                          </div>
                        ) : (
                          <div className="relative">
                            <svg
                              className="h-5 w-5 text-blue-500 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            {progress > 0 && progress < 100 && (
                              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors duration-200">
                          {upload.title || 'Untitled Upload'}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-500">
                            {upload.status === UPLOAD_STATUS.ERROR ? 'Upload failed' :
                             upload.status === UPLOAD_STATUS.QUEUED ? `Queued - Position ${upload.queuePosition}` :
                             `${currentPhase} - ${Math.round(progress)}%`}
                          </p>
                          {timeRemaining && (
                            <span className="text-xs text-gray-400">
                              • ~{timeRemaining} min remaining
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="w-full max-w-xs">
                      <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            upload.status === UPLOAD_STATUS.ERROR ? 'bg-red-600' :
                            upload.status === UPLOAD_STATUS.QUEUED ? 'bg-purple-600' :
                            upload.status === UPLOAD_STATUS.COMPLETED ? 'bg-green-600' :
                            'bg-blue-600 relative'
                          }`}
                          style={{ 
                            width: `${progress}%`,
                            backgroundImage: upload.status !== UPLOAD_STATUS.ERROR && upload.status !== UPLOAD_STATUS.COMPLETED ?
                              'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)' : 'none',
                            backgroundSize: '1rem 1rem',
                            animation: upload.status !== UPLOAD_STATUS.ERROR && upload.status !== UPLOAD_STATUS.COMPLETED ?
                              'progress-stripes 1s linear infinite' : 'none'
                          }}
                        />
                      </div>
                    </div>

                    {upload.error && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-lg">
                          <span className="text-xs text-red-800 font-medium">
                            {upload.error}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress-stripes {
          from { background-position: 1rem 0; }
          to { background-position: 0 0; }
        }
      `}</style>
    </div>
  );
} 