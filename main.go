package main

import (
	"github.com/SarthakRawat-1/Toss/cmd"
	"github.com/SarthakRawat-1/Toss/internal/config"
)

func main() {

	config.LoadDotEnv()

	cmd.Execute()

}
