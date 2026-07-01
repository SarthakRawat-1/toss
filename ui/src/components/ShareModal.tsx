import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, url, title }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch (err) {
      console.warn('Navigator clipboard failed, trying fallback', err);
    }

    // Fallback for non-HTTPS local network contexts
    try {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.position = 'fixed';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
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

        <h3 className="text-sm font-semibold text-white mb-1">Share</h3>
        <p className="text-xs text-[#444] mb-5 truncate">{title}</p>

        <div className="mb-5 flex items-center justify-center bg-white p-3 w-fit mx-auto">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(url)}`}
            alt="QR Code"
            className="w-[140px] h-[140px]"
          />
        </div>

        <div className="flex items-stretch gap-0 border border-[#1f1f1f]">
          <input
            type="text"
            readOnly
            value={url}
            className="flex-1 bg-[#0a0a0a] px-3 py-2 text-xs text-[#555] font-mono min-w-0"
          />
          <button
            onClick={handleCopy}
            className={`px-3 py-2 text-xs font-medium transition-colors cursor-pointer border-l border-[#1f1f1f] flex items-center gap-1.5 ${
              copied ? 'text-[#22c55e]' : 'text-[#444] hover:text-white bg-[#111]'
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
};
