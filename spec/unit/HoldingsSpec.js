var fs = require('fs');

var _ = require('lodash');
var async = require('async');


var parse = require('../../src/CsvParser.js');
var account = require('../../src/Account.js');
var make = require('../../src/Trade.js');
var helpers = require('../helpers/test_helper.js');


describe('Account (holdings)', function () {
    
    it('correctly handles sale split across multiple buys', function (done) {

        async.waterfall([
            cb => {
                parse( helpers.getCsvStream('split_trades.csv'), (err, results) => cb(err, results));
            },
            (results, cb) => {
                var a = account.create('G', 'HDFC');
                a.register(results.trades);
                a.addDividends(results.dividends);
                a.getHoldings((err, holdings) => cb(err, holdings));
            }

        ],
            (err, holdings) => {
                expect(holdings.length).toEqual(1);
                expect(holdings[0].qty).toEqual(15);
                expect(holdings[0].avg_price).toBeWorth('717.00');
                done();
            }
        );
    });
});

it('can optimize gains computation using the last saved closing stmt', done => {
    pending('save snapshots first!')
});
