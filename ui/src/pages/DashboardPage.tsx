import React, { useEffect, useState, useRef } from 'react';
import { Upload, Trash2, Folder, File, ChevronRight, ChevronLeft, Lock, Loader2 } from 'lucide-react';
import { FolderService } from '../lib/services/folder.service';
import type { FolderContentDto, FolderModel } from '../lib/services/folder.service';
import { FileService } from '../lib/services/file.service';
import { UploadService } from '../lib/services/upload.service';
import type { UploadDescriptor } from '../lib/services/upload.service';
import { formatBytes } from './DownloadPage';
import { PinModal } from '../components/PinModal';

export const DashboardPage: React.FC = () => {
  const [history, setHistory] = useState<{ id: string; name: string; pin?: string }[]>([
    { id: FolderService.ROOT_ID, name: 'Root' }
  ]);
  const [contents, setContents] = useState<FolderContentDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploadType, setUploadType] = useState<'file' | 'files' | 'folder'>('file');
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [folderPaths, setFolderPaths] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pinData, setPinData] = useState<{ id: string; title: string; type: 'folder-open' } | null>(null);

  const fetchContents = async (folderId: string, pin: string = '') => {
    setLoading(true);
    setError(null);
    try {
      const res = await FolderService.getContents(folderId, pin);
      setContents(res);
      if (pin) setHistory(prev => prev.map(h => h.id === folderId ? { ...h, pin } : h));
    } catch (err: any) {
      setError(err?.message || 'Failed to load.');
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

  const handleDelete = async (type: 'file' | 'folder', id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      if (type === 'file') await FileService.deleteFile(id);
      else await FolderService.deleteFolder(id);
      fetchContents(history[history.length - 1].id, history[history.length - 1].pin || '');
    } catch {
      alert('Failed to delete.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setFilesToUpload(files);
    setFolderPaths(uploadType === 'folder'
      ? files.map(f => (f as any).webkitRelativePath || f.name)
      : []
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    setFilesToUpload(files);
    setUploadType(files.length > 1 ? 'files' : 'file');
    setFolderPaths([]);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (filesToUpload.length === 0) return;
    setUploading(true);
    const current = history[history.length - 1];
    try {
      const descriptor: UploadDescriptor = {
        type: uploadType,
        totalFiles: filesToUpload.length,
        totalSize: filesToUpload.reduce((a, f) => a + f.size, 0),
        entries: filesToUpload.map((file, idx) => ({
          file,
          size: file.size,
          relativePath: uploadType === 'folder' ? folderPaths[idx] : null,
        })),
      };
      await UploadService.upload(descriptor, {
        displayName: displayName || undefined,
        pinCode: pinCode || undefined,
        parentId: current.id === FolderService.ROOT_ID ? undefined : current.id,
      });
      setFilesToUpload([]);
      setFolderPaths([]);
      setDisplayName('');
      setPinCode('');
      fetchContents(current.id, current.pin || '');
    } catch (err: any) {
      alert(err?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const isRoot = history.length === 1;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8">

        {/* Upload panel */}
        <aside>
          <h2 className="text-xs font-semibold text-[#444] uppercase tracking-wider mb-4">Upload</h2>
          <form onSubmit={handleUpload} className="space-y-4">

            {/* Mode selector */}
            <div className="flex border border-[#1f1f1f] divide-x divide-[#1f1f1f] overflow-hidden">
              {(['file', 'files', 'folder'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => { setUploadType(mode); setFilesToUpload([]); }}
                  className={`flex-1 py-2 text-xs font-medium capitalize cursor-pointer transition-colors ${
                    uploadType === mode
                      ? 'bg-[#22c55e] text-black'
                      : 'bg-[#0d0d0d] text-[#444] hover:text-[#777]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple={uploadType === 'files'}
              {...(uploadType === 'folder' ? { webkitdirectory: '', directory: '' } as any : {})}
              className="hidden"
            />

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-sm py-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
                dragOver ? 'border-[#22c55e] bg-[#22c55e]/5' : 'border-[#1f1f1f] hover:border-[#2a2a2a]'
              }`}
            >
              <Upload className="w-5 h-5 text-[#2a2a2a]" />
              {filesToUpload.length > 0 ? (
                <div className="text-center">
                  <p className="text-xs text-white">{filesToUpload.length} file{filesToUpload.length > 1 ? 's' : ''} selected</p>
                  <p className="text-xs text-[#444] mt-0.5">{formatBytes(filesToUpload.reduce((a, f) => a + f.size, 0))}</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-xs text-[#444]">Drop files here or click to browse</p>
                </div>
              )}
            </div>

            {/* Display name */}
            {(uploadType === 'file' || uploadType === 'folder') && (
              <div className="space-y-1">
                <label className="text-xs text-[#444]">Display name <span className="text-[#333]">(optional)</span></label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="e.g. Project Files"
                  className="w-full bg-[#111] border border-[#1f1f1f] rounded-sm px-3 py-2 text-sm text-white placeholder-[#2a2a2a]"
                />
              </div>
            )}

            {/* PIN */}
            <div className="space-y-1">
              <label className="text-xs text-[#444]">PIN protection <span className="text-[#333]">(optional)</span></label>
              <input
                type="password"
                value={pinCode}
                onChange={e => setPinCode(e.target.value)}
                placeholder="Set a PIN"
                className="w-full bg-[#111] border border-[#1f1f1f] rounded-sm px-3 py-2 text-sm text-white placeholder-[#2a2a2a] font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={filesToUpload.length === 0 || uploading}
              className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-30 text-black font-semibold text-sm py-2.5 rounded-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
              {uploading ? 'Uploading...' : 'Upload & Share'}
            </button>
          </form>
        </aside>

        {/* File list panel */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {!isRoot && (
                <button
                  onClick={() => setHistory(prev => prev.slice(0, -1))}
                  className="text-[#444] hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <div className="flex items-center gap-1">
                {history.map((crumb, idx) => (
                  <React.Fragment key={crumb.id}>
                    {idx > 0 && <ChevronRight className="w-3 h-3 text-[#2a2a2a]" />}
                    <button
                      onClick={() => setHistory(prev => prev.slice(0, idx + 1))}
                      className={`text-xs cursor-pointer transition-colors ${
                        idx === history.length - 1 ? 'text-[#777]' : 'text-[#333] hover:text-[#555]'
                      }`}
                    >
                      {crumb.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>
            <h2 className="text-xs font-semibold text-[#444] uppercase tracking-wider">Shared files</h2>
          </div>

          {loading && !contents ? (
            <div className="flex items-center justify-center py-24 text-[#222]">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : (
            <div className="border border-[#1f1f1f]">
              <div className="grid grid-cols-[1fr_100px_36px] items-center px-4 py-2 border-b border-[#1f1f1f] bg-[#0d0d0d]">
                <span className="text-xs text-[#333] uppercase tracking-wider">Name</span>
                <span className="text-xs text-[#333] uppercase tracking-wider">Size</span>
                <span />
              </div>

              {contents?.folders?.map(folder => (
                <div
                  key={folder.id}
                  onClick={() => handleFolderClick(folder)}
                  className="grid grid-cols-[1fr_100px_36px] items-center px-4 py-3 border-b border-[#1a1a1a] hover:bg-[#111] cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Folder className="w-3.5 h-3.5 text-[#d97706] shrink-0" />
                    <span className="text-sm text-[#aaa] group-hover:text-white transition-colors truncate">{folder.name}</span>
                    {folder.isProtected && <Lock className="w-3 h-3 text-[#d97706] shrink-0" />}
                  </div>
                  <span className="text-xs text-[#2a2a2a] font-mono">{formatBytes(folder.size)}</span>
                  <div onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleDelete('folder', folder.id, folder.name)}
                      className="text-red-500 hover:text-red-400 transition-colors cursor-pointer p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {contents?.files?.map(file => (
                <div
                  key={file.id}
                  className="grid grid-cols-[1fr_100px_36px] items-center px-4 py-3 border-b border-[#1a1a1a] last:border-0 hover:bg-[#111] transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <File className="w-3.5 h-3.5 text-[#6b7280] shrink-0" />
                    <span className="text-sm text-[#777] group-hover:text-[#ccc] transition-colors truncate">{file.name}</span>
                    {file.isProtected && <Lock className="w-3 h-3 text-[#d97706] shrink-0" />}
                  </div>
                  <span className="text-xs text-[#2a2a2a] font-mono">{formatBytes(file.size)}</span>
                  <button
                    onClick={() => handleDelete('file', file.id, file.name)}
                    className="text-red-500 hover:text-red-400 transition-colors cursor-pointer p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {contents && (!contents.folders?.length && !contents.files?.length) && (
                <div className="py-16 text-center text-sm text-[#2a2a2a]">
                  Nothing shared yet.
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {pinData && (
        <PinModal
          isOpen
          onClose={() => setPinData(null)}
          onSubmit={pin => {
            setHistory(prev => [...prev, { id: pinData.id, name: pinData.title, pin }]);
            setPinData(null);
          }}
          title={pinData.title}
        />
      )}
    </div>
  );
};
