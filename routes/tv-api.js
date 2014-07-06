var express = require('express');
var router = express.Router();
var _ = require('underscore');
var tvApi = require('lg-tv-api');

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

router.get('/registred-devices', function(req, res) {
    if (req.xhr) {
        tvApi.listRegistredDevices(function (data) {
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

router.post('/device/connect', function(req, res) {
    var uuid = req.body.deviceId;
    var key = req.body.pairingKey;
    if (req.xhr && uuid) {
        tvApi.startPairing(uuid, key, function (err, data) {
            var success = data.status == 'CONNECTED';

            if (success) {
                req.session.deviceId = data.device.uuid;
            }

            console.log('Data:', data);
            res.set('Content-Type', 'application/json');
            res.send(data);
        });
    }
    else {
        errorResponse(res);
    }
});

router.post('/device/disconnect', function(req, res) {
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
