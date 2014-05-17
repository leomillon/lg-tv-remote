var express = require('express');
var router = express.Router();
var tvApi = require('../tv-api');

router.get('/discovery', function(req, res) {
    if (req.xhr) {
        tvApi.discovery(function (data) {
            console.log('Data:', data);
            res.set('Content-Type', 'application/json');
            res.send(data);
        });
    }
});

function simpleActivationCallback (res, err, data) {
    var status = data.statusCode;
    if (err) {
        status = 500;
    }
    res.send(status, data.body);
}

router.get('/key-pairing/start', function(req, res) {
    if (req.xhr) {
        tvApi.startKeyPairing(function (err, data) {
            simpleActivationCallback(res, err, data);
        });
    }
});

router.get('/key-pairing/end', function(req, res) {
    if (req.xhr) {
        tvApi.endKeyPairing(function (err, data) {
            simpleActivationCallback(res, err, data);
        });
    }
});

router.get('/cmd/:value', function(req, res) {
    if (req.xhr) {
        var cmdValue = req.params.value;
        tvApi.sendCmd(cmdValue, function (err, data) {
            simpleActivationCallback(res, err, data);
        });
    }
});

module.exports = router;
