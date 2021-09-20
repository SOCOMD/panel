window.addEventListener('load', () => {
    const el = $('#app');
    var core = {};
    $.getJSON("json/core.json", function(data) {
        core = data
    });
    var extrasList = {};
    $.getJSON("json/extras.json", function(data) {
        extrasList = data
    });
    var currentRoute = "/";
    var currentServer = "Primary Server";
    var currentPort = 2302;
    var timer = null;
    var infoUpdateTimer = null;
    var cpuGraphP = [];
    var cpuGraphS = [];
    
    var playerCountP = [];
    var playerCountS = [];
    // Compile Handlebar Templates
    const errorTemplate = Handlebars.compile($('#error-template').html());
    const serverDetailTemplate = Handlebars.compile($('#server-detailed-template').html());
    const serverTemplate = Handlebars.compile($('#server-overview-template').html());

    // compile partials
    Handlebars.registerPartial('serverInfo', $('#server-info-partial').html());
    Handlebars.registerPartial('playerList', $('#player-list-partial').html());

    Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
        return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });

    // Instantiate api handler
    const api = axios.create({
        baseURL: `${window.location.origin}/api`,
        timeout: 5000,
    });

    const router = new Router({
        mode: 'history',
        page404: (path) => {
            const html = errorTemplate({
                color: 'orange',
                title: 'Error 404 - Page NOT Found!',
                message: `The path '/${path}' does not exist on this site`,
            });
            el.html(html);
        },
    });

    // Display Error Banner
    const showError = (error) => {
        const { title, message } = error.response.data;
        const html = errorTemplate({ color: 'red', title, message });
        el.html(html);
    };

    router.add('/', async() => {
        currentRoute = "/";
        handleOverviewInfo()
    });

    router.add('/primary', async() => {
        currentRoute = "/primary";
        currentServer = "Primary Server";
        currentPort = 2302;
        await handleDetailedInfo(currentServer, currentPort)
    });

    router.add('/secondary', async() => {
        currentRoute = "/secondary";
        currentServer = "Secondary Server";
        currentPort = 2402;
        await handleDetailedInfo(currentServer, currentPort)
    });
    async function handleOverviewInfo() {

        let html = serverTemplate({ servers: { "Primary": {}, "Secondary": {} } }); // pass empty server objects to display structure on page load
        el.html(html);
        try {
            // Load Currency Rates
            const responsePrimary = await api.post('/serverState', { port: 2302 });
            const responseSecondary = await api.post('/serverState', { port: 2402 });
            // Display Rates Table
            var { statusPrimary, mapPrimary, missionPrimary, playersPrimary, playerCountPrimary } = { statusPrimary: responsePrimary.data.status, mapPrimary: responsePrimary.data.map, missionPrimary: responsePrimary.data.raw.game, playersPrimary: responsePrimary.data.players, playerCountPrimary: responsePrimary.data.players.length };
            let cpuP = "-";
            let upTimeP = "-"
            if (!!responsePrimary.data.service) {
                let arrP = responsePrimary.data.service.split("\n")
                arrP = arrP[1].split(/[ ]+/)
                cpuP = arrP[2];
                upTimeP = `Since ${arrP[8]} AEST`
            }
            var { statusSecondary, mapSecondary, missionSecondary, playersSecondary, playerCountSecondary } = { statusSecondary: responseSecondary.data.status, mapSecondary: responseSecondary.data.map, missionSecondary: responseSecondary.data.raw.game, playersSecondary: responseSecondary.data.players, playerCountSecondary: responseSecondary.data.players.length };
            let cpuS = "-";
            let upTimeS = "-";
            if (!!responseSecondary.data.service) {
                let arrS = responseSecondary.data.service.split("\n")
                arrS = arrS[1].split(/[ ]+/)
                cpuS = arrS[2]
                upTimeS = `Since ${arrS[8]} AEST`
            }
            var servers = {
                "Primary": {
                    "name":"Primary Server",
                    "status": statusPrimary,
                    "map": mapPrimary,
                    "mission": missionPrimary,
                    "players": playersPrimary,
                    "playerCount": playerCountPrimary,
                    "cpu": cpuP,
                    "uptime":upTimeP
                },
                "Secondary": {
                    "name":"Secondary Server",
                    "status": statusSecondary,
                    "map": mapSecondary,
                    "mission": missionSecondary,
                    "players": playersSecondary,
                    "playerCount": playerCountSecondary,
                    "cpu": cpuS,
                    "uptime":upTimeS
                },
            };
            html = serverTemplate({ servers: servers });
            el.html(html);
            $('.loading').removeClass('loading');
        } catch (error) {
            // showError(error);
        }
    }
    async function handleDetailedInfo(name, port) {
        let html = serverDetailTemplate();
        el.html(html);
        try {
            const response = await api.post('/serverState', { port: port });
            console.log(response.data)
            var { name, color, players, status, map, mission } = { name: name, color: "blue", players: response.data.players, status: response.data.status, map: response.data.map, mission: response.data.raw.game };
            let cpuS = "-",upTimeS = "-";
            if (!!response.data.service) {
                let arrS = response.data.service.split("\n")
                arrS = arrS[1].split(/[ ]+/)
                cpuS = arrS[2]
                upTimeS = `Since ${arrS[8]} AEST`
            }
            html = serverDetailTemplate({ name, color, players, extras: extrasList, status, map, mission, playerCount: players.length, cpu: cpuS, uptime: upTimeS });
            el.html(html);
            $('.loading').removeClass('loading');
            $(".dropdown").dropdown();
            $("#turnOn").on("click", async() => {
                var enableLogging = $("#logging").is(":checked");
                var selected = $("#extras-select").val();
                console.log()
                let res = await api.post('/startServer', { server: name, extras: selected, logging: enableLogging });
                if (res.data.response === "success") {
                    handleDetailedInfo(name, port);
                    $('.message').addClass("positive").removeClass("negative").find(".header").text("Server has been started")

                    $('.message').find('.message-content').show().text("Please wait for up to a minute for it to be ready");
                } else {
                    console.log(res.data.error.message)
                    $('.message').removeClass("positive").addClass("negative").find(".header").text("There was an issue starting the server")

                    $('.message').find('.message-content').show().text(res.data.error.message);
                }
                if ($(".message").hasClass("hidden")) {
                    $(".message").transition('fade')
                }
                toastTimeout()
            })

            $("#turnOff").on("click", async() => {
                let res = await api.post('/stopServer', { server: name, extras: [] })
                if (res.data.response === "success") {
                    handleDetailedInfo(name, port);

                    $('.message-content').hide()
                    $('.message').addClass("positive").removeClass("negative").find(".header").text("Server has been stopped")

                } else {
                    $('.message').removeClass("positive").addClass("negative").find(".header").text("There was an issue stopping the server")
                    $('.message').find('.message-content').show().text(res.data.error.message);
                }

                if ($(".message").hasClass("hidden")) {
                    $(".message").transition('fade')
                }
                toastTimeout()
            })
        } catch (error) {
            showError(error);
        }
    }

    async function handleInfoRefresh() {
        if (currentRoute == "/") {
            handleOverviewInfo()
        } else {
            handleDetailedInfo(currentServer, currentPort)
        }
    }

    // handle data retrieval loop. updates once every 5 seconds
    async function handleInfoUpdate(){
        // update immediately, then loop
        try {
            // Load Currency Rates
            const responsePrimary = await api.post('/serverState', { port: 2302 });
            const responseSecondary = await api.post('/serverState', { port: 2402 });
            // Display Rates Table
            var { statusPrimary, mapPrimary, missionPrimary, playersPrimary, playerCountPrimary } = { statusPrimary: responsePrimary.data.status, mapPrimary: responsePrimary.data.map, missionPrimary: responsePrimary.data.raw.game, playersPrimary: responsePrimary.data.players, playerCountPrimary: responsePrimary.data.players.length };
            let cpuP = 0;
            if (!!responsePrimary.data.service) {
                let arrP = responsePrimary.data.service.split("\n")
                arrP = arrP[1].split(/[ ]+/)
                cpuP = parseFloat(arrP[2]);
                $(".Primary.Server .cpu-usage").text(`${cpuP}%`)
            }
            switch(statusPrimary){
                case "Online" : {
                    if(!$(".Primary.Server .status-section .cog.icon").hasClass("green")){
                        $(".Primary.Server .status-section .cog.icon").removeClass("red").addClass("green")
                        $(".Primary.Server .status-section .status-text").css("color","green").text(statusPrimary)
                    }
                }; break;
                
                case "Offline" : {
                    if(!$(".Primary.Server .status-section .cog.icon").hasClass("red")){
                        $(".Primary.Server .status-section .cog.icon").addClass("red").removeClass("green")
                        $(".Primary.Server .status-section .status-text").css("color","red").text(statusPrimary)
                    }
                }; break;
                
                case "Starting..." : {
                    if($(".Primary.Server .status-section .cog.icon").hasClass("green") || $(".Primary.Server .status-section .cog.icon").hasClass("red")){
                        $(".Primary.Server .status-section .cog.icon").removeClass("red").removeClass("green")
                        $(".Primary.Server .status-section .status-text").css("color","").text(statusPrimary)
                    }
                }; break;
            }
            $(".Primary.Server .map-selection").text(mapPrimary)
            $(".Primary.Server .mission-selection").text(missionPrimary)
            $(".Primary.Server .player-count").text(playerCountPrimary)
            // set last 30 updates
            if(cpuGraphP.length > 30) {
                cpuGraphP.splice(0,1);
            }
            cpuGraphP.push(cpuP)
            
            if(playerCountP.length > 30) {
                playerCountP.splice(0,1);
            }
            playerCountP.push(playerCountPrimary)

            // handle secondary
            var { statusSecondary, mapSecondary, missionSecondary, playersSecondary, playerCountSecondary } = { statusSecondary: responseSecondary.data.status, mapSecondary: responseSecondary.data.map, missionSecondary: responseSecondary.data.raw.game, playersSecondary: responseSecondary.data.players, playerCountSecondary: responseSecondary.data.players.length };
            let cpuS = 0;
            if (!!responseSecondary.data.service) {
                let arrS = responseSecondary.data.service.split("\n")
                arrS = arrS[1].split(/[ ]+/)
                cpuS = parseFloat(arrS[2])
                $(".Secondary.Server .cpu-usage").text(`${cpuS}%`)
            }
            switch(statusSecondary){
                case "Online" : {
                    if(!$(".Secondary.Server .status-section .cog.icon").hasClass("green")){
                        $(".Secondary.Server .status-section .cog.icon").removeClass("red").addClass("green")
                        $(".Secondary.Server .status-section .status-text").css("color","green").text(statusSecondary)
                    }
                }; break;
                
                case "Offline" : {
                    if(!$(".Secondary.Server .status-section .cog.icon").hasClass("red")){
                        $(".Secondary.Server .status-section .cog.icon").addClass("red").removeClass("green")
                        $(".Secondary.Server .status-section .status-text").css("color","red").text(statusSecondary)
                    }
                }; break;
                
                case "Starting..." : {
                    if($(".Secondary.Server .status-section .cog.icon").hasClass("green") || $(".Secondary.Server .status-section .cog.icon").hasClass("red")){
                        $(".Secondary.Server .status-section .cog.icon").removeClass("red").removeClass("green")
                        $(".Secondary.Server .status-section .status-text").css("color","").text(statusSecondary)
                    }
                }; break;
            }
            $(".Secondary.Server .map-selection").text(mapSecondary)
            $(".Secondary.Server .mission-selection").text(missionSecondary)
            $(".Secondary.Server .player-count").text(playerCountSecondary)
            
            // set last 30 updates
            if(cpuGraphS.length > 30) {
                cpuGraphS.splice(0,1);
            }
            cpuGraphS.push(cpuS)
            
            if(playerCountS.length > 30) {
                playerCountS.splice(0,1);
            }
            console.log("cached data",cpuGraphP, playerCountP,cpuGraphS,playerCountS);
            playerCountS.push(playerCountSecondary)
        } catch(error){
            console.error(error)
        }
        
        if (infoUpdateTimer != null) {
            window.clearTimeout(infoUpdateTimer);
        }
        infoUpdateTimer = window.setTimeout(() => {
            handleInfoUpdate()
        }, 5000);
    }
    handleInfoUpdate()
    router.navigateTo(window.location.pathname);

    // Highlight Active Menu on Load
    const link = $(`a[href$='${window.location.pathname}']`);
    link.addClass('active');

    // handling interactions
    $("#refresh").on("click", (event) => {
        handleInfoRefresh();
    })
    $('a').on('click', (event) => {
        // Block page load
        event.preventDefault();

        // Highlight Active Menu on Click
        const target = $(event.target);
        $('.item').removeClass('active');
        target.addClass('active');

        // Navigate to clicked url
        const href = target.attr('href');
        const path = href.substr(href.lastIndexOf('/'));
        router.navigateTo(path);
    });
    // close notification
    $('.message .close')
        .on('click', function() {
            $(this)
                .closest('.message')
                .transition('fade');

            $(".message")
                .find('.message-content')
                .addClass('hidden');
        });

    function toastTimeout() {
        if (timer != null) {
            window.clearTimeout(timer);
        }
        timer = window.setTimeout(() => {
            timer = null;
            $(".message").transition('fade')
        }, 7000);;
    }
});