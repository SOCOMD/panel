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
    // Compile Handlebar Templates
    const errorTemplate = Handlebars.compile($('#error-template').html());
    const serverDetailTemplate = Handlebars.compile($('#server-detailed-template').html());
    const serverTemplate = Handlebars.compile($('#server-overview-template').html());

    Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
        return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });

    // Instantiate api handler
    const api = axios.create({
        baseURL: 'http://localhost:3000/api',
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

    // Display Latest Currency Rates
    router.add('/', async() => {
        currentRoute = "/";
        handleOverviewInfo()
    });

    router.add('/primary', async() => {
        // Display loader first
        currentRoute = "/primary";
        currentServer = "Primary Server";
        currentPort = 2302;
        // $(".will-load").addClass("loading")
        await handleDetailedInfo(currentServer, currentPort)
    });

    router.add('/secondary', async() => {
        currentRoute = "/secondary";
        currentServer = "Secondary Server";
        currentPort = 2402;
        // $(".will-load").addClass("loading")
        await handleDetailedInfo(currentServer, currentPort)
    });
    async function handleOverviewInfo() {

        let html = serverTemplate();
        el.html(html);
        try {
            // Load Currency Rates
            const responsePrimary = await api.post('/serverState', { port: 2302 });
            const responseSecondary = await api.post('/serverState', { port: 2402 });
            // Display Rates Table

            var { statusPrimary, mapPrimary, missionPrimary, playersPrimary, playerCountPrimary } = { statusPrimary: responsePrimary.data.status, mapPrimary: responsePrimary.data.map, missionPrimary: responsePrimary.data.raw.game, playersPrimary: responsePrimary.data.players, playerCountPrimary: responsePrimary.data.players.length };

            var { statusSecondary, mapSecondary, missionSecondary, playersSecondary, playerCountSecondary } = { statusSecondary: responseSecondary.data.status, mapSecondary: responseSecondary.data.map, missionSecondary: responseSecondary.data.raw.game, playersSecondary: responseSecondary.data.players, playerCountSecondary: responseSecondary.data.players.length };
            html = serverTemplate({ statusPrimary, mapPrimary, missionPrimary, playersPrimary, playerCountPrimary, statusSecondary, mapSecondary, missionSecondary, playersSecondary, playerCountSecondary });
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
            // Load Currency Rates
            const response = await api.post('/serverState', { port: port });
            // if (response.data.status === "Online") {
            console.log(response.data)
            var { name, color, players, status, map, mission } = { name: name, color: "blue", players: response.data.players, status: response.data.status, map: response.data.map, mission: response.data.raw.game };
            // Display Rates Table
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
                }
            })

            $("#turnOff").on("click", async() => {
                let res = await api.post('/stopServer', { server: name, extras: [] })
                if (res.data.response === "success") {
                    handleDetailedInfo(name, port);
                }
            })
        } catch (error) {
            // showError(error);
        }
    }

    async function handleInfoUpdate() {
        if (currentRoute == "/") {
            handleOverviewInfo()
        } else {
            handleDetailedInfo(currentServer, currentPort)
        }
    }
    // setTimeout(() => {
    //     
    // }, 5000)
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
});