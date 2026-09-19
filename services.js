const services = [
    "user"
];

function loadServices() {
    const routes = {};

    for (const service of services) {
        const serviceRoutes = require(`./services/${service}/route`);
        
        Object.assign(routes, serviceRoutes);
    }

    return routes;
}

module.exports = {
    services,
    loadServices
};
