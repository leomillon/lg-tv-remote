var BROADCAST_IP = '239.255.255.250';
var BROADCAST_PORT = 1900;
var DISCOVERY_REQ = 'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 3\r\n' +
    'ST: udap:rootservice\r\nUSER-AGENT: UDAP/2.0\r\n\r\n';
var LOCATION_KEY = 'LOCATION';

var dgram = require('dgram');
var client = dgram.createSocket('udp4');
var http = require("http");
var url = require("url");
var libxmljs = require("libxmljs");

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
    //console.log('===== RESPONSE =====');
    //console.log(data);
    //console.log('====================');

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

function sendHttpRequest(options, callback) {
    var req = http.request(options, function(res) {
        /*console.log('STATUS: ' + res.statusCode);
         console.log('HEADERS: ' + JSON.stringify(res.headers));*/
        res.setEncoding('utf8');

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
        console.log('\n\n==========ERROR==============')
        console.log('problem with request: ' + e.message);
        callback(e);
    });

    //console.log('\n\n=========REQUEST END===============');
    req.end();
}

sendDiscoveryRequest(function(discoveryData) {
    if (discoveryData != null) {
        var tvContext = buildTvContext(discoveryData);

        //console.log('tvContext :', tvContext);

        if (tvContext != null) {
            var options = {
                host: tvContext.hostname,
                port: tvContext.port,
                path: tvContext.descriptionPath,
                method: 'GET',
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'User-Agent': 'UDAP/2.0'
                }
            };
            sendHttpRequest(options, function(err, res) {
                if (err) throw err;

                var xmlResponse = libxmljs.parseXml(res);
                var tvUuid = xmlResponse.get('//uuid').text();
                var tvModelName = xmlResponse.get('//modelName').text();
                console.log('TV model name = ' + tvModelName);
                console.log('TV UUID = ' + tvUuid);
            });
        }
    }
});