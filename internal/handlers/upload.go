package handlers

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/SarthakRawat-1/Toss/internal/config"
	"github.com/SarthakRawat-1/Toss/internal/dto"
	"github.com/SarthakRawat-1/Toss/internal/paths"
	"github.com/SarthakRawat-1/Toss/internal/services"
	"github.com/SarthakRawat-1/Toss/internal/services/serverlog"
	"github.com/google/uuid"
)

type UploadHandler struct {
	folderService *services.FolderService
	fileService   *services.FileService
}

func NewUploadHandler(folderService *services.FolderService, fileService *services.FileService) *UploadHandler {
	return &UploadHandler{
		folderService: folderService,
		fileService:   fileService,
	}
}

func (h *UploadHandler) parseUploadForm(r *http.Request) (dto.UploadRequestBody, string, error) {
	var requestBody dto.UploadRequestBody
	var basePath string

	cfg, err := config.GetConfig()
	maxSize := int64(8 << 20) // Default 8MB
	if err == nil {
		maxSize = cfg.Storage.MaxFileSize
	}

	err = r.ParseMultipartForm(maxSize)
	if err != nil {
		serverlog.Errorf("Error parsing multipart form: %v", err)
		return dto.UploadRequestBody{}, "", fmt.Errorf("multipart form: %w", err)
	}

	form := r.MultipartForm
	requestBody.FileHeaders = form.File["files"]
	requestBody.PinCode = r.FormValue("pin_code")
	if requestBody.PinCode == "" {
		requestBody.PinCode = r.FormValue("pinCode")
	}

	requestBody.DisplayName = strings.TrimSpace(r.FormValue("display_name"))
	if requestBody.DisplayName == "" {
		requestBody.DisplayName = strings.TrimSpace(r.FormValue("fileName"))
	}

	folderIdStr := r.FormValue("parent_id")
	if folderIdStr == "" {
		folderIdStr = r.FormValue("folderId")
	}

	requestBody.ContentType = r.FormValue("contentType")
	if requestBody.ContentType == "" {
		requestBody.ContentType = r.FormValue("type")
	}

	if requestBody.PinCode != "" {
		requestBody.PinCode, err = services.HashPassword(requestBody.PinCode)
		if err != nil {
			return dto.UploadRequestBody{}, "", fmt.Errorf("error parsing pin code: %w", err)
		}
	}

	if folderIdStr != "" {
		parsed, err := uuid.Parse(folderIdStr)
		if err != nil {
			return dto.UploadRequestBody{}, "", fmt.Errorf("invalid folder id: %w", err)
		}
		requestBody.ParentFolderID = &parsed
	}

	basePath, err = paths.GetFilesPath()
	if err != nil {
		serverlog.Errorf("Could not get default path: %v", err)
		basePath = ""
	}
	return requestBody, basePath, nil
}

func (h *UploadHandler) UploadHandler(w http.ResponseWriter, r *http.Request) {
	requestBody, basePath, err := h.parseUploadForm(r)
	if err != nil {
		serverlog.Errorf("Failed to parse upload form: %v", err)
		http.Error(w, "Error parsing upload form", http.StatusBadRequest)
		return
	}

	switch requestBody.ContentType {
	case "file":
		if len(requestBody.FileHeaders) == 0 {
			serverlog.Warnf("No file provided in upload request")
			http.Error(w, "No file provided", http.StatusBadRequest)
			return
		}
		if err := h.handleSingleFile(requestBody, basePath); err != nil {
			serverlog.Errorf("Failed to upload file: %v", err)
			http.Error(w, "Error uploading file", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("File uploaded successfully!"))
	case "files":
		if len(requestBody.FileHeaders) == 0 {
			serverlog.Warnf("No files provided in upload request")
			http.Error(w, "No files provided", http.StatusBadRequest)
			return
		}
		if err := h.handleMultipleFiles(requestBody, basePath); err != nil {
			serverlog.Errorf("Failed to upload files: %v", err)
			http.Error(w, "Error uploading files", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(fmt.Sprintf("%d files uploaded successfully!", len(requestBody.FileHeaders))))
	case "folder":
		if len(requestBody.FileHeaders) == 0 {
			serverlog.Warnf("No files provided in upload request")
			http.Error(w, "No files provided", http.StatusBadRequest)
			return
		}
		form := r.MultipartForm
		pathsList := form.Value["paths"]
		if err := h.folderService.SaveFolder(requestBody.FileHeaders, pathsList, requestBody.ParentFolderID, requestBody.PinCode, requestBody.DisplayName); err != nil {
			serverlog.Errorf("Failed to upload folder: %v", err)
			http.Error(w, "Error uploading folder", http.StatusInternalServerError)
			return
		}
		serverlog.Infof("Folder uploaded successfully with %d files", len(requestBody.FileHeaders))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(fmt.Sprintf("Folder uploaded successfully with %d files!", len(requestBody.FileHeaders))))
	default:
		serverlog.Warnf("Invalid upload type: %s", requestBody.ContentType)
		http.Error(w, "Invalid upload type, must be 'file', 'files', or 'folder'", http.StatusBadRequest)
	}
}

func uniqueDiskName(original string) string {
	sanetizedName := filepath.Base(original)
	ext := filepath.Ext(sanetizedName)
	base := strings.TrimSuffix(sanetizedName, ext)
	if base == "" {
		base = "upload"
	}
	return fmt.Sprintf("%s-%s%s", base, uuid.New().String(), ext)
}

func (h *UploadHandler) handleSingleFile(requestBody dto.UploadRequestBody, basePath string) error {
	var targetDir string
	var fileFolderID *uuid.UUID

	if requestBody.ParentFolderID != nil {
		folder, err := h.folderService.GetFolderByID(*requestBody.ParentFolderID)
		if err != nil {
			return fmt.Errorf("folder not found: %w", err)
		}
		targetDir = folder.Path
		fileFolderID = &folder.ID
	} else {
		rootFolder, err := h.folderService.GetRootFolder()
		if err != nil {
			return fmt.Errorf("no root folder available for upload: %w", err)
		}
		targetDir = rootFolder.Path
		fileFolderID = nil
	}

	fileHeader := requestBody.FileHeaders[0]
	diskPath := filepath.Join(targetDir, uniqueDiskName(fileHeader.Filename))
	if err := h.fileService.SaveUploadedFileAndCreateRecord(fileHeader, diskPath, requestBody.PinCode, fileFolderID, requestBody.DisplayName); err != nil {
		return fmt.Errorf("save upload: %w", err)
	}
	return nil
}

func (h *UploadHandler) handleMultipleFiles(requestBody dto.UploadRequestBody, basePath string) error {
	var targetDir string
	var fileFolderID *uuid.UUID

	if requestBody.ParentFolderID != nil {
		f, err := h.folderService.GetFolderByID(*requestBody.ParentFolderID)
		if err != nil {
			return fmt.Errorf("folder not found: %w", err)
		}
		targetDir = f.Path
		fileFolderID = &f.ID
	} else {
		rootFolder, err := h.folderService.GetRootFolder()
		if err != nil {
			return fmt.Errorf("no root folder available for upload: %w", err)
		}
		targetDir = rootFolder.Path
		fileFolderID = nil
	}

	for _, fh := range requestBody.FileHeaders {
		diskPath := filepath.Join(targetDir, uniqueDiskName(fh.Filename))
		if err := h.fileService.SaveUploadedFileAndCreateRecord(fh, diskPath, requestBody.PinCode, fileFolderID, requestBody.DisplayName); err != nil {
			serverlog.Errorf("failed saving upload for %s: %v", fh.Filename, err)
			continue
		}
	}
	return nil
}
