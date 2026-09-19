const crypto = require("node:crypto");

function createHash(value) {

    return crypto
        .createHash("md5")
        .update(value)
        .digest("hex");
}

function isSameHash(value, hash) {

    return createHash(value) === hash;
}

module.exports = {
    createHash,
    isSameHash
};  