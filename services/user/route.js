const processes = require('./processes');

module.exports = {
    getDB: {
        method: 'GET',
        route: '/getDB',
        processes: [processes.getDB],
        required: {
           
        }
    },
    login: {
        method: 'POST',
        modules: ["crypto","log"], 
        type: "raw",
        route: '/login',

        jsonParam: {
            email: 'string',
            password: 'string'
        },
        processes: [processes.login],
        required: {
           
        }
    },
    loadUser: {
        method: 'GET',
        route: '/loadUser',
        type: "raw",
        processes: [processes.loadUser],
        required: {
           
        }
    },
    profile: {
        method: "GET",
        route: "/profile",
        type: "raw",
        //modules: ["crypto"], 
      
        processes: [  processes.loadUser,processes.profile],
        required: {}
    },
    logout: {
        method: "GET",
        route: "/logout",
        type: "raw",
        processes : [processes.logout],
        required: {}
    }
    
};
