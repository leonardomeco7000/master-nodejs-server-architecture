const modules = [
    "crypto",
    "log-nuovo",
    "mail"
];

function loadModules() {

    const loaded = {};

    for (const module of modules) {

        const name = module.split("-")[0];

        if (loaded[name]) {
            throw new Error(
                `Modulo duplicato: ${name} (${module})`
            );
        }

        loaded[name] = require(
            `./modules/${module}/modules`
        );
    }

    return loaded;
}

module.exports = {
    modules,
    loadModules
};