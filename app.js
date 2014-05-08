var BROADCAST_IP = '239.255.255.250';
var BROADCAST_PORT = 1900;
var DISCOVERY_REQ = 'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 3\r\n' +
    'ST: udap:rootservice\r\nUSER-AGENT: UDAP/2.0\r\n\r\n';
var LOCATION_KEY = 'LOCATION';
var KEY_PAIRING_PATH = '/udap/api/pairing';
var CMD_PATH = '/udap/api/command';

var KEYS = {
    POWER: 1,
    NUMBER: {
        0: 2,
        1: 3,
        2: 4,
        3: 5,
        4: 6,
        5: 7,
        6: 8,
        7: 9,
        8: 10,
        9: 11
    },
    DIRECTION: {
        UP: 12,
        DOWN: 13,
        LEFT: 14,
        RIGHT: 15
    },
    OK: 20,
    HOME_MENU: 21,
    MENU_KEY: 22, // same with Home menu key
    PREVIOUS: 23, // back
    VOLUME: {
        UP: 24,
        DOWN: 25,
        MUTE: 26
    },
    CHANNEL: {
        UP: 27,
        DOWN: 28
    },
    COLOR: {
        BLUE: 29,
        GREEN: 30,
        RED: 31,
        YELLOW: 32
    },
    RECORDING: {
        PLAY: 33,
        PAUSE: 34,
        STOP: 35,
        FAST_FORWARD: 36,
        REWIND: 37,
        SKIP_FORWARD: 38,
        SKIP_BACKWARD: 39,
        RECORD: 40,
        LIST: 41
    },
    REPEAT: 42,
    LIVE_TV: 43,
    EPG: 44,
    CURRENT_PROG_INFO: 45,
    ASPECT_RATIO: 46,
    EXTERNAL_INPUT: 47,
    PIP_SEC_VIDEO: 48,
    SUBTITLE: 49, // Show and change
    PROG_LIST: 50,
    TELE_TEXT: 51,
    MARK: 52,
    '3D': {
        VIDEO: 400,
        LEFT_RIGHT: 401
    },
    DASH: 402,
    PREVIOUS_CHANNEL: 403, // flash back
    FAVORITE_CHANNEL: 404,
    QUICK_MENU: 405,
    TEXT_OPTION: 406,
    AUDIO_DESCRIPTION: 407,
    NET_CAST: 408, // same with Home menu
    ENERGY_SAVING: 409,
    AV_MODE: 410,
    SIMPLINK: 411,
    EXIT: 412,
    RESERVATION_PROG_LIST: 413,
    PIP: {
        CHANNEL: {
            UP: 414,
            DOWN: 415
        },
        SWITCH: 416 // Switching between primary/secondary video
    },
    MY_APPS: 417
}

var dgram = require('dgram');
var client = dgram.createSocket('udp4');
var http = require("http");
var url = require("url");
var libxmljs = require("libxmljs");

var tvContext = null;

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
        /*console.log('STATUS: ' + res.statusCode);
         console.log('HEADERS: ' + JSON.stringify(res.headers));*/
        res.setEncoding('utf8');

        console.log('\n\n==========HEADERS==============');
        console.log(res.headers);
        console.log('STATUS : ' + res.statusCode);

        var responseContent = '';
        res.on('data', function (chunk) {
            responseContent += chunk;
            /*console.log('\n\n===========CHUNK===============')
             console.log(chunk);*/
        });

        res.on('end', function() {
            //console.log('\n\n=========RESPONSE END===============');
            callback(null, responseContent);
        });
    });

    req.on('error', function(e) {
        console.log('\n\n==========ERROR==============');
        console.log('problem with request: ' + e.message);
        callback(e);
    });

    if (body != null) {
        req.write(body);
    }

    //console.log('\n\n=========REQUEST END===============');
    req.end();
}

function sendDisplayKeyPairingRequest(tvContext) {
    if (tvContext != null) {
        console.log('\n\n==========DISPLAY KEY PAIRING==============');
        var body = '<?xml version="1.0" encoding="utf-8"?><envelope><api type="pairing"><name>showKey</name></api></envelope>';
        sendHttpRequest(buildKeyPairingOptions(tvContext), body, function(err, res) {
            // Nothing to do
        });
    }
}

function sendStartKeyPairingRequest(tvContext, callback) {
    if (tvContext != null) {
        console.log('\n\n==========SEND START KEY PAIRING==============');
        var body = '<?xml version="1.0" encoding="utf-8"?><envelope><api type="pairing"><name>hello</name><value>941905</value><port>' + tvContext.port + '</port></api></envelope>';
        sendHttpRequest(buildKeyPairingOptions(tvContext), body, function (err, res) {
            callback();
        });
    }
}
function sendEndKeyPairingRequest(tvContext, callback) {
    if (tvContext != null) {
        console.log('\n\n==========SEND END KEY PAIRING==============');
        var body = '<?xml version="1.0" encoding="utf-8"?><envelope><api type="pairing"><name>byebye</name><port>' + tvContext.port + '</port></api></envelope>';
        sendHttpRequest(buildKeyPairingOptions(tvContext), body, function (err, res) {
            callback();
        });
    }
}

function sendCmdRequest(tvContext, cmdValue, callback) {
    if (tvContext != null) {
        console.log('\n\n==========SEND COMMAND==============');
        var body = '<?xml version="1.0" encoding="utf-8"?><envelope><api type="command"><name>HandleKeyInput</name><value>' + cmdValue + '</value></api></envelope>';
        var options = buildCmdOptions(tvContext);
        console.log(options);
        sendHttpRequest(options, body, function (err, res) {
            console.log('cmd sent');
            callback();
        });
    }
}

sendDiscoveryRequest(function(discoveryData) {
    if (discoveryData != null) {
        tvContext = buildTvContext(discoveryData);

        //console.log('tvContext :', tvContext);

        if (tvContext != null) {
            var options = buildDiscoveryOptions(tvContext);
            sendHttpRequest(options, null, function(err, res) {
                if (err) throw err;

                console.log(res);

                var xmlResponse = libxmljs.parseXml(res);
                var tvUuid = xmlResponse.get('//uuid').text();
                var tvModelName = xmlResponse.get('//modelName').text();
                console.log('TV model name = ' + tvModelName);
                console.log('TV UUID = ' + tvUuid);
                //sendDisplayKeyPairingRequest(tvContext);
                sendStartKeyPairingRequest(tvContext, function() {
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