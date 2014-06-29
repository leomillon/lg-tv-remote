var BROADCAST_IP = '239.255.255.250';
var BROADCAST_PORT = 1900;
var DISCOVERY_DELAY = 1000;
var DISCOVERY_REQ = 'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 3\r\n' +
    'ST: udap:rootservice\r\nUSER-AGENT: UDAP/2.0\r\n\r\n';
var LOCATION_KEY = 'LOCATION';
var KEY_PAIRING_PATH = '/udap/api/pairing';
var CMD_PATH = '/udap/api/command';

var _ = require('underscore');
var dgram = require('dgram');
var http = require("http");
var url = require("url");
var libxmljs = require("libxmljs");

var knownDevices = [];

function buildTvContext(discoveryData) {
    if (discoveryData != null) {
        var descriptionLocation = discoveryData[LOCATION_KEY];

        if (descriptionLocation != null) {
            var descriptionUrl = url.parse(descriptionLocation);

            return {
                "host": descriptionUrl.host,
                "hostname": descriptionUrl.hostname,
                "port": descriptionUrl.port,
                "descriptionPath": descriptionUrl.path
            }
        }
    }
    return null;
}

function buildDefaultOptions(device, path, method) {
    return {
        host: device.hostname,
        port: device.port,
        path: path,
        method: method,
        headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'User-Agent': 'UDAP/2.0'
        }
    };
}

function buildDescriptionOptions(device) {
    return buildDefaultOptions(device, device.descriptionPath, 'GET');
}

function buildKeyPairingOptions(device) {
    return buildDefaultOptions(device, KEY_PAIRING_PATH, 'POST');
}

function buildCmdOptions(device) {
    return buildDefaultOptions(device, CMD_PATH, 'POST');
}

function sendDiscoveryRequest(callback) {
    var discoveryRequest = new Buffer(DISCOVERY_REQ);
    var discoveryContainer = [];
    var client = dgram.createSocket('udp4');
    client.bind(1901);
    client.send(discoveryRequest, 0, discoveryRequest.length, BROADCAST_PORT, BROADCAST_IP);
    client.on('message', function(response, rinfo) {
        //console.log('Response from : ' + rinfo.address + ':' + rinfo.port);
        discoveryContainer.push(extractData(response.toString('utf-8')));
    });
    _.delay(function(callback, discoveryContainer) {
        client.close();
        callback(discoveryContainer);
    }, DISCOVERY_DELAY, callback, discoveryContainer);
}

function extractData(data) {
    console.log('===== RESPONSE =====');
    console.log(data);
    console.log('====================');

    if (data.indexOf('200 OK') != -1) {
        console.log('Discovery response with success!');
        var regex = /([A-Z-]+):( )?(.*)/g;
        var match = regex.exec(data);
        var extractedData = [];
        while (match != null) {
            extractedData[match[1]] = match[3];
            match = regex.exec(data);
        }
        return extractedData;
    }
    else {
        console.error('An error occured...');
        return null;
    }
}

function sendHttpRequest(options, body, callback) {
    var req = http.request(options, function(res) {
        res.setEncoding('utf8');

        var responseContent = '';
        res.on('data', function (chunk) {
            responseContent += chunk;
        });

        res.on('end', function() {
            res.body = responseContent;
            console.log('\n\n==========RESPONSE==============');
            console.log('Status:', res.statusCode);
            console.log('Body:');
            console.log(res.body);
            callback(null, res);
        });
    });

    req.on('error', function(e) {
        console.log('\n\n==========ERROR==============');
        console.log('problem with request: ' + e.message);
        callback(e);
    });

    if (!_.isEmpty(body)) {
        req.write(body);
    }

    req.end();
}

function buildApiXml(apiType, apiName, param, port) {
    var doc = new libxmljs.Document();

    var apiElement = doc.node('envelope')
        .node('api').attr('type', apiType);

    if (!_.isEmpty(apiName)) {
        apiElement.node('name', apiName);
    }
    if (!_.isEmpty(param)) {
        apiElement.node('value', String(param)); // Value needs to be a String
    }
    if (!_.isEmpty(port)) {
        apiElement.node('port', String(port));
    }

    console.log('XML : ', doc.toString());

    return doc;
}

function getDevice(uuid) {
    return _.findWhere(knownDevices, {"uuid": uuid});
}

function registerDevice(newDevice) {
    knownDevices = _.reject(knownDevices, function (device) {
        return device.uuid === this.uuid;
    }, { "uuid": newDevice.uuid });
    knownDevices.push(newDevice);
}

function sendDisplayKeyPairingRequest(device, callback) {
    if (!_.isNull(device)) {
        console.log('\n\n==========DISPLAY KEY PAIRING==============');
        var body = buildApiXml('pairing', 'showKey').toString();
        sendHttpRequest(buildKeyPairingOptions(device), body, callback);
    }
}

function sendStartKeyPairingRequest(device, keyPairingValue, callback) {
    if (!_.isNull(device)) {
        console.log('\n\n==========SEND START KEY PAIRING==============');
        var body = buildApiXml('pairing', 'hello', keyPairingValue, device.port).toString();
        sendHttpRequest(buildKeyPairingOptions(device), body, callback);
    }
}
function sendEndKeyPairingRequest(device, callback) {
    if (!_.isNull(device)) {
        console.log('\n\n==========SEND END KEY PAIRING==============');
        var body = buildApiXml('pairing', 'byebye', null, device.port).toString();
        sendHttpRequest(buildKeyPairingOptions(device), body, callback);
    }
}

function sendCmdRequest(device, cmdValue, callback) {
    if (!_.isNull(device)) {
        console.log('\n\n==========SEND COMMAND==============');
        var body = buildApiXml('command', 'HandleKeyInput', cmdValue).toString();
        var options = buildCmdOptions(device);
        sendHttpRequest(options, body, callback);
    }
}

function buildDeviceFromDescription(tvContext, xmlDescription) {
    var deviceUuid = xmlDescription.get('//uuid').text();
    var deviceModelName = xmlDescription.get('//modelName').text();
    var deviceFriendlyName = xmlDescription.get('//friendlyName').text();
    var deviceType = xmlDescription.get('//deviceType').text();
    console.log('Device model name = ' + deviceModelName);
    console.log('Device UUID = ' + deviceUuid);
    return {
        "name": deviceModelName,
        "friendlyName": deviceFriendlyName,
        "uuid": deviceUuid,
        "type": deviceType,
        "hostname": tvContext.hostname,
        "port": tvContext.port,
        "pairingKey": null
    };
}

function updateDevice(newDevice) {
    var uuid = newDevice.uuid;
    var knownDevice = getDevice(uuid);
    if (!_.isUndefined(knownDevice)) {
        newDevice.pairingKey = knownDevice.pairingKey;
    }
    registerDevice(newDevice);
    return newDevice;
}

function updatePairingKey(device, pairingKey) {
    if (!_.isUndefined(device)) {
        device.pairingKey = pairingKey;
    }
    else {
        console.error("Unable to save pairing key on an undefined device");
    }
}

function getSimpleDevice(device) {
    return {
        "uuid": device.uuid,
        "name": device.name,
        "friendlyName": device.friendlyName,
        "type": device.type,
        "registred": !_.isEmpty(device.pairingKey)
    };
}

function discoverDevices(callback) {
    sendDiscoveryRequest(function (discoveryContainer) {
        var finalCallback = _.after(discoveryContainer.length, callback);
        var devices = [];
        _.each(discoveryContainer, function (discoveredDevice) {
            //console.log(discoveredDevice);
            var tvContext = buildTvContext(discoveredDevice);

            if (!_.isNull(tvContext)) {
                var options = buildDescriptionOptions(tvContext);
                sendHttpRequest(options, null, function (err, res) {
                    if (_.isNull(err)) {
                        var xmlResponse = libxmljs.parseXml(res.body);

                        var discoveredDevice = buildDeviceFromDescription(tvContext, xmlResponse);
                        var updatedDevice = updateDevice(discoveredDevice);
                        devices.push(getSimpleDevice(updatedDevice));
                    }

                    finalCallback(devices);
                });
            }
            else {
                finalCallback(devices);
            }
        });
    });
}

function hasPairingKey(device) {
    return !_.isEmpty(device.pairingKey);
}

function listRegistredDevices(callback) {
    var registredDevices = _.filter(knownDevices, hasPairingKey);
    if (_.isUndefined(registredDevices)) {
        callback([]);
    }
    else {
        callback(_.map(registredDevices, function (device) {
            return getSimpleDevice(device);
        }));
    }
}

function createStatusResponse(status, device) {
    return {
        "status": status,
        "device": getSimpleDevice(device)
    };
}

module.exports.discovery = discoverDevices;

module.exports.listRegistredDevices = listRegistredDevices;

module.exports.startPairing = function (uuid, key, callback) {
    var device = getDevice(uuid);
    var keyToSend = !_.isEmpty(key) ? key : device.pairingKey;

    if (!_.isEmpty(keyToSend)) {
        sendStartKeyPairingRequest(device, keyToSend, function (err, res) {
            var status;
            if (_.isNull(err) && res.statusCode == "200") {
                updatePairingKey(device, keyToSend);
                status = 'CONNECTED';
            }
            else {
                status = 'INVALID_PAIRING_KEY';
            }
            callback(err, createStatusResponse(status, device));
        });
    }
    else {
        sendDisplayKeyPairingRequest(device, function (err) {
            callback(err, createStatusResponse('PAIRING_KEY_DISPLAYED', device));
        });
    }
};

module.exports.endPairing = function (uuid, callback) {
    var device = getDevice(uuid);
    sendEndKeyPairingRequest(device, function (err, res) {
        callback(err, res);
    });
};

module.exports.sendCmd = function (uuid, cmd, callback) {
    var device = getDevice(uuid);
    sendCmdRequest(device, cmd, function (err, res) {
        callback(err, res);
    });
};