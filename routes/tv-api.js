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

function defaultResponse (res, err, data) {
    var status = data.statusCode;
    if (err) {
        status = 500;
    }
    res.send(status, data.body);
}

router.get('/device/:uuid/display-key', function(req, res) {
    if (req.xhr) {
        var uuid = req.params.uuid;
        tvApi.displayKey(uuid, function (err, data) {
            data.body = err === null;
            defaultResponse(res, err, data);
        });
    }
});

router.get('/device/:uuid/start-pairing/:key', function(req, res) {
    if (req.xhr) {
        var uuid = req.params.uuid;
        var key = req.params.key;
        tvApi.startPairing(uuid, key, function (err, data) {
            data.body = err === null;
            defaultResponse(res, err, data);
        });
    }
});

router.get('/device/:uuid/end-pairing/', function(req, res) {
    if (req.xhr) {
        var uuid = req.params.uuid;
        tvApi.endPairing(uuid, function (err, data) {
            data.body = err === null;
            defaultResponse(res, err, data);
        });
    }
});

router.get('/device/:uuid/cmd/:cmdValue', function(req, res) {
    if (req.xhr) {
        var uuid = req.params.uuid;
        var cmdValue = req.params.cmdValue;
        tvApi.sendCmd(uuid, cmdValue, function (err, data) {
            data.body = err === null;
            defaultResponse(res, err, data);
        });
    }
});

module.exports = router;
