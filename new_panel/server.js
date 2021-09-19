#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const Gamedig = require('gamedig');
const { exec } = require("child_process");
const { lookpath } = require('lookpath');
let jsonData = require(`${__dirname}/public/json/core.json`);


const app = express();
const port = 3131;

const primaryServerModsFile = "/srv/games/servers/arma3_common/SOCOMD_mods.load";
const secondaryServerModsFile = "/srv/games/servers/arma3_common/SECONDARY_mods.load";
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
            res.setHeader('Content-Type', 'application/json');
            res.send(state);
        }).catch((error) => {
            res.send({ status: "Offline", error: error, map: "", raw: { game: "" }, players: [] });
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
    if (!!req.body.server) {
        const p = await lookpath(mainCMD);
        if (p) {
            var command = mainCMD;
            var file = "";
            var fileText = "";
            switch (action) {
                case "on":
                    command = command + startCMD;
                    break;
                case "off":
                    command = command + stopCMD;
                    file = "";
                    break;
                default:
                    command = command + stopCMD;
                    file = "";
                    break;
            }
            switch (req.body.server) {
                case "Primary Server":
                    command = command + primaryName;
                    file = primaryServerModsFile;
                    break;
                case "Secondary Server":
                    command = command + secondaryName;
                    file = secondaryServerModsFile;
                    break;
            }
            if (file !== "") {
                try {

                    fs.readFile(`${__dirname}/public/json/core.json`, function(err, data) {
                        if (err) throw err;
                        var jsonData = JSON.parse(data)
                        for (mod of jsonData) {
                            fileText = fileText + mod.path + "\n";
                        };

                        if (req.body.extras.length > 0) {

                            req.body.extras.forEach(mod => {
                                fileText = fileText + mod + "\n";
                            });
                        }
                        console.log(fileText)
                        fs.writeFile(file, JSON.stringify(fileText), (err) => {
                            if (err) throw err;
                            console.log('Data written to file');
                        });
                    });
                } catch (error) {
                    errorHandler(error, req, res);
                }
            }
            console.log(command)
            try {
                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        console.log(`error: ${error.message}`);
                        errorHandler(error, req, res);
                    }
                    if (stderr) {
                        console.log(`stderr: ${stderr}`);
                        errorHandler(error, req, res);
                    }
                    console.log(`stdout: ${stdout}`);
                    res.send({ response: "success" });
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