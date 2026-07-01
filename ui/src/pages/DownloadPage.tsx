import React, { useEffect, useState } from 'react';
import { RefreshCw, Download, Folder, File, Share2, ChevronRight, ChevronLeft, Lock } from 'lucide-react';
import { FolderService } from '../lib/services/folder.service';
import type { FolderContentDto, FileModel, FolderModel } from '../lib/services/folder.service';
import { FileService } from '../lib/services/file.service';
import { ShareModal } from '../components/ShareModal';
import { PinModal } from '../components/PinModal';
import { API_BASE, getShareBaseUrl } from '../lib/config';

export function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const DownloadPage: React.FC = () => {
  const [history, setHistory] = useState<{ id: string; name: string; pin?: string }[]>([
    { id: FolderService.ROOT_ID, name: 'Root' }
  ]);
  const [contents, setContents] = useState<FolderContentDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareData, setShareData] = useState<{ url: string; title: string } | null>(null);
  const [pinData, setPinData] = useState<{
    id: string; title: string; type: 'folder-open' | 'folder-download' | 'file';
  } | null>(null);

  const fetchContents = async (folderId: string, pin: string = '') => {
    setLoading(true);
    setError(null);
    try {
      const res = await FolderService.getContents(folderId, pin);
      setContents(res);
      if (pin) {
        setHistory(prev => prev.map(h => h.id === folderId ? { ...h, pin } : h));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load.');
      if (err?.message?.includes('401') || err?.message?.includes('PIN')) {
        const item = history.find(h => h.id === folderId);
        setPinData({ id: folderId, title: item?.name || 'Folder', type: 'folder-open' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const current = history[history.length - 1];
    fetchContents(current.id, current.pin || '');
  }, [history]);

  const handleFolderClick = (folder: FolderModel) => {
    if (folder.isProtected) {
      setPinData({ id: folder.id, title: folder.name, type: 'folder-open' });
    } else {
      setHistory(prev => [...prev, { id: folder.id, name: folder.name }]);
    }
  };

  const handleFileDownload = (file: FileModel) => {
    if (file.isProtected) {
      setPinData({ id: file.id, title: file.name, type: 'file' });
    } else {
      FileService.downloadFile(file.id);
    }
  };

  const handleFolderDownload = (folder: FolderModel) => {
    if (folder.isProtected) {
      setPinData({ id: folder.id, title: folder.name, type: 'folder-download' });
    } else {
      FileService.downloadFolder(folder.id);
    }
  };

  const handlePinSubmit = (pin: string) => {
    if (!pinData) return;
    if (pinData.type === 'folder-open') {
      setHistory(prev => [...prev, { id: pinData.id, name: pinData.title, pin }]);
    } else if (pinData.type === 'folder-download') {
      FileService.downloadFolder(pinData.id, pin);
    } else {
      FileService.downloadFile(pinData.id, pin);
    }
    setPinData(null);
  };

  const isRoot = history.length === 1;
  const hasItems = (contents?.folders?.length ?? 0) + (contents?.files?.length ?? 0) > 0;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {!isRoot && (
            <button
              onClick={() => setHistory(prev => prev.slice(0, -1))}
              className="text-[#555] hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="text-base font-semibold text-white">
              {history[history.length - 1].name}
            </h1>
            {history.length > 1 && (
              <div className="flex items-center gap-1 mt-0.5">
                {history.map((crumb, idx) => (
                  <React.Fragment key={crumb.id}>
                    {idx > 0 && <ChevronRight className="w-3 h-3 text-[#333]" />}
                    <button
                      onClick={() => setHistory(prev => prev.slice(0, idx + 1))}
                      className={`text-xs transition-colors cursor-pointer ${
                        idx === history.length - 1 ? 'text-[#555]' : 'text-[#333] hover:text-[#555]'
                      }`}
                    >
                      {crumb.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => fetchContents(history[history.length - 1].id, history[history.length - 1].pin)}
          className="flex items-center gap-1.5 text-xs text-[#555] hover:text-white transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#22c55e]" />
          <span className="text-[#22c55e]">Refresh</span>
        </button>
      </div>

      {/* Content area */}
      {loading && !contents ? (
        <div className="flex items-center justify-center py-24 text-[#333]">
          <RefreshCw className="w-4 h-4 animate-spin" />
        </div>
      ) : error && !contents ? (
        <div className="py-24 text-center text-sm text-[#555]">{error}</div>
      ) : !hasItems ? (
        <div className="py-24 text-center">
          <p className="text-sm text-[#333]">No files shared yet.</p>
        </div>
      ) : (
        <div className="border border-[#1f1f1f]">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_100px_80px_140px] items-center px-4 py-2 border-b border-[#1f1f1f] bg-[#0d0d0d]">
            <span className="text-xs text-[#333] uppercase tracking-wider">Name</span>
            <span className="text-xs text-[#333] uppercase tracking-wider">Size</span>
            <span className="text-xs text-[#333] uppercase tracking-wider">Type</span>
            <span className="text-xs text-[#333] uppercase tracking-wider text-right">Actions</span>
          </div>

          {/* Folders */}
          {contents?.folders?.map(folder => (
            <div
              key={folder.id}
              onClick={() => handleFolderClick(folder)}
              className="grid grid-cols-[1fr_100px_80px_140px] items-center px-4 py-3 border-b border-[#1a1a1a] hover:bg-[#111] cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Folder className="w-4 h-4 text-[#d97706] shrink-0" />
                <span className="text-sm text-[#ccc] group-hover:text-white transition-colors truncate">{folder.name}</span>
                {folder.isProtected && <Lock className="w-3 h-3 text-[#d97706] shrink-0" />}
              </div>
              <span className="text-xs text-[#333] font-mono">{formatBytes(folder.size)}</span>
              <span className="text-xs text-[#333]">Folder</span>
              <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setShareData({ url: `${getShareBaseUrl()}/download-folder/${folder.id}`, title: folder.name })}
                  className="text-[#333] hover:text-[#777] transition-colors cursor-pointer p-1"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleFolderDownload(folder)}
                  className="text-xs text-[#22c55e] hover:text-[#16a34a] transition-colors cursor-pointer font-medium"
                >
                  Download
                </button>
              </div>
            </div>
          ))}

          {/* Files */}
          {contents?.files?.map(file => (
            <div
              key={file.id}
              className="grid grid-cols-[1fr_100px_80px_140px] items-center px-4 py-3 border-b border-[#1a1a1a] last:border-b-0 hover:bg-[#111] transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <File className="w-4 h-4 text-[#6b7280] shrink-0" />
                <span className="text-sm text-[#999] group-hover:text-[#ccc] transition-colors truncate">{file.name}</span>
                {file.isProtected && <Lock className="w-3 h-3 text-[#d97706] shrink-0" />}
              </div>
              <span className="text-xs text-[#333] font-mono">{formatBytes(file.size)}</span>
              <span className="text-xs text-[#333] font-mono uppercase">{file.extension?.replace('.', '') || '—'}</span>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShareData({ url: `${getShareBaseUrl()}/download/${file.id}`, title: file.name })}
                  className="text-[#333] hover:text-[#777] transition-colors cursor-pointer p-1"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleFileDownload(file)}
                  className="text-xs text-[#22c55e] hover:text-[#16a34a] transition-colors cursor-pointer font-medium"
                >
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {shareData && (
        <ShareModal isOpen onClose={() => setShareData(null)} url={shareData.url} title={shareData.title} />
      )}
      {pinData && (
        <PinModal isOpen onClose={() => setPinData(null)} onSubmit={handlePinSubmit} title={pinData.title} />
      )}
    </div>
  );
};
