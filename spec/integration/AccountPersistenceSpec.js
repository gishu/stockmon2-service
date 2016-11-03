describe('AccountMapper', function () {

    var path = require('path');
    var async = require('async');
    var BigNumber = require('bignumber.js');
    var _ = require('lodash');

    var make = require('../../src/Trade.js');
    var account = require('../../src/Account.js');
    var parse = require('../../src/CsvParser.js');
    var getAccountMapper = require('../../src/dataMapper/AccountMapper.js');
    var getSnapshotMapper = require('../../src/dataMapper/SnapshotMapper.js');
    var getDatabase = require('../../src/dataMapper/Database.js');

    var helpers = require('../helpers/test_helper.js');

    var database, mapper, snapshotMapper;

    beforeEach(() => {

        database = getDatabase();
        mapper = getAccountMapper(database);
        snapshotMapper = getSnapshotMapper(database);
    });

    afterEach(done => {
        database.close(err => {
            done();
        });
    })

    it('can persists general info, trades and dividends', function (done) {

        parse(helpers.getCsvStream('sample_trades.csv'), function (err, results) {
            expect(err).toBeNull();
            var inMemAccount, fromDisk;
            inMemAccount = account.create('Mushu', 'HDFC');
            inMemAccount.register(results.trades);
            inMemAccount.addDividends(results.dividends);

            async.waterfall([
                (cb) => {
                    mapper.save(inMemAccount, (err, account) => {
                        cb(null, account);
                    });
                },
                (account, cb) => {
                    var fromDisk = mapper.load(account.id(), (err, account) => {
                        cb(err, account);
                    });
                },
                // TODO: probably belongs in Account.js
                (account, cb) => {
                    account.getAnnualStmts((err, snapshots) => {
                        cb(err, account, snapshots);
                    });
                }
            ],
                function (err, account, snapshots) {
                    var gain, snapshot;

                    if (err) {
                        done.fail(err.stack);
                        return;
                    }
                    expect(account.id()).toEqual(1);
                    expect(account.getName()).toEqual('Mushu');
                    expect(account.broker()).toEqual('HDFC');

                    snapshot = snapshots.forYear(2008);
                    var divs = snapshot.dividends();
                    expect(divs.length).toEqual(4);
                    gain = _.last(divs);
                    expect(gain.stock).toEqual('SBI');
                    expect(gain.amount).toBeWorth('90.00');

                    snapshot = snapshots.forYear(2009);
                    expect(snapshot.gains().length).toEqual(2);
                    gain = _.last(snapshot.gains());
                    expect(gain.stock).toEqual('HDFCBANK');
                    expect(gain.gain).toBeWorth('5590.46');

                    done();
                });
        });
    });

    it('ERR - cannot persist annual stmts until account has been saved once');
    it('ERR - cannot persist annual stmts until all trades and dividends are saved');
    it('Split buy into multiple sales - brokerage split')

    it('can be updated with more trades periodically', (done) => {
        async.waterfall([
            cb => {
                parse(helpers.getCsvStream('split_trades.csv'), (err, results) => cb(err, results));
            },
            (results, cb) => {
                var acc = account.create('G', 'HDFC');
                acc.register(results.trades);
                acc.addDividends(results.dividends);
                mapper.save(acc, (err, account) => {
                    cb(null, account);
                });
            },
            (acc, cb) => {
                var trades = [make.makeBuy('2014-05-14', 'TATA MOTORS', 20, '570', '123.45', '0', 'NEW'),
                make.makeBuy('2014-08-14', 'TATA MOTORS', 5, '450', '23.45', '0', 'NEW')];
                var divs = [make.makeDividend('2014-05-14', 'TATA MOTORS', '250', '0', 'NEW')];
                acc.register(trades);
                acc.addDividends(divs);
                mapper.save(acc, (err, account) => {
                    cb(null, account);
                });
            },
            (acc, cb) => acc.getHoldings((err, holdings) => cb(err, holdings))

        ],
            (err, holdings) => {
                expect(holdings.length).toEqual(1);
                expect(holdings[0].qty).toEqual(40);
                expect(holdings[0].avg_price).toBeWorth('610.13');
                done();
            }
        );
    });

    it('can retrieve all account Ids', function (done) {
        var customers = ['Obi', 'Wan', 'Kenobi'];

        async.waterfall([
            cb => {
                parse(helpers.getCsvStream('split_trades.csv'), (err, results) => cb(err, results));
            },
            (results, cb) => {
                async.eachSeries(customers,
                    function (c, callback) {

                        var acc = account.create(c, 'HDFC');
                        acc.register(results.trades);
                        acc.addDividends(results.dividends);
                        mapper.save(acc, (err, account) => {
                            callback(err); 
                        });
                    },
                    (err) => cb(err));
            },
            (cb) => {
                mapper.loadAll((err, accounts) => {
                    cb(err, accounts);
                });
            }],
            (err, accounts) => {
                if (err) {
                    done.fail(err);
                    return;
                }

                expect(accounts).toEqual([1,2,3]);
                done();
            }
        )

    })

});