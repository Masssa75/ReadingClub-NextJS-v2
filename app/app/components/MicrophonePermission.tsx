'use client';

import { useState, useEffect, useCallback } from 'react';

type PermissionState = 'checking' | 'prompt' | 'denied' | 'granted' | 'unsupported';

interface MicrophonePermissionProps {
  onPermissionGranted: () => void;
  onClose?: () => void;
}

// Detect iOS
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

// Detect iOS Chrome
function isIOSChrome(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && /CriOS/.test(ua);
}

// Detect iOS Safari
function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS/.test(ua) && !/FxiOS/.test(ua);
}

export default function MicrophonePermission({ onPermissionGranted, onClose }: MicrophonePermissionProps) {
  const [permissionState, setPermissionState] = useState<PermissionState>('checking');
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check permission state on mount
  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionState('unsupported');
      return;
    }

    // Try to query permission state (not supported on all browsers)
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        console.log('🎤 Permission state:', result.state);

        if (result.state === 'granted') {
          setPermissionState('granted');
          onPermissionGranted();
          return;
        } else if (result.state === 'denied') {
          setPermissionState('denied');
          return;
        } else {
          setPermissionState('prompt');
          return;
        }
      }
    } catch (err) {
      console.log('Permission query not supported, will try getUserMedia directly');
    }

    // Fallback: assume we need to prompt
    setPermissionState('prompt');
  };

  const requestPermission = useCallback(async () => {
    setIsRequesting(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      // Stop the stream immediately - we just needed to trigger the permission
      stream.getTracks().forEach(track => track.stop());

      setPermissionState('granted');
      onPermissionGranted();
    } catch (err: any) {
      console.error('Permission request failed:', err);

      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setPermissionState('denied');
      } else {
        setError(err?.message || 'Failed to access microphone');
      }
    } finally {
      setIsRequesting(false);
    }
  }, [onPermissionGranted]);

  // Checking state
  if (permissionState === 'checking') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
          <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Checking microphone access...</p>
        </div>
      </div>
    );
  }

  // Already granted - don't show anything
  if (permissionState === 'granted') {
    return null;
  }

  // Unsupported browser
  if (permissionState === 'unsupported') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Browser Not Supported</h2>
            <p className="text-gray-600">
              Your browser doesn't support microphone access. Please try Safari or Chrome.
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-full py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  // Permission denied - show instructions
  if (permissionState === 'denied') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl my-4">
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">🎤</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Microphone Access Needed</h2>
            <p className="text-gray-600">
              We need microphone access to hear your child say the letters. Please enable it in your settings.
            </p>
          </div>

          {/* iOS Chrome Instructions */}
          {isIOSChrome() && (
            <div className="bg-blue-50 rounded-2xl p-4 mb-6">
              <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                <span className="text-xl">📱</span> iPhone Chrome Settings
              </h3>
              <ol className="space-y-3 text-sm text-blue-800">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-xs">1</span>
                  <span>Open the <strong>Settings</strong> app on your iPhone</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-xs">2</span>
                  <span>Scroll down and tap <strong>Chrome</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-xs">3</span>
                  <span>Turn on <strong>Microphone</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-xs">4</span>
                  <span>Come back here and tap <strong>Try Again</strong></span>
                </li>
              </ol>
            </div>
          )}

          {/* iOS Safari Instructions */}
          {isIOSSafari() && (
            <div className="bg-blue-50 rounded-2xl p-4 mb-6">
              <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                <span className="text-xl">📱</span> iPhone Safari Settings
              </h3>
              <ol className="space-y-3 text-sm text-blue-800">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-xs">1</span>
                  <span>Open the <strong>Settings</strong> app on your iPhone</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-xs">2</span>
                  <span>Tap <strong>Safari</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-xs">3</span>
                  <span>Scroll to <strong>Settings for Websites</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-xs">4</span>
                  <span>Tap <strong>Microphone</strong> and set to <strong>Allow</strong></span>
                </li>
              </ol>
            </div>
          )}

          {/* Desktop/Other Instructions */}
          {!isIOS() && (
            <div className="bg-gray-50 rounded-2xl p-4 mb-6">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span className="text-xl">💻</span> How to Enable
              </h3>
              <ol className="space-y-2 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-gray-500 text-white rounded-full flex items-center justify-center font-bold text-xs">1</span>
                  <span>Click the <strong>lock icon</strong> (🔒) in your browser's address bar</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-gray-500 text-white rounded-full flex items-center justify-center font-bold text-xs">2</span>
                  <span>Find <strong>Microphone</strong> and change to <strong>Allow</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-gray-500 text-white rounded-full flex items-center justify-center font-bold text-xs">3</span>
                  <span>Refresh the page</span>
                </li>
              </ol>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setPermissionState('prompt');
                requestPermission();
              }}
              className="flex-1 py-3 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
            >
              Try Again
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Prompt state - show friendly request screen
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">🎤</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Can We Listen?</h2>
          <p className="text-gray-600">
            We need to hear your child say the letter sounds. Tap the button below to allow microphone access.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 rounded-xl p-3 mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <button
          onClick={requestPermission}
          disabled={isRequesting}
          className="w-full py-4 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isRequesting ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              <span>Requesting...</span>
            </>
          ) : (
            <>
              <span>🎙️</span>
              <span>Allow Microphone</span>
            </>
          )}
        </button>

        {onClose && (
          <button
            onClick={onClose}
            className="w-full mt-3 py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors"
          >
            Maybe Later
          </button>
        )}

        <p className="text-xs text-gray-400 text-center mt-4">
          We only listen when you tap the button. Your audio is never stored or sent anywhere.
        </p>
      </div>
    </div>
  );
}

// Hook for checking permission without showing UI
export function useMicrophonePermission() {
  const [state, setState] = useState<PermissionState>('checking');

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setState('unsupported');
      return;
    }

    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setState(result.state as PermissionState);

        // Listen for changes
        result.addEventListener('change', () => {
          setState(result.state as PermissionState);
        });
        return;
      }
    } catch (err) {
      // Permission query not supported
    }

    setState('prompt');
  };

  return { state, checkPermission };
}
