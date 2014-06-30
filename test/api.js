var rewire = require("rewire");
var tvApi = rewire('../tv-api');
var expect = require('chai').expect;

function createDevices() {
    return [
        {"uuid": "testId", "name": "my-device", "pairingKey": "0000"},
        {"uuid": "testId2", "name": "another-device", "pairingKey": "0001"},
        {"uuid": "testId3", "name": "unknown-device", "pairingKey": null}
    ];
}

describe('Known devices', function () {

    before(function () {
        tvApi.__set__('knownDevices', createDevices());
    });

    describe('#listRegistredDevices', function () {
        it('should return the devices with a defined pairing key', function (done) {
            tvApi.listRegistredDevices(function (devices) {
                expect(devices)
                    .to.be.an('array')
                    .to.have.length(2);
                expect(devices).to.have.deep.property('[0].uuid', 'testId');
                expect(devices).to.have.deep.property('[1].uuid', 'testId2');
                done();
            });
        })
    });
});