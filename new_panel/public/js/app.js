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

            var { statusSecondary, mapSecondary, missionSecondary, playersSecondary, playerCountSecondary } = { statusSecondary: responseSecondary.data.status, mapSecondary: responseSecondary.data.map, missionSecondary: responseSecondary.data.raw.game, playersSecondary: responseSecondary.data.players, playerCountSecondary: responseSecondary.data.players.length };
            var servers = {
                "Primary": {
                    "status": statusPrimary,
                    "map": mapPrimary,
                    "mission": missionPrimary,
                    "players": playersPrimary,
                    "playerCount": playerCountPrimary,
                },
                "Secondary": {
                    "status": statusSecondary,
                    "map": mapSecondary,
                    "mission": missionSecondary,
                    "players": playersSecondary,
                    "playerCount": playerCountSecondary,
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
            html = serverDetailTemplate({ name, color, players, extras: extrasList, status, map, mission, playerCount: players.length });
            el.html(html);
            $('.loading').removeClass('loading');
            $(".dropdown").dropdown();
            $("#turnOn").on("click", async() => {
                var selected = $("#extras-select").val()
                console.log()
                let res = await api.post('/startServer', { server: name, extras: selected })
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

    async function handleInfoUpdate() {
        if (currentRoute == "/") {
            handleOverviewInfo()
        } else {
            handleDetailedInfo(currentServer, currentPort)
        }
    }
    router.navigateTo(window.location.pathname);

    // Highlight Active Menu on Load
    const link = $(`a[href$='${window.location.pathname}']`);
    link.addClass('active');

    // handling interactions
    $("#refresh").on("click", (event) => {
        handleInfoUpdate();
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