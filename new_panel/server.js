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

const primaryServerModsFile = "/srv/games/arma3/common/SOCOMD_mods.load";
const secondaryServerModsFile = "/srv/games/arma3/common/SECONDARY_mods.load";
const pidFilePath = "/home/gameserver/.local/";
const mainCMD = "socomd-server-win";
const startCMD = mainCMD + " start ";
const stopCMD = mainCMD + " stop ";
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
    try {
        Gamedig.query({
            type: 'arma3',
            host: 'socomd.com',
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
            res.setHeader('Content-Type', 'application/json');
            res.send(state);
        }).catch((error) => {
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
            var file = "";
            var fileText = "";
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
                    command = command + primaryName;
                    if (action == "on") {
                        file = primaryServerModsFile;
                    };
                    break;
                case "Secondary Server":
                    command = command + secondaryName;
                    if (action == "on") {
                        file = secondaryServerModsFile;
                    }
                    break;
            }
            if (action == "on" && req.body.logging) {
                command = command + " enableLogging";
            }
            if (file !== "") {
                try {

                    fs.readFile(`${__dirname}/public/json/core.json`, function(err, data) {
                        if (err) throw err;
                        var jsonData = JSON.parse(data)
                        for (mod of jsonData) {
                            fileText = fileText + mod.path + "\r\n";
                        };

                        if (req.body.extras.length > 0) {

                            req.body.extras.forEach(mod => {
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
                let sp = spawn(command, [''], {
                    detached: true
                });
                sp.on('error', (err) => {
                    error["repsonse"] = err.message;

                    res.send({
                        status: "Offline",
                        error: error,
                        map: "",
                        raw: { game: "" },
                        players: []
                    });
                });

                grep.stdout.on('data', (data) => {
                    sp.send({ response: "success" });
                });
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