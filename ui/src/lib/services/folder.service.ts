import { request } from './http';

export interface FileModel {
  id: string;
  folder_id?: string;
  name: string;
  size: number;
  extension: string;
  mime_type: string;
  isProtected: boolean;
}

export interface FolderModel {
  id: string;
  name: string;
  size: number;
  parent_id?: string;
  isProtected: boolean;
}

export interface FolderContentDto {
  id: string;
  name: string;
  folders: FolderModel[];
  files: FileModel[];
  is_protected: boolean;
}

export const FolderService = {
  ROOT_ID: "00000000-0000-0000-0000-000000000000",

  async getContents(folderId: string, pin: string = ""): Promise<FolderContentDto> {
    const isRoot = folderId === this.ROOT_ID;
    const endpoint = isRoot
      ? "/rootfilesandfolders"
      : `/folder/content/${folderId}${pin ? `?pin=${encodeURIComponent(pin)}` : ""}`;

    return request<FolderContentDto>(endpoint);
  },

  async deleteFolder(folderId: string): Promise<void> {
    await request<void>(`/delete/folder/${folderId}`, { method: 'DELETE' });
  },
};
