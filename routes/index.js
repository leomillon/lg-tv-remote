var express = require('express');
var router = express.Router();
var KEYS = require("../tv-api/keys");

/* GET home page */
router.get('/', function(req, res) {
    var deviceId = req.session.deviceId;
    if (deviceId) {
        res.redirect('/controller');
    }
    else {
        res.render('index', { title: 'LG TV Remote' });
    }
});

/* GET controller page */
router.get('/controller', function(req, res) {
    var deviceId = req.session.deviceId;
    if (deviceId) {
        res.render('controller', { deviceId: deviceId, KEYS: KEYS });
    }
    else {
        res.redirect('/');
    }
});

module.exports = router;
