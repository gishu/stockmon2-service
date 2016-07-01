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

            acc.getAnnualStmts((err, snapshots) => {
                var snapshot;
                expect(err).toBeNull();

                // 2 snapshots by financial year
                expect(_.map(snapshots, 'year')).toEqual([2008, 2009]);

                // only dividends in 2008
                snapshot = _.find(snapshots, { year: 2008 });
                expect(_.map(snapshot.dividends, 'stock')).toEqual(['HDFCBANK', 'L&T FIN', 'SBI', 'SBI']);
                expect(_.map(snapshot.dividends, d => d.amount.toString())).toEqual(['200', '70', '90', '90']);
               
                expect(snapshot.gains.length).toEqual(0);

                // only sales in 2009
                snapshot = _.find(snapshots, { year: 2009 });
                expect(_.map(snapshot.gains, 'stock')).toEqual(['HDFC', 'HDFCBANK']);
                expect(_.map(snapshot.gains, 'qty')).toEqual([4, 10]);
                expect(_.map(snapshot.gains, g => g.gain.toString())).toEqual(['1727.48', '5594.31']);

                expect(snapshot.dividends.length).toEqual(0);

                done();
            });


        });
    });

    it('can optimize gains computation using the last saved closing stmt', done => {
        pending('save snapshots first!')
    });
});