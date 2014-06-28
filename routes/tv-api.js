var express = require('express');
var router = express.Router();
var _ = require('underscore');
var tvApi = require('../tv-api');

router.get('/discovery', function(req, res) {
    if (req.xhr) {
        tvApi.discovery(function (data) {
            console.log('Data:', data);
            res.set('Content-Type', 'application/json');
            res.send(data);
        });
    }
    else {
        errorResponse(res);
    }
});

function defaultResponse(res, err, data) {
    var status = data.statusCode;
    if (err) {
        status = 500;
    }
    res.send(status, data.body);
}

function errorResponse(res) {
    res.send(500, null);
}

router.post('/device/display-key', function(req, res) {
    var uuid = req.body.deviceId;
    if (req.xhr && uuid) {
        tvApi.displayKey(uuid, function (err, data) {
            data.body = _.isNull(err);
            defaultResponse(res, err, data);
        });
    }
    else {
        errorResponse(res);
    }
});

router.post('/device/start-pairing', function(req, res) {
    var uuid = req.body.deviceId;
    var key = req.body.pairingKey;
    if (req.xhr && uuid && key) {
        tvApi.startPairing(uuid, key, function (err, data) {
            var success = _.isNull(err);

            if (success) {
                req.session.deviceId = uuid;
            }

            data.body = success;
            defaultResponse(res, err, data);
        });
    }
    else {
        errorResponse(res);
    }
});

router.post('/device/end-pairing', function(req, res) {
    var uuid = req.session.deviceId;
    if (req.xhr && uuid) {
        tvApi.endPairing(uuid, function (err, data) {
            var success = _.isNull(err);

            if (success) {
                // clear the current device id in session
                req.session.deviceId = null;
            }

            data.body = success;
            defaultResponse(res, err, data);
        });
    }
    else {
        errorResponse(res);
    }
});

router.post('/device/cmd', function(req, res) {
    var uuid = req.session.deviceId;
    var cmdValue = req.body.cmdValue;
    if (req.xhr && uuid && cmdValue) {
        tvApi.sendCmd(uuid, cmdValue, function (err, data) {
            data.body = _.isNull(err);
            defaultResponse(res, err, data);
        });
    }
    else {
        errorResponse(res);
    }
});

module.exports = router;
