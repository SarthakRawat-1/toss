package handlers

import (
	"fmt"
	"net/http"

	"github.com/SarthakRawat-1/Toss/internal/services"
	"github.com/SarthakRawat-1/Toss/internal/services/serverlog"
	"github.com/google/uuid"
)

type FileHandler struct {
	services *services.FileService
}

func NewFileHandler(services *services.FileService) *FileHandler {
	return &FileHandler{services: services}
}

func (h *FileHandler) DownloadFileHandler(w http.ResponseWriter, r *http.Request) {
	fileIdStr := r.PathValue("id")
	pinCode := r.URL.Query().Get("pin")
	fileId, err := uuid.Parse(fileIdStr)
	if err != nil {
		serverlog.Warnf("invalid UUID format:%v", err)
		http.Error(w, "Invalid UUID format", http.StatusBadRequest)
		return
	}

	file, found := h.services.GetFileByID(fileId)
	if !found {
		serverlog.Warnf("File not found")
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	if file.Pin != nil && *file.Pin != "" {
		if pinCode == "" {
			http.Error(w, "PIN code required", http.StatusUnauthorized)
			return
		}

		verified := services.CheckPasswordHash(pinCode, *file.Pin)
		if !verified {
			serverlog.Warnf("Incorrect PIN code for file ID:%s", fileIdStr)
			http.Error(w, "Incorrect PIN code", http.StatusUnauthorized)
			return
		}
	}

	serverlog.Infof("Sent %s with size of %d", file.Name, file.Size)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", file.Name))
	http.ServeFile(w, r, file.Path)
}

func (h *FileHandler) DeleteFileHandler(w http.ResponseWriter, r *http.Request) {
	fileIdStr := r.PathValue("id")
	fileId, err := uuid.Parse(fileIdStr)
	if err != nil {
		serverlog.Errorf("Invalid UUID format:%v", err)
		http.Error(w, "Invalid UUID format", http.StatusBadRequest)
		return
	}
	file, found := h.services.GetFileByID(fileId)
	if !found {
		serverlog.Warnf("File not found")
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	err = h.services.DeleteFile(fileId)
	if err != nil {
		serverlog.Errorf("Error deleting file with ID:%s, error:%v", fileIdStr, err)
		http.Error(w, "Error deleting file from db", http.StatusInternalServerError)
		return
	}

	serverlog.Infof("Deleted file with ID:%s ", fileIdStr)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(fmt.Sprintf("File '%s' deleted successfully", file.Name)))
}
