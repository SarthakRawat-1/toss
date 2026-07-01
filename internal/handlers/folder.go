package handlers

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/SarthakRawat-1/Toss/internal/dto"
	"github.com/SarthakRawat-1/Toss/internal/services"
	"github.com/SarthakRawat-1/Toss/internal/services/serverlog"
	"github.com/google/uuid"
)

type FolderHandler struct {
	services    *services.FolderService
	fileService *services.FileService
}

func NewFolderHandler(services *services.FolderService, fileService *services.FileService) *FolderHandler {
	return &FolderHandler{services: services, fileService: fileService}
}

func (h *FolderHandler) GetRootFolderHandler(w http.ResponseWriter, r *http.Request) {
	rootFolder, err := h.services.GetRootFolder()
	if err != nil {
		serverlog.Errorf("Failed to get root folder:%v", err)
		http.Error(w, "Failed to get root folder", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(dto.CreateResponseBody(*rootFolder))
}

func (h *FolderHandler) DownloadFolderHandler(w http.ResponseWriter, r *http.Request) {
	folderIDStr := r.PathValue("id")
	pinCode := r.URL.Query().Get("pin")
	folderId, err := uuid.Parse(folderIDStr)
	if err != nil {
		http.Error(w, "Invalid UUID format", http.StatusBadRequest)
		return
	}

	folder, err := h.services.GetFolderByID(folderId)
	if err != nil {
		http.Error(w, "Folder not found", http.StatusNotFound)
		return
	}

	if folder.PinCode != nil && *folder.PinCode != "" {
		if pinCode == "" {
			http.Error(w, "PIN code required", http.StatusUnauthorized)
			return
		}

		verified := services.CheckPasswordHash(pinCode, *folder.PinCode)
		if !verified {
			http.Error(w, "Incorrect PIN code", http.StatusUnauthorized)
			return
		}
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.zip\"", folder.Name))
	w.Header().Set("Content-Type", "application/zip")

	zipWriter := zip.NewWriter(w)
	defer zipWriter.Close()

	if err := h.services.CreateFolderZip(folder, "", zipWriter); err != nil {
		serverlog.Errorf("Error creating zip: %v", err)
		return
	}
}

func (h *FolderHandler) DeleteFolderHandler(w http.ResponseWriter, r *http.Request) {
	folderIDStr := r.PathValue("id")
	folderId, err := uuid.Parse(folderIDStr)
	if err != nil {
		http.Error(w, "Invalid UUID format", http.StatusBadRequest)
		return
	}
	err = h.services.DeleteFolder(folderId)
	if err != nil {
		serverlog.Errorf("Error deleting folder with ID:%s, error:%v", folderIDStr, err)
		http.Error(w, fmt.Sprintf("error couldn't delete folder with id:%s", folderIDStr), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(fmt.Sprintf("deleted folder:%s", folderIDStr)))
}

func (h *FolderHandler) GetRootFilesAndFoldersHandler(w http.ResponseWriter, r *http.Request) {
	rootFolder, err := h.services.GetRootFolder()
	if err != nil {
		serverlog.Errorf("Failed to get root folder:%v", err)
		http.Error(w, "Failed to get root folder", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(dto.CreateResponseBody(*rootFolder))
}

func (h *FolderHandler) GetFolderHandler(w http.ResponseWriter, r *http.Request) {
	folderIDStr := r.PathValue("id")
	pinCode := r.URL.Query().Get("pin")
	folderId, err := uuid.Parse(folderIDStr)
	if err != nil {
		serverlog.Errorf("Invalid UUID format:%v", err)
		http.Error(w, "Invalid UUID format", http.StatusBadRequest)
		return
	}
	folderMeta, err := h.services.GetFolderByID(folderId)
	if err != nil {
		serverlog.Errorf("Folder not found with ID:%s, error:%v", folderIDStr, err)
		http.Error(w, "Folder not found", http.StatusNotFound)
		return
	}
	if folderMeta.PinCode != nil && *folderMeta.PinCode != "" {
		if pinCode == "" {
			http.Error(w, "PIN code required", http.StatusUnauthorized)
			return
		}
		verified := services.CheckPasswordHash(pinCode, *folderMeta.PinCode)
		if !verified {
			serverlog.Warnf("Incorrect PIN code for folder ID:%s", folderIDStr)
			http.Error(w, "Incorrect PIN code", http.StatusUnauthorized)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(dto.CreateResponseBody(*folderMeta))
}
