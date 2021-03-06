var fs = require('fs');
var path = require('path');
var parse = require('../../src/CsvParser.js');
var account = require('../../src/Account.js');
var make = require('../../src/Trade.js');

var _ = require('lodash');
var async = require('async');
var BigNumber = require('bignumber.js');

var helpers = require('../helpers/test_helper.js');

describe('Account (Gains)', function () {

    it('can compute long term gains', function (done) {
        async.waterfall([
            (cb) => {
                parse(helpers.getCsvStream('sample_trades.csv'), (err, results) => cb(err, results));
            },
            (results, cb) => {
                var inMemAccount = account.create('G', 'HDFC');
                inMemAccount.register(results.trades);
                inMemAccount.addDividends(results.dividends);
                inMemAccount.getAnnualStmts((err, snapshots) => cb(err, snapshots));
            }
        ],
            (err, snapshots) => {
                var snapshot, gains;
                expect(err).toBeNull();

                // 2 snapshots by financial year
                expect(_.map(snapshots, _.method('year'))).toEqual([2008, 2009]);

                // only dividends in 2008
                snapshot = _.find(snapshots, s => s.year() === 2008);
                var dividends = snapshot.dividends();
                expect(_.map(dividends, 'stock')).toEqual(['HDFCBANK', 'L&T FIN', 'SBI', 'SBI']);
                expect(_.map(dividends, d => d.amount.toString())).toEqual(['200', '70', '90', '90']);

                expect(snapshot.gains().length).toEqual(0);

                // only sales in 2009
                snapshot = _.find(snapshots, s => s.year() === 2009);
                gains = snapshot.gains();
                expect(_.map(gains, 'stock')).toEqual(['HDFC', 'HDFCBANK']);
                expect(_.map(gains, 'qty')).toEqual([4, 10]);
                expect(_.map(gains, g => g.gain.toFixed(2))).toEqual(['1724.88', '5590.46']);

                expect(snapshot.dividends().length).toEqual(0);

                done();
            }
        );
    });

    it('can differentiate short term gains (taxable) from long term gains intelligently', (done) => {

        async.waterfall([
            (cb) => {
                parse(helpers.getCsvStream('short_term_trades.csv'), (err, results) => cb(err, results));
            },

            (results, cb) => {
                var inMemAccount = account.create('G', 'HDFC');
                inMemAccount.register(results.trades);
                inMemAccount.addDividends(results.dividends);
                inMemAccount.getAnnualStmts((err, snapshots) => cb(err, snapshots));
            }
        ],
            (err, snapshots) => {
                var snapshot = _.find(snapshots, s => s.year() === 2013);
                var gains = snapshot.gains();

                expect(gains.length).toEqual(3);
                expect(_.every(gains, 'isShortTerm'));

                snapshot = _.find(snapshots, s => s.year() === 2014);

                gains = snapshot.gains();
                expect(gains.length).toEqual(5);

                var sets = _.partition(gains, g => g.isShortTerm);
                expect(sets.length).toEqual(2);

                var totalSTGain = _.reduce(sets[0], (result, g) => result.add(g.gain), new BigNumber(0));
                expect(totalSTGain).toBeWorth('-66.99');
                var shortTermGains = _.map(sets[0], g => g.date.format('YYYY-MM-DD =>') + g.qty);
                expect(shortTermGains).toEqual(['2014-04-01 =>250', '2015-01-23 =>250', '2015-02-24 =>250']);

                var totalLTGain = _.reduce(sets[1], (result, g) => result.add(g.gain), new BigNumber(0));
                expect(totalLTGain).toBeWorth('7284.79');
                var longTermGains = _.map(sets[1], g => g.date.format('YYYY-MM-DD =>') + g.qty);
                expect(longTermGains).toEqual(['2014-04-10 =>250', '2015-02-24 =>250']);

                done();
            }
        );
    });

    it('can optimize gains computation using the last saved closing stmt', done => {
        pending('save snapshots first!')
    });

    it('can report net profit/loss on an annual basis', done => {
        async.waterfall([
            (cb) => {
                parse(helpers.getCsvStream('short_term_trades.csv'), (err, results) => cb(err, results));
            },

            (results, cb) => {
                var inMemAccount = account.create('G', 'HDFC');
                inMemAccount.register(results.trades);
                inMemAccount.addDividends(results.dividends);
                inMemAccount.getAnnualStmts((err, snapshots) => cb(err, snapshots));
            }
        ],
            (err, snapshots) => {
                var snapshot = snapshots.shift();

                expect(snapshot.year()).toBe(2012);
                expect(snapshot.netGain()).toBeWorth('100.00'); // just dividends

                snapshot = snapshots.shift();
                expect(snapshot.year()).toBe(2013);
                expect(snapshot.longTermGains()).toBeWorth('0.00');
                expect(snapshot.shortTermGains()).toBeWorth('5648.25');
                expect(snapshot.netGain()).toBeWorth('4775.60'); 

                snapshot = snapshots.shift();
                expect(snapshot.year()).toBe(2014);
                expect(snapshot.longTermGains()).toBeWorth('7284.79');
                expect(snapshot.shortTermGains()).toBeWorth('-66.99');
                expect(snapshot.netGain()).toBeWorth('7217.80');

                snapshot = snapshots.shift(); // ST Gains with taxes
                expect(snapshot.year()).toBe(2015);
                expect(snapshot.taxes()).toBeWorth('334.21')
                expect(snapshot.netGain()).toBeWorth('1828.99');

                done();
            }
        );
    });

    xit('will not recompute annual statements if they are already persisted');
    

    xit('will compute brokerage as per associated broker', done => {
        async.waterfall([
            (cb) => {
                parse(helpers.getCsvStream('sample_trades.csv'), (err, results) => cb(err, results));
            },
            (results, cb) => {
                var inMemAccount = account.create('G', 'ZERODHA');
                inMemAccount.register(results.trades);
                inMemAccount.getAnnualStmts((err, snapshots) => cb(err, snapshots));
            }
        ],
            (err, snapshots) => {
                var snapshot, gains;
                expect(err).toBeNull();

                // only sales in 2009
                snapshot = snapshots.forYear(2009);
                gains = snapshot.gains();
                expect(_.map(gains, 'stock')).toEqual(['HDFC', 'HDFCBANK']);
                expect(_.map(gains, 'qty')).toEqual([4, 10]);
                expect(_.map(gains, g => g.gain.toString())).toEqual(['1837.53', '5741.04']);

                expect(snapshot.dividends().length).toEqual(0);

                done();
            }
        );
    });
});