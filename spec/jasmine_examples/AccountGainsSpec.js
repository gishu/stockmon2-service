var fs = require('fs');
var path = require('path');
var parse = require('../../src/CsvParser.js');
var account = require('../../src/Account.js');
var make = require('../../src/Trade.js');

var _ = require('lodash');

describe('Account', function () {
    var istream, acc;
    beforeEach(() => {
        var csv_path = path.resolve(__dirname, 'datafiles', 'sample_trades.csv');
        istream = fs.createReadStream(csv_path);
        acc = account.create('G');
    });

    it('can compute long term gains', function (done) {
        parse(istream, function (err, results) {
            expect(err).toBeNull();

            acc.register(results.trades);
            acc.addDividends(results.dividends);

            var snapshots = acc.getAnnualStmts();
           
            // 2 snapshots by financial year
            expect(_.keys(snapshots)).toEqual(['2008','2009']);
            
            // only dividends in 2008
            expect(snapshots[2008].dividends).toEqual([
                make.makeDividend('2008-07-30 00:00:00', 'HDFCBANK', '200', ''),
                make.makeDividend('2008-07-30 00:00:00', 'L&T FIN', '70', ''),
                make.makeDividend('2008-07-30 00:00:00', 'SBI', '180', 'interim')]
            );
            expect(snapshots[2008].gains.length).toEqual(0);

            // only sales in 2009
            expect(snapshots[2009].gains).toJSONEqual([
                make.makeGain('2009-09-24 00:00:00', 'HDFC', 4, '2240', '2705', '132.52'),
                make.makeGain('2009-09-24 00:00:00', 'HDFCBANK', 10, '1030', '1607.1', '176.69')
            ]);
            expect(snapshots[2009].dividends.length).toEqual(0);
            
            done();
        });
    });
});