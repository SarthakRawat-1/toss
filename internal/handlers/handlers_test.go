package handlers

import (
	"net/http"
	"os"
	"testing"

	"github.com/SarthakRawat-1/Toss/internal/middleware"
	"github.com/SarthakRawat-1/Toss/internal/services"
	storagesql "github.com/SarthakRawat-1/Toss/internal/storage/sql"
	"github.com/SarthakRawat-1/Toss/internal/testutil"
	"github.com/gorilla/sessions"
)

type handlerDeps struct {
	repo          *storagesql.SQLRepository
	fileService   *services.FileService
	folderService *services.FolderService
	fileHandler   *FileHandler
	folderHandler *FolderHandler
	uploadHandler *UploadHandler
}

func TestMain(m *testing.M) {
	tempDir, err := os.MkdirTemp("", "localdrop-test-")
	if err != nil {
		os.Exit(1)
	}
	defer os.RemoveAll(tempDir)

	testutil.SetTestEnv(tempDir)

	os.Exit(m.Run())
}

func newHandlerDeps(t *testing.T) (*handlerDeps, func()) {
	t.Helper()

	deps, cleanup := testutil.SetupStorageDeps(t)
	return &handlerDeps{
		repo:          deps.Repo,
		fileService:   deps.FileService,
		folderService: deps.FolderService,
		fileHandler:   NewFileHandler(deps.FileService),
		folderHandler: NewFolderHandler(deps.FolderService, deps.FileService),
		uploadHandler: NewUploadHandler(deps.FolderService, deps.FileService),
	}, cleanup
}

func newTestRouter(authEnabled bool, uploadHandler http.HandlerFunc, deleteFileHandler http.HandlerFunc, deleteFolderHandler http.HandlerFunc) http.Handler {
	mux := http.NewServeMux()

	cookieStore := sessions.NewCookieStore([]byte("test-session-secret"))
	cookieStore.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   86400,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	}

	mux.HandleFunc("POST /upload", uploadHandler)
	mux.HandleFunc("DELETE /delete/file/{id}", deleteFileHandler)
	mux.HandleFunc("DELETE /delete/folder/{id}", deleteFolderHandler)

	var finalHandler http.Handler = mux

	if authEnabled {
		authMiddleware := middleware.AuthMiddleware(cookieStore)
		finalHandler = authMiddleware(mux)
	}

	return finalHandler
}
