function errorhandler(error, req, res, next) {
    console.log(error);
    
    res.status(500).json({
        message: "Внутренняя ошибка сервера"
    });
}

module.exports = errorhandler;