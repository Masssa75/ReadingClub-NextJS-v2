'use client';

import { useState, useRef, useEffect } from 'react';

interface ProfileInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  variant?: 'kid' | 'admin';
}

export default function ProfileInputModal({
  isOpen,
  onClose,
  onSubmit,
  variant = 'kid'
}: ProfileInputModalProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to ensure modal is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Reset name when modal closes
  useEffect(() => {
    if (!isOpen) {
      setName('');
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (name.trim()) {
      onSubmit(name.trim());
      setName('');
      onClose();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  // Kid-friendly style (matches ParentsMenu)
  if (variant === 'kid') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-gradient-to-br from-white/95 to-white/90 backdrop-blur-3xl rounded-[40px] shadow-2xl border-4 border-white/80 p-8 w-full max-w-sm">
          {/* Header with emoji */}
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">✨</div>
            <h2 className="text-2xl font-black bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              New Profile
            </h2>
          </div>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter name..."
            className="w-full px-5 py-4 text-lg font-medium text-gray-800 bg-white rounded-[20px] border-3 border-purple-300 focus:border-purple-500 focus:outline-none transition-all text-center"
            autoCapitalize="words"
            autoCorrect="off"
          />

          {/* Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-4 px-6 rounded-[20px] font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!name.trim()}
              className="flex-1 py-4 px-6 rounded-[20px] font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Admin style (matches ProfileSelector)
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#2a2a2a] rounded-lg shadow-2xl border border-[#555] p-6 w-full max-w-sm">
        <h2 className="text-xl font-bold text-white mb-4 text-center">
          New Profile
        </h2>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder='e.g., "Ophelia", "Rey", "Marc"'
          className="w-full px-4 py-3 text-base text-white bg-[#1a1a1a] rounded border border-[#555] focus:border-[#7CB342] focus:outline-none transition-all"
          autoCapitalize="words"
          autoCorrect="off"
        />

        {/* Buttons */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded font-medium text-gray-300 bg-[#444] hover:bg-[#555] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="flex-1 py-3 px-4 rounded font-medium text-white bg-[#7CB342] hover:bg-[#8BC34A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
