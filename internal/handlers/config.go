package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/SarthakRawat-1/Toss/internal/config"
	"github.com/SarthakRawat-1/Toss/internal/models"
	"github.com/SarthakRawat-1/Toss/internal/services/serverlog"
)

func GetConfig(w http.ResponseWriter, r *http.Request) {
	userConfig, err := config.GetConfig()
	if err != nil {
		serverlog.Errorf("config file error, %v", err)
		http.Error(w, "config loading error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(userConfig)
}

func UpdateConfig(w http.ResponseWriter, r *http.Request) {
	var requestBody models.Config

	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		serverlog.Errorf("Failed to parse config file, error:%v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error": "Error parsing file"}`))
		return
	}

	if err := requestBody.Validate(); err != nil {
		serverlog.Warnf("invalid config update: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error": "Error validating file"}`))
		return
	}

	err := config.SaveConfig(&requestBody)
	if err != nil {
		serverlog.Errorf("Failed to save config file, error:%v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error": "Error saving file"}`))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status": "saved"}`))
}
