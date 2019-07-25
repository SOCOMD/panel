.PHONY: build
build:
	packr build -o socomd-panel main.go
setup:
	chmod +x ./go-install.sh
	./go-install.sh
	go get -u github.com/gobuffalo/packr/packr

deploy: build
	mkdir -p /srv/http/panel.socomd.com
	cp ./socomd-panel /srv/http/panel.socomd.com/socomd-panel 
