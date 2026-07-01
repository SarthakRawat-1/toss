package internal

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"strings"

	"github.com/SarthakRawat-1/Toss/internal/config"
	"github.com/SarthakRawat-1/Toss/internal/handlers"
	"github.com/SarthakRawat-1/Toss/internal/middleware"
	"github.com/SarthakRawat-1/Toss/internal/models"
	"github.com/SarthakRawat-1/Toss/internal/paths"
	"github.com/SarthakRawat-1/Toss/internal/services"
	"github.com/SarthakRawat-1/Toss/internal/services/serverlog"
	storagesql "github.com/SarthakRawat-1/Toss/internal/storage/sql"
	"github.com/gorilla/sessions"
	"github.com/hashicorp/mdns"
)

//go:embed static
var staticFS embed.FS

type Server struct {
	router        http.Handler
	dns           *mdns.Server
	root          *models.Folder
	config        *models.Config
	folderHandler *handlers.FolderHandler
	fileHandler   *handlers.FileHandler
	adminHandler  *handlers.AdminHandler
	uploadHandler *handlers.UploadHandler
}

func NewServer(port *int, authEnabled *bool, loggingLevel *string) (*Server, error) {
	var server Server
	serverConfig, err := config.GetConfig()
	if err != nil {
		serverlog.Errorf("Faild to get server config")
		return nil, fmt.Errorf("failed to get server config: %w", err)
	}
	if port != nil {
		serverConfig.App.Port = *port
	}
	if authEnabled != nil {
		serverConfig.Auth.Enabled = *authEnabled
	}
	if loggingLevel != nil && *loggingLevel != "" {
		serverConfig.Logging.Level = *loggingLevel
	}

	err = serverConfig.Validate()
	if err != nil {
		serverlog.Errorf("Invalid parameters:%v", err)
		return nil, fmt.Errorf("invalid parameters:%w", err)
	}
	server.config = &serverConfig
	err = config.SaveConfig(&serverConfig)
	if err != nil {
		serverlog.Errorf("failed to save config to disk:%v", err)
		return nil, fmt.Errorf("failed to save config to disk:%w", err)
	}

	return &server, nil
}

func getSecretKey() []byte {
	if key, ok := config.GetString("SESSION_SECRET"); ok {
		return []byte(key)
	}

	if config.IsProduction() {
		serverlog.Errorf("SESSION_SECRET is required in production (set SESSION_SECRET, or LOCALDROP_ENV=prod/production)")
		return nil
	}

	if config.GetBoolDefault("SESSION_SECRET_RANDOM", false) {
		serverlog.Warnf("SESSION_SECRET_RANDOM=true; using a random per-start session secret")
		key, err := services.GenerateSessionKey()
		if err != nil {
			serverlog.Errorf("Failed to generate random session secret: %v", err)
			return nil
		}
		return key
	}

	serverlog.Warnf("SESSION_SECRET not set; using an insecure default dev session secret")
	return []byte("toss-dev-session-secret-change-me")
}

func getSessionCookieSecureDefault() bool {
	return config.IsProduction()
}

func getSessionCookieSecure() bool {
	return config.GetBoolDefault("SESSION_COOKIE_SECURE", getSessionCookieSecureDefault())
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		serverlog.Infof("%s %s %s", r.Method, r.URL.Path, r.RemoteAddr)
		next.ServeHTTP(w, r)
	})
}

func isProtectedAPIPath(path string) bool {
	protected := []string{"/upload", "/delete/file/", "/delete/folder/", "/config/api"}
	for _, p := range protected {
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}

func (s *Server) setupRouter(fileHandler *handlers.FileHandler, folderHandler *handlers.FolderHandler, adminHandler *handlers.AdminHandler, uploadHandler *handlers.UploadHandler) error {
	mux := http.NewServeMux()

	staticSubFS, err := fs.Sub(staticFS, "static")
	if err != nil {
		serverlog.Errorf("Failed to create static sub-filesystem: %v", err)
		return err
	}

	serveHTML := func(path string) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			data, readErr := fs.ReadFile(staticSubFS, path)
			if readErr != nil {
				serverlog.Errorf("Failed to read embedded html %s: %v", path, readErr)
				http.Error(w, "page not found", http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(data)
		}
	}

	assetsSubFS, err := fs.Sub(staticSubFS, "assets")
	if err != nil {
		serverlog.Errorf("Failed to create assets sub-filesystem: %v", err)
		return err
	}

	// Serve CSS/JS assets directly
	mux.Handle("GET /assets/", http.StripPrefix("/assets/", http.FileServer(http.FS(assetsSubFS))))

	cookieStore := sessions.NewCookieStore(getSecretKey())
	cookieStore.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   86400 * 7,
		HttpOnly: true,
		Secure:   getSessionCookieSecure(),
		SameSite: http.SameSiteLaxMode,
	}

	// All frontend page paths serve the same single-page App index.html shell
	serveIndex := serveHTML("index.html")
	mux.HandleFunc("GET /", serveIndex)
	mux.HandleFunc("GET /download", serveIndex)
	mux.HandleFunc("GET /login", serveIndex)
	mux.HandleFunc("GET /dashboard", serveIndex)
	mux.HandleFunc("GET /config", serveIndex)
	mux.HandleFunc("GET /admin", serveIndex)

	mux.HandleFunc("GET /auth/status", func(w http.ResponseWriter, r *http.Request) {
		session, err := cookieStore.Get(r, "toss_session")
		loggedIn := false
		var userID interface{}
		if err == nil {
			userID = session.Values["user_id"]
			if userID != nil {
				loggedIn = true
			}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		resp := map[string]interface{}{
			"loggedIn":    loggedIn,
			"authEnabled": s.config.Auth.Enabled,
			"localIp":     s.getLocalIP(),
			"port":        s.config.App.Port,
		}
		if loggedIn {
			resp["user"] = userID
		}
		_ = json.NewEncoder(w).Encode(resp)
	})

	mux.HandleFunc("GET /rootfilesandfolders", folderHandler.GetRootFilesAndFoldersHandler)
	mux.HandleFunc("GET /folder/content/{id}", folderHandler.GetFolderHandler)
	mux.HandleFunc("GET /listOfFiles", folderHandler.GetRootFolderHandler)
	mux.HandleFunc("POST /login", adminHandler.LoginHandler)
	mux.HandleFunc("POST /logout", adminHandler.LogoutHandler)
	mux.HandleFunc("GET /download/{id}", fileHandler.DownloadFileHandler)
	mux.HandleFunc("GET /download-folder/{id}", folderHandler.DownloadFolderHandler)

	var finalHandler http.Handler = mux

	if s.config.Auth.Enabled {
		authMiddleware := middleware.AuthMiddleware(cookieStore)
		protectedMux := http.NewServeMux()

		protectedMux.HandleFunc("POST /upload", uploadHandler.UploadHandler)
		protectedMux.HandleFunc("DELETE /delete/file/{id}", fileHandler.DeleteFileHandler)
		protectedMux.HandleFunc("DELETE /delete/folder/{id}", folderHandler.DeleteFolderHandler)

		protectedMux.HandleFunc("GET /config/api", handlers.GetConfig)
		protectedMux.HandleFunc("PUT /config/api", handlers.UpdateConfig)

		protectedHandler := authMiddleware(protectedMux)

		finalHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			path := r.URL.Path
			if isProtectedAPIPath(path) {
				protectedHandler.ServeHTTP(w, r)
			} else {
				mux.ServeHTTP(w, r)
			}
		})
		finalHandler = corsMiddleware(finalHandler)
	} else {
		// When auth is disabled, register API routes on mux directly:
		mux.HandleFunc("POST /upload", uploadHandler.UploadHandler)
		mux.HandleFunc("DELETE /delete/file/{id}", fileHandler.DeleteFileHandler)
		mux.HandleFunc("DELETE /delete/folder/{id}", folderHandler.DeleteFolderHandler)
		mux.HandleFunc("GET /config/api", handlers.GetConfig)
		mux.HandleFunc("PUT /config/api", handlers.UpdateConfig)

		finalHandler = corsMiddleware(mux)
	}

	if s.config.Logging.Enabled {
		level := serverlogLevel(s.config.Logging.Level)
		if level == "debug" || level == "info" {
			finalHandler = loggingMiddleware(finalHandler)
		}
	}

	s.router = finalHandler
	return nil
}

func serverlogLevel(level string) string {
	value := strings.ToLower(strings.TrimSpace(level))
	if value == "" {
		return "info"
	}
	return value
}

func (s *Server) getLocalIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "127.0.0.1"
	}
	for _, addr := range addrs {
		if ipNet, ok := addr.(*net.IPNet); ok && !ipNet.IP.IsLoopback() {
			if ipNet.IP.To4() != nil {
				return ipNet.IP.String()
			}
		}
	}
	return "127.0.0.1"
}

func (s *Server) setupMDNS() error {
	localIP := net.ParseIP(s.getLocalIP())

	service, err := mdns.NewMDNSService(
		"Toss",
		"_http._tcp",
		"",
		"toss.local.",
		s.config.App.Port,
		[]net.IP{localIP},
		[]string{"path=/"},
	)
	if err != nil {
		return fmt.Errorf("failed to create mDNS service: %w", err)
	}

	s.dns, err = mdns.NewServer(&mdns.Config{Zone: service})
	if err != nil {
		return fmt.Errorf("failed to start mDNS server: %w", err)
	}

	serverlog.Infof("mDNS server started: %s:%d (IP: %s)", "toss.local.", s.config.App.Port, localIP)
	return nil
}

func (s *Server) Init() error {
	var err error
	if err := paths.Initialize(); err != nil {
		return fmt.Errorf("failed to initialize paths: %w", err)
	}

	db, err := storagesql.Init()
	if err != nil {
		return fmt.Errorf("failed to initialize storage: %w", err)
	}

	repo := storagesql.NewSQLRepository(db)

	fileSvc := services.NewFileService(repo)
	folderSvc := services.NewFolderService(repo, repo, fileSvc)
	adminSvc := services.NewAdminService(repo)

	cookieStore := sessions.NewCookieStore(getSecretKey())
	cookieStore.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   86400 * 7,
		HttpOnly: true,
		Secure:   getSessionCookieSecure(),
		SameSite: http.SameSiteLaxMode,
	}

	s.folderHandler = handlers.NewFolderHandler(folderSvc, fileSvc)
	s.fileHandler = handlers.NewFileHandler(fileSvc)
	s.adminHandler = handlers.NewAdminHandler(adminSvc, cookieStore)
	s.uploadHandler = handlers.NewUploadHandler(folderSvc, fileSvc)

	if err := s.setupRouter(s.fileHandler, s.folderHandler, s.adminHandler, s.uploadHandler); err != nil {
		return fmt.Errorf("failed to setup router: %w", err)
	}

	if err := s.setupMDNS(); err != nil {
		return fmt.Errorf("failed to setup mDNS: %w", err)
	}

	s.root, err = repo.GetRoot()
	if err != nil {
		return fmt.Errorf("failed to get root folder: %w", err)
	}

	return nil
}

func (s *Server) Start() error {
	return http.ListenAndServe(fmt.Sprintf(":%d", s.config.App.Port), s.router)
}
