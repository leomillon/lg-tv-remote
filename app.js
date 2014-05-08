var BROADCAST_IP = '239.255.255.250';
var BROADCAST_PORT = 1900;
var DISCOVERY_REQ = 'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 3\r\n' +
    'ST: udap:rootservice\r\nUSER-AGENT: UDAP/2.0\r\n\r\n';
var LOCATION_KEY = 'LOCATION';
var KEY_PAIRING_PATH = '/udap/api/pairing';
var CMD_PATH = '/udap/api/command';

var dgram = require('dgram');
var client = dgram.createSocket('udp4');
var http = require("http");
var url = require("url");
var libxmljs = require("libxmljs");
var KEYS = require("./keys").keys;

var tvContext = null;

function isUndefined(variable) {
    return variable === null || typeof variable === 'undefined';
}

function isDefined(variable) {
    return !isUndefined(variable);
}

function buildTvContext(discoveryData) {
    if (discoveryData != null) {
        var descriptionLocation = discoveryData[LOCATION_KEY];
        //console.log('Location is : ' + descriptionLocation);

        if (descriptionLocation != null) {
            var descriptionUrl = url.parse(descriptionLocation);

            var tvContext = {};
            tvContext.host = descriptionUrl.host;
            tvContext.hostname = descriptionUrl.hostname;
            tvContext.port = descriptionUrl.port;
            tvContext.descriptionPath = descriptionUrl.path;
            return tvContext;
        }
    }
    return null;
}

function buildDefaultOptions(tvContext, path, method) {
    return {
        host: tvContext.hostname,
        port: tvContext.port,
        path: path,
        method: method,
        headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'User-Agent': 'UDAP/2.0'
        }
    };
}

function buildDiscoveryOptions(tvContext) {
    return buildDefaultOptions(tvContext, tvContext.descriptionPath, 'GET');
}

function buildKeyPairingOptions(tvContext) {
    return buildDefaultOptions(tvContext, KEY_PAIRING_PATH, 'POST');
}

function buildCmdOptions(tvContext) {
    return buildDefaultOptions(tvContext, CMD_PATH, 'POST');
}

function sendDiscoveryRequest(callback) {
    var discoveryRequest = new Buffer(DISCOVERY_REQ);
    client.bind(1901);
    client.send(discoveryRequest, 0, discoveryRequest.length, BROADCAST_PORT, BROADCAST_IP);
    client.on('message', function(response, rinfo) {
        console.log('Response from : ' + rinfo.address + ':' + rinfo.port);
        callback(extractData(response.toString('utf-8')));
        client.close();
    });

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

    if (isDefined(body)) {
        req.write(body);
    }

    req.end();
}

function buildApiXml(apiType, apiName, param, port) {
    var doc = new libxmljs.Document();

    var apiElement = doc.node('envelope')
        .node('api').attr('type', apiType);

    if (isDefined(apiName)) {
        apiElement.node('name', apiName);
    }
    if (isDefined(param)) {
        apiElement.node('value', String(param)); // Value needs to be a String
    }
    if (isDefined(port)) {
        apiElement.node('port', String(port));
    }

    console.log('XML : ', doc.toString());

    return doc;
}

function sendDisplayKeyPairingRequest(tvContext) {
    if (tvContext != null) {
        console.log('\n\n==========DISPLAY KEY PAIRING==============');
        var body = buildApiXml('pairing', 'showKey').toString();
        sendHttpRequest(buildKeyPairingOptions(tvContext), body, function(err, res) {
            // Nothing to do
        });
    }
}

function sendStartKeyPairingRequest(tvContext, keyPairingValue, callback) {
    if (tvContext != null) {
        console.log('\n\n==========SEND START KEY PAIRING==============');
        var body = buildApiXml('pairing', 'hello', keyPairingValue, tvContext.port).toString();
        sendHttpRequest(buildKeyPairingOptions(tvContext), body, function (err, res) {
            callback();
        });
    }
}
function sendEndKeyPairingRequest(tvContext, callback) {
    if (tvContext != null) {
        console.log('\n\n==========SEND END KEY PAIRING==============');
        var body = buildApiXml('pairing', 'byebye', null, tvContext.port).toString();
        sendHttpRequest(buildKeyPairingOptions(tvContext), body, function (err, res) {
            callback();
        });
    }
}

function sendCmdRequest(tvContext, cmdValue, callback) {
    if (tvContext != null) {
        console.log('\n\n==========SEND COMMAND==============');
        var body = buildApiXml('command', 'HandleKeyInput', cmdValue).toString();
        var options = buildCmdOptions(tvContext);
        sendHttpRequest(options, body, function (err, res) {
            callback();
        });
    }
}

sendDiscoveryRequest(function(discoveryData) {
    if (discoveryData != null) {
        tvContext = buildTvContext(discoveryData);

        if (tvContext != null) {
            var options = buildDiscoveryOptions(tvContext);
            sendHttpRequest(options, null, function(err, res) {
                if (err) throw err;

                var xmlResponse = libxmljs.parseXml(res.body);
                var tvUuid = xmlResponse.get('//uuid').text();
                var tvModelName = xmlResponse.get('//modelName').text();
                console.log('TV model name = ' + tvModelName);
                console.log('TV UUID = ' + tvUuid);
                //sendDisplayKeyPairingRequest(tvContext);
                sendStartKeyPairingRequest(tvContext, '941905', function() {
                    console.log('key pairing ok');
                    sendCmdRequest(tvContext, KEYS.PROG_LIST, function() {
                        sendEndKeyPairingRequest(tvContext, function () {
                            console.log("DONE !!!!");
                        });
                    });
                });

            });
        }
    }
});