package testutil

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/SarthakRawat-1/Toss/internal/config"
	"github.com/SarthakRawat-1/Toss/internal/models"
	"github.com/SarthakRawat-1/Toss/internal/paths"
	"github.com/SarthakRawat-1/Toss/internal/services"
	storagesql "github.com/SarthakRawat-1/Toss/internal/storage/sql"
)

func SetTestEnv(tempDir string) {
	_ = os.Setenv("XDG_CONFIG_HOME", tempDir)
	_ = os.Setenv("LOCALDROP_ENV", "test")
}

func ResetStorage(t *testing.T) {
	t.Helper()

	db, err := storagesql.Init()
	if err != nil {
		t.Fatalf("failed to init storage: %v", err)
	}
	defer func() { _ = db.Close() }()

	r := storagesql.NewSQLRepository(db)

	filesPath, err := paths.GetFilesPath()
	if err != nil {
		t.Fatalf("failed to get files path: %v", err)
	}

	if r.GetDB() != nil {
		_ = r.Close()
	}

	_ = os.RemoveAll(filepath.Clean(filesPath))
	if err := os.MkdirAll(filesPath, 0o755); err != nil {
		t.Fatalf("failed to recreate files dir: %v", err)
	}

	configPath, err := paths.GetConfigPath()
	if err != nil {
		t.Fatalf("failed to get config path: %v", err)
	}
	_ = os.Remove(configPath)

	db2, err := storagesql.Init()
	if err != nil {
		t.Fatalf("failed to init storage: %v", err)
	}
	_ = db2.Close()
}

// StorageDeps aggregates the storage repository and services used in tests.
type StorageDeps struct {
	Repo          *storagesql.SQLRepository
	FileService   *services.FileService
	FolderService *services.FolderService
	AdminService  *services.AdminService
}

// SetupStorageDeps initializes storage and returns service dependencies along with a cleanup function.
func SetupStorageDeps(t *testing.T) (*StorageDeps, func()) {
	t.Helper()

	db, err := storagesql.Init()
	if err != nil {
		t.Fatalf("failed to init storage for tests: %v", err)
	}

	repo := storagesql.NewSQLRepository(db)
	fileSvc := services.NewFileService(repo)
	folderSvc := services.NewFolderService(repo, repo, fileSvc)
	adminSvc := services.NewAdminService(repo)

	cleanup := func() { _ = db.Close() }
	return &StorageDeps{
		Repo:          repo,
		FileService:   fileSvc,
		FolderService: folderSvc,
		AdminService:  adminSvc,
	}, cleanup
}

func LoadAndSaveConfig(t *testing.T, mutate func(*models.Config)) models.Config {
	t.Helper()

	cfg, err := config.GetConfig()
	if err != nil {
		t.Fatalf("failed to load config: %v", err)
	}

	if mutate != nil {
		mutate(&cfg)
	}

	if err := config.SaveConfig(&cfg); err != nil {
		t.Fatalf("failed to save config: %v", err)
	}
	return cfg
}
