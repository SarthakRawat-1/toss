package handlers

import (
	"errors"
	"net/http"

	"github.com/SarthakRawat-1/Toss/internal/paths"
	"github.com/SarthakRawat-1/Toss/internal/services"
	"github.com/SarthakRawat-1/Toss/internal/services/serverlog"
	"github.com/gorilla/sessions"
)

type AdminHandler struct {
	services *services.AdminService
	store    sessions.Store
}

func NewAdminHandler(services *services.AdminService, store sessions.Store) *AdminHandler {
	return &AdminHandler{services: services, store: store}
}

func (h *AdminHandler) LoginHandler(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		serverlog.Errorf("Failed to parse form: %v", err)
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}
	userName := r.PostFormValue("username")
	password := r.PostFormValue("password")

	adminFilePath, err := paths.GetAdminFilePath()
	if err != nil {
		serverlog.Errorf("Couldn't get path")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	authenticated, err := h.services.AuthAdmin(userName, password, adminFilePath)
	if err != nil {
		if errors.Is(err, services.ErrWrongPassword) || errors.Is(err, services.ErrUserNotFound) {
			serverlog.Warnf("Invlaid email or password:%v", err)
			http.Error(w, "Invalid email or password", http.StatusUnauthorized)
			return
		}
		serverlog.Errorf("Couldn't load list:%v", err)
		http.Error(w, "Couldn't load list", http.StatusInternalServerError)
		return
	}

	if authenticated {
		session, err := h.store.Get(r, "toss_session")
		if err != nil {
			serverlog.Errorf("Failed to get session: %v", err)
			http.Error(w, "Failed to get session", http.StatusInternalServerError)
			return
		}
		session.Values["user_id"] = userName
		if err := session.Save(r, w); err != nil {
			serverlog.Errorf("Failed to save session:%v", err)
			http.Error(w, "Failed to save session", http.StatusInternalServerError)
			return
		}
		serverlog.Infof("Login successful for admin:%s", userName)
		http.Redirect(w, r, "/dashboard", http.StatusFound)
		return
	}
}

func (h *AdminHandler) LogoutHandler(w http.ResponseWriter, r *http.Request) {
	session, err := h.store.Get(r, "toss_session")
	if err != nil {
		serverlog.Errorf("Failed to get session: %v", err)
		http.Error(w, "Failed to get session", http.StatusInternalServerError)
		return
	}
	for k := range session.Values {
		delete(session.Values, k)
	}
	session.Options.MaxAge = -1
	if err := session.Save(r, w); err != nil {
		serverlog.Errorf("Failed to logout:%v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error": "failed to logout"}`))
		return
	}
	serverlog.Infof("logged out sucssessful")
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"message": "logged out"}`))
}
