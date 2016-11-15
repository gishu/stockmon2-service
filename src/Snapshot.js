var _ = require('lodash');
var BigNumber = require('./util/bignumber_std.js');
var moment = require('moment');

function makeSnapshot(year, gains, dividends, holdings) {
    
    var _year = year,
        _gains = _.cloneDeep(gains),
        _divs = _.cloneDeep(dividends),
        _holdings = _.cloneDeep(holdings),
        ZERO = new BigNumber(0);

    _gains = _.sortBy(_gains, ['date', 'stock']);

    function calcNetGain() {
        var byWayOfDivs = _.reduce(_divs, (sum, d) => sum.plus(d.amount), ZERO);
        return this.longTermGains().plus(this.shortTermGains()).plus(byWayOfDivs).minus(this.taxes());
    }

    return {
        year: () => _year,
        gains: () => _gains,
        dividends: () => _divs,
        holdings: () => _holdings,
        longTermGains: () => _(gains).reject(g => g.isShortTerm).reduce((sum, g) => sum.plus(g.gain), ZERO),
        shortTermGains: () => _(gains).filter(g => g.isShortTerm).reduce((sum, g) => sum.plus(g.gain), ZERO),
        dividendGains: () => _(dividends).reduce((sum, d) => sum.plus(d.amount), ZERO),
        brokerage: () => 0,
        taxes: function(){
            var taxableGains = this.shortTermGains();
            return (taxableGains.greaterThan(ZERO) ? taxableGains.mul(0.1545) : 0 );
        },
        netGain: calcNetGain
    };
}
function forYear(aYear) {
    return _.find(this, s => s.year() === aYear);
}
function makeSnapshots(snapshotsArray, generatedAt) {
    var wrappedArray = Object.create(snapshotsArray),
        computedOn = (generatedAt ? generatedAt : new moment());

    wrappedArray.forYear = forYear;
    wrappedArray.createdAt = () => computedOn;
    return wrappedArray;
}

module.exports = {
    snapshot: makeSnapshot,
    snapshots: makeSnapshots
};