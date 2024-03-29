#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const Gamedig = require('gamedig');
const { exec, spawn } = require("child_process");
const { lookpath } = require('lookpath');
let jsonData = require(`${__dirname}/public/json/core.json`);


const app = express();
const port = 3131;

const primaryServerModsFile = "/home/gameserver/games/arma3/common/SOCOMD_mods.load";
const secondaryServerModsFile = "/home/gameserver/games/arma3/common/SECONDARY_mods.load";
const pidFilePath = "/home/gameserver/.local/";
const mainCMD = "/home/gameserver/.local/bin/socomd-server";
const hcCMD = "/home/gameserver/.local/bin/socomd-server";
const startCMD = "start";
const stopCMD = "stop";
const primaryName = "SOCOMD";
const secondaryName = "SECONDARY";
// Set public folder as root
app.use(express.static('public'));

// Parse POST data as URL encoded data
app.use(bodyParser.urlencoded({
    extended: true,
}));

// Parse POST data as JSON
app.use(bodyParser.json());

// Provide access to node_modules folder
app.use('/scripts', express.static(`${__dirname}/node_modules/`));


const errorHandler = (err, req, res) => {
    if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        res.status(403).send({ title: 'Server responded with an error', message: err.message });
    } else if (err.request) {
        // The request was made but no response was received
        res.status(503).send({ title: 'Unable to communicate with server', message: err.message });
    } else {
        // Something happened in setting up the request that triggered an Error
        res.status(500).send({ title: 'An unexpected error occurred', message: err.message });
    }
};

// Fetch Latest Currency Rates
app.post('/api/serverState', async(req, res) => {

    var fileName = primaryName;
    var serverHost = 'ops.socomd.com';
    if (req.body.port === 2402) {
        fileName = secondaryName;
        serverHost = 'sec.socomd.com'
    };
    try {
        Gamedig.query({
            type: 'arma3',
            host: serverHost,
            port: req.body.port,
            attemptTimeout: 500
        }).then((state) => {
            console.log(state);
            state["status"] = "Online";
            state["error"] = "none";
            let fileName = primaryName;
            if (req.body.port === 2402) { fileName = secondaryName }
            fs.readFile(`${pidFilePath}/${fileName}.pid`, function(err, data) {
                console.log(data)

                exec(`ps u ${data}`, (error, stdout, stderr) => {
                    if (error) {
                        console.log(`error: ${error.message}`);
                        error["repsonse"] = error.message;

                        res.send({
                            status: "Offline",
                            error: error,
                            map: "",
                            raw: { game: "" },
                            players: []
                        });
                    } else {
                        state["service"] = stdout
                        res.setHeader('Content-Type', 'application/json');
                        res.send(state);
                    }
                    if (stderr) {
                        console.log(`stderr: ${stderr}`);
                        error["repsonse"] = stderr;
                        res.send({
                            status: "Offline",
                            error: error,
                            map: "",
                            raw: { game: "" },
                            players: []
                        });
                    }
                    console.log(stdout)
                });
            });
        }).catch((error) => {
            fs.readFile(`${pidFilePath}/${fileName}.pid`, function(err, data) {
                console.log(data)

                exec(`ps u ${data}`, (error, stdout, stderr) => {
                    if (error) {
                        console.log(`error: ${error.message}`);
                        error["repsonse"] = error.message;

                        res.send({
                            status: "Offline",
                            error: error,
                            map: "",
                            raw: { game: "" },
                            players: []
                        });
                    } else {


                        res.send({
                            status: "Starting...",
                            service: stdout,
                            map: "",
                            raw: { game: "" },
                            players: []
                        });
                    }
                    if (stderr) {
                        console.log(`stderr: ${stderr}`);
                        error["repsonse"] = stderr;
                    }
                    console.log(stdout)
                });
            });
        });
    } catch (error) {
        errorHandler(error, req, res);
    }
});

app.post('/api/startServer', async(req, res) => {
    runCMD(req, res, "on");
});

app.post('/api/stopServer', async(req, res) => {
    runCMD(req, res, "off");
});

async function runCMD(req, res, action) {
    console.log(req)
    if (!!req.body.server) {
        const p = await lookpath(mainCMD);
        if (p) {
            var command = mainCMD;
            var logging = "";
            var file = "";
            var fileText = "";
            var server = "";
            switch (action) {
                case "on":
                    command = startCMD;
                    break;
                case "off":
                    command = stopCMD;
                    file = "";
                    break;
                default:
                    command = stopCMD;
                    file = "";
                    break;
            }
            switch (req.body.server) {
                case "Primary Server":
                    server = primaryName;
                    if (action == "on") {
                        file = primaryServerModsFile;
                    };
                    break;
                case "Secondary Server":
                    server = secondaryName;
                    if (action == "on") {
                        file = secondaryServerModsFile;
                    }
                    break;
            }
            if (action == "on" && req.body.logging) {
                logging = "enableLogging";
            }
            if (file !== "") {
                try {
                    let modPack = req.body.modPack;
                    let extrasBody = req.body.extras;
                    if (req.body.extras.length > 0) {
                        if (extrasBody.indexOf("dev") != -1) {
                            modPack = "mod-tests";
                            extrasBody.splice(extrasBody.indexOf("dev"), 1);
                        }
                    }
                    fs.readFile(`${__dirname}/public/json/${modPack}.json`, function(err, data) {
                        if (err) throw err;
                        var jsonData = JSON.parse(data)
                        for (mod of jsonData) {
                            fileText = fileText + mod.path + "\r\n";
                        };

                        if (extrasBody.length > 0) {

                            extrasBody.forEach(mod => {
                                fileText = fileText + mod + "\n";
                            });
                        }
                        console.log(fileText)
                        fs.writeFile(file, fileText, (err) => {
                            if (err) throw err;
                            console.log('Data written to file');
                        });
                    });
                } catch (error) {
                    errorHandler(error, req, res);
                }
            }
            console.log(command)
                // res.send({ response: "success", command: command });
            try {
                var child = spawn(mainCMD, [command, server, logging], {
                    detached: true,
                    stdio: ['ignore']
                });
                child.on("error", (error) => {
                    console.log(error)
                    res.send({ response: "error", error: error });
                })
                res.send({ response: "success", command: `${mainCMD} ${command} ${server} ${logging}`, logging: logging });
                child.unref()
            } catch (error) {
                errorHandler(error, req, res);
            }
        } else {
            console.log(`CM02: Action does not exist on this server: ${mainCMD}`)
            res.send({ error: { message: `CM02: Action does not exist on this server: ${mainCMD}` } });
        }
    } else {
        console.log("CM01: No server parameter")
        res.send({ error: { message: "CM01: No server parameter" } });
    }
}
// Redirect all traffic to index.html
app.use((req, res) => res.sendFile(`${__dirname}/public/index.html`));

app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log('listening on %d', port);
});
