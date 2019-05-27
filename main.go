package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"

	"github.com/gobuffalo/packr"
)

const (
	primaryServerModsFile   = "/srv/games/servers/arma3_common/SOCOMD_mods.load"
	secondaryServerModsFile = "/srv/games/servers/arma3_common/SECONDARY_mods.load"
	startCMD                = "sudo -Hiu gameserver socomd-server start %s"
	stopCMD                 = "sudo -Hiu gameserver socomd-server stop %s"
	primaryName             = "SOCOMD"
	secondaryName           = "SECONDARY"
)

type armaAPI struct {
	Server   string   `json:"server"`
	Password string   `json:"password"`
	Mods     []string `json:"mods"`
}

func main() {
	data := packr.NewBox("./web")
	http.HandleFunc("/api/arma/start", start)
	http.HandleFunc("/api/arma/stop", stop)
	http.Handle("/", http.FileServer(data))
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func start(w http.ResponseWriter, r *http.Request) {
	var data armaAPI
	err := json.NewDecoder(r.Body).Decode(&data)
	if err != nil {
		w.Write([]byte("Failed to extract request data"))
		fmt.Println("failed to extract request data:", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	if len(data.Mods) == 0 {
		w.Write([]byte("Select a modset dickhead"))
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	if data.Server != "Primary" && data.Server != "Secondary" {
		w.Write([]byte("Incorrect Server specified"))
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	file := ""
	var launchCommand []string
	switch data.Server {
	case "Primary":
		file = primaryServerModsFile
		launchCommand = strings.Split(fmt.Sprintf(startCMD, primaryName), " ")

	case "Secondary":
		file = secondaryServerModsFile
		launchCommand = strings.Split(fmt.Sprintf(startCMD, secondaryName), " ")

	default:
		w.Write([]byte("How"))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	if len(launchCommand) < 2 {
		w.Write([]byte("Contact Zanven"))
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Printf("Command too short %#v\n", launchCommand)
		return
	}
	ioutil.WriteFile(file, []byte(strings.Join(data.Mods, "\n")), 0022)
	cmd := exec.Command(launchCommand[0], launchCommand[1:]...)
	cmd.Stdout = os.Stdout
	err = cmd.Run()
	if err != nil {
		w.Write([]byte("Failed to start game server"))
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Printf("failed to start game server: %s\n\nCommandLine: %s\nMods: %v\nServer: %s\n", err, launchCommand, data.Mods, data.Server)
		return
	}
}

func stop(w http.ResponseWriter, r *http.Request) {
	var data armaAPI
	err := json.NewDecoder(r.Body).Decode(&data)
	if err != nil {
		w.Write([]byte("Failed to extract request data"))
		fmt.Println("failed to extract request data:", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	var shutdownCommand []string
	switch data.Server {
	case "Primary":
		shutdownCommand = strings.Split(fmt.Sprintf(stopCMD, primaryName), " ")
	case "Secondary":
		shutdownCommand = strings.Split(fmt.Sprintf(stopCMD, secondaryName), " ")
	default:
		w.Write([]byte("no Server provided for shutdown"))
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	if len(shutdownCommand) < 2 {
		w.Write([]byte("Contact Zanven"))
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Printf("Command too short %#v\n", shutdownCommand)
		return
	}
	cmd := exec.Command(shutdownCommand[0], shutdownCommand[1:]...)
	cmd.Stdout = os.Stdout
	err = cmd.Run()
	if err != nil {
		w.Write([]byte("Failed to stop game server"))
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Printf("failed to stop game server: %s\n\nCommandLine: %s\nMods: %v\nServer: %s\n", err, shutdownCommand, data.Mods, data.Server)
		return
	}
}
