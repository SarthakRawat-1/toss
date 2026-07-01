package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var aboutCmd = &cobra.Command{
	Use:   "about",
	Short: "About this tool",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println(`
  _____॰ss
 |_   _|___  ___ ___
   | | / _ \/ __/ __|
   | || (_) \__ \__ \
   |_| \___/|___/___/

toss is a lightweight CLI tool to start and stop a local file sharing server.

Usage:
  toss [command]

Available Commands:
  start       Start the server in the background
  stop        Stop the background server
  help        Show help for any command`)
	},
}

func init() {
	rootCmd.AddCommand(aboutCmd)
}
