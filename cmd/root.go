package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var (
	Version   = "1.1.5"
	BuildDate = "2025-10-12"
)

var rootCmd = &cobra.Command{
	Use:   "toss",
	Short: "toss is a simple local file sharing server",
	Long:  `A simple file sharing app built with Go for quick local file sharing.`,
	Run: func(cmd *cobra.Command, args []string) {

		fmt.Println("Use the 'help' command for help.")
	},
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
