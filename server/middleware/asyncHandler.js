function acyncHandler(callback) {
    return (req, res, next) => {
        Promise
            .resolve(callback(req, res, next))
            .catch(next)
    };
}

module.exports = acyncHandler;