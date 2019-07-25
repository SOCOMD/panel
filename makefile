.PHONY: build
build:
	packr build -o socomd-panel main.go
setup:
	chmod +x ./go-install.sh
	./go-install.sh
	go get -u github.com/gobuffalo/packr/packr

deploy: build
	ssh $SSH_URL 'systemctl stop socomd-panel'
	ssh $SSH_URL 'mkdir -p /srv/http/panel.socomd.com'
	scp cp ./socomd-panel $SSH_URL:/srv/http/panel.socomd.com/socomd-panel 
	ssh $SSH_URL 'systemctl start socomd-panel'
