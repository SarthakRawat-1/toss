import React, { useState } from 'react';
import { X } from 'lucide-react';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => void;
  title: string;
}

export const PinModal: React.FC<PinModalProps> = ({ isOpen, onClose, onSubmit, title }) => {
  const [pin, setPin] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(pin);
    setPin('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-[#111] border border-[#1f1f1f] w-full max-w-sm p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#333] hover:text-[#777] cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-sm font-semibold text-white mb-1">Protected resource</h3>
        <p className="text-xs text-[#444] mb-5">Enter the PIN to access "{title}".</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#1f1f1f] px-3 py-2.5 text-sm text-white placeholder-[#333] font-mono text-center tracking-widest"
            autoFocus
            required
          />
          <button
            type="submit"
            className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-black font-semibold text-sm py-2.5 transition-colors cursor-pointer"
          >
            Confirm
          </button>
        </form>
      </div>
    </div>
  );
};
