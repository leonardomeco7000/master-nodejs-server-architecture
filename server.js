const http = require("http");
const routes = require("./routes");
const { loadModules } = require("./modules");

/*

* ============================================================
* MODULES
* ============================================================
  */

const modules = loadModules();

/*

* ============================================================
* EXECUTE
* ============================================================
*
* Ogni processo riceve lo stesso oggetto data.
*
* JSON:
* 
  process(data)
  
*
* RAW:
* 
  process(req, res, data)
  
*
* Il risultato del processo rimane separato da data.
  */

async function execute(process, data, req = null, res = null, type = "json") {


const startDate = Date.now();
const start = performance.now();

let result;

if (type === "raw") {
    result = await process(req, res, data);
} else {
    result = await process(data);
}

const end = performance.now();
const endDate = Date.now();

return {
    result,
    process: process.name,
    startDate,
    endDate,
    duration: end - start
};


}

/*

* ============================================================
* EXECUTE ALL
* ============================================================
*
* I processi vengono sempre eseguiti in ordine.
*
* Lo stesso data viene passato per riferimento a tutti.
  */

async function executeAll(processes, data, req, res, type) {


const results = [];

for (const process of processes) {

    const execution = await execute(
        process,
        data,
        req,
        res,
        type
    );

    results.push(execution);

    /*
     * Se il processo ha già chiuso la risposta HTTP,
     * non dobbiamo fare altro.
     */

    if (res && res.writableEnded) {
        break;
    }

    /*
     * Se il processo restituisce valid:false,
     * la sequenza si interrompe.
     */

    if (
        execution.result &&
        execution.result.valid === false
    ) {
        break;
    }
}

return results;


}

/*

* ============================================================
* ROUTE MATCH
* ============================================================
*
* /user/:id
*
* diventa:
*
* {
* 
  id: "123"
  
* }
  */

function matchRoute(requestMethod, requestPath) {


for (const name of Object.keys(routes)) {

    const route = routes[name];

    if (route.method !== requestMethod) {
        continue;
    }

    const routeParts =
        route.route
            .split("/")
            .filter(Boolean);

    const requestParts =
        requestPath
            .split("/")
            .filter(Boolean);

    /*
     * Numero segmenti diverso.
     */

    if (routeParts.length !== requestParts.length) {
        continue;
    }

    const data = {};

    let matched = true;

    for (let i = 0; i < routeParts.length; i++) {

        const routePart = routeParts[i];
        const requestPart = requestParts[i];

        /*
         * Parametro dinamico
         *
         * :id
         */

        if (routePart.startsWith(":")) {

            const name =
                routePart.substring(1);

            data[name] =
                decodeURIComponent(requestPart);

        } else {

            if (routePart !== requestPart) {
                matched = false;
                break;
            }
        }
    }

    if (!matched) {
        continue;
    }

    return {
        name,
        route,
        params: data
    };
}

return null;


}

/*

* ============================================================
* TYPE CHECK
* ============================================================
  */

function checkType(value, type) {


if (type === "string") {
    return typeof value === "string";
}

if (type === "number") {
    return typeof value === "number" &&
           !Number.isNaN(value);
}

if (type === "boolean") {
    return typeof value === "boolean";
}

if (type === "object") {
    return typeof value === "object" &&
           value !== null &&
           !Array.isArray(value);
}

if (type === "array") {
    return Array.isArray(value);
}

return false;


}

/*

* ============================================================
* CONVERT TYPE
* ============================================================
*
* I parametri provenienti dal PATH sono sempre stringhe.
  */

function convertType(value, type) {


if (type === "number") {

    const converted = Number(value);

    if (Number.isNaN(converted)) {
        return value;
    }

    return converted;
}

if (type === "boolean") {

    if (value === "true") {
        return true;
    }

    if (value === "false") {
        return false;
    }

    return value;
}

if (type === "string") {
    return String(value);
}

return value;


}

/*

* ============================================================
* DECLARED
* ============================================================
*
* Controlla solamente i dati dichiarati dalla route.
*
* required:
*
* 1. cerca prima nel PATH
* 2. se non esiste nel PATH cerca in jsonParam
* 3. se non esiste da nessuna parte -> errore
*
* jsonParam:
*
* contiene solamente i parametri dichiarati
* nella configurazione della route.
  */

function isDeclared(data, required, jsonParam) {


for (const [name, type] of Object.entries(required || {})) {

    /*
     * ----------------------------------------------------
     * REQUIRED
     * ----------------------------------------------------
     *
     * Prima il parametro presente nella root
     * proveniente dal PATH.
     */

    let value = data[name];

    /*
     * Se non esiste nella root, cerchiamo
     * nel body JSON.
     */

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {

        if (
            data.jsonParam &&
            data.jsonParam[name] !== undefined
        ) {
            value = data.jsonParam[name];

            /*
             * Il parametro required trovato nel JSON
             * viene portato nella root di data.
             */

            data[name] = value;
        }
    }

    /*
     * Parametro non trovato.
     */

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return {
            valid: false,
            error: `Parametro richiesto mancante: ${name}`
        };
    }

    /*
     * Controllo tipo.
     */

    if (!checkType(value, type)) {

        return {
            valid: false,
            error: `Parametro ${name} deve essere ${type}`
        };
    }
}


/*
 * --------------------------------------------------------
 * JSON PARAM
 * --------------------------------------------------------
 *
 * Controlliamo solamente i parametri dichiarati
 * dalla route.
 */

for (
    const [name, type]
    of Object.entries(jsonParam || {})
) {

    /*
     * Il parametro JSON non è obbligatorio.
     */

    if (
        !data.jsonParam ||
        data.jsonParam[name] === undefined
    ) {
        continue;
    }

    const value =
        data.jsonParam[name];

    if (!checkType(value, type)) {

        return {
            valid: false,
            error:
                `Parametro jsonParam ${name} deve essere ${type}`
        };
    }
}


return {
    valid: true
};


}

/*

* ============================================================
* BODY
* ============================================================
  */

function readBody(req) {


return new Promise((resolve, reject) => {

    let body = "";

    req.on("data", chunk => {
        body += chunk;
    });

    req.on("end", () => {

        if (!body) {
            resolve({});
            return;
        }

        try {

            resolve(JSON.parse(body));

        } catch (error) {

            reject(
                new Error("JSON non valido")
            );
        }
    });

    req.on("error", reject);
});


}

/*

* ============================================================
* SEND JSON
* ============================================================
  */

function sendJSON(res, statusCode, object) {


if (res.writableEnded) {
    return;
}

const json =
    JSON.stringify(object);

res.writeHead(
    statusCode,
    {
        "Content-Type": "application/json",
        "Content-Length":
            Buffer.byteLength(json)
    }
);

res.end(json);


}

/*

* ============================================================
* SERVER
* ============================================================
  */

const server = http.createServer(
async (req, res) => {


    try {

        const url =
            new URL(
                req.url,
                `http://${req.headers.host}`
            );

        const requestPath =
            url.pathname;


        /*
         * ------------------------------------------------
         * TROVA ROUTE
         * ------------------------------------------------
         */

        const match =
            matchRoute(
                req.method,
                requestPath
            );

        if (!match) {

            sendJSON(
                res,
                404,
                {
                    valid: false,
                    error: "Route non trovata"
                }
            );

            return;
        }


        const route =
            match.route;


        /*
         * ------------------------------------------------
         * DATA
         * ------------------------------------------------
         *
         * I parametri del PATH rimangono nella root.
         */

        const data = {
            ...match.params
        };


        /*
         * ------------------------------------------------
         * BODY JSON
         * ------------------------------------------------
         *
         * Il body NON viene più copiato direttamente
         * nella root di data.
         *
         * Viene inserito in:
         *
         * data.jsonParam
         */

        data.jsonParam = {};

        if (
            req.method !== "GET" &&
            req.method !== "HEAD"
        ) {

            const body =
                await readBody(req);

            /*
             * Copiamo solamente i parametri dichiarati
             * dalla route.jsonParam.
             */

            for (
                const name
                of Object.keys(route.jsonParam || {})
            ) {

                if (body[name] !== undefined) {

                    data.jsonParam[name] =
                        body[name];
                }
            }
        }


        /*
         * ------------------------------------------------
         * MODULES
         * ------------------------------------------------
         *
         * La route dichiara i moduli necessari.
         *
         * data.modules contiene solamente quelli
         * esposti alla pipeline.
         */

        data.modules = {};

        for (
            const moduleName of
            route.modules || []
        ) {

            if (!modules[moduleName]) {

                sendJSON(
                    res,
                    500,
                    {
                        valid: false,
                        error:
                            `Modulo non disponibile: ${moduleName}`
                    }
                );

                return;
            }

            data.modules[moduleName] =
                modules[moduleName];
        }


        /*
         * ------------------------------------------------
         * DECLARED
         * ------------------------------------------------
         *
         * required:
         *
         * PATH
         *   ↓
         * jsonParam
         *
         * jsonParam viene inoltre controllato
         * secondo il tipo dichiarato nella route.
         */

        const declared =
            isDeclared(
                data,
                route.required,
                route.jsonParam
            );

        if (!declared.valid) {

            sendJSON(
                res,
                400,
                declared
            );

            return;
        }


        /*
         * ------------------------------------------------
         * PROCESSES
         * ------------------------------------------------
         *
         * Sempre array.
         *
         * Anche un solo processo:
         *
         * processes: [processes.getCart]
         */

        const processes =
            route.processes || [];


        if (!processes.length) {

            sendJSON(
                res,
                500,
                {
                    valid: false,
                    error:
                        "Nessun processo configurato"
                }
            );

            return;
        }


        /*
         * ------------------------------------------------
         * EXECUTION
         * ------------------------------------------------
         */

        const executions =
            await executeAll(
                processes,
                data,
                req,
                res,
                route.type || "json"
            );


        /*
         * ------------------------------------------------
         * RAW
         * ------------------------------------------------
         *
         * Il processo ha accesso diretto a res.
         */

        if (route.type === "raw") {

            if (!res.writableEnded) {

                const last =
                    executions[
                        executions.length - 1
                    ];

                if (last) {

                    sendJSON(
                        res,
                        200,
                        last.result
                    );
                }
            }

            return;
        }


        /*
         * ------------------------------------------------
         * JSON
         * ------------------------------------------------
         *
         * Il processo restituisce un object.
         *
         * Il server lo invia come JSON.
         */

        const last =
            executions[
                executions.length - 1
            ];


        if (!last) {

            sendJSON(
                res,
                200,
                {}
            );

            return;
        }


        /*
         * Se un processo ha prodotto valid:false,
         * propaghiamo il suo object.
         */

        if (
            last.result &&
            last.result.valid === false
        ) {

            sendJSON(
                res,
                400,
                last.result
            );

            return;
        }


        sendJSON(
            res,
            200,
            last.result
        );

    } catch (error) {

        console.error(error);

        if (!res.writableEnded) {

            sendJSON(
                res,
                500,
                {
                    valid: false,
                    error: error.message
                }
            );
        }
    }
}


);

/*

* ============================================================
* START
* ============================================================
  */

const PORT =
process.env.PORT || 20010;

server.listen(
PORT,
"0.0.0.0",
() => {


    console.log(
        `Server listening on port ${PORT}`
    );
}


);

/*

* ============================================================
* EXPORT
* ============================================================
  */

module.exports = {
server,
execute,
executeAll,
matchRoute,
isDeclared
};
