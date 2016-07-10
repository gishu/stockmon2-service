describe('Account', function () {

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
        helpers.deleteDb();

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
            inMemAccount = account.create('Mushu');
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
                        done.fail(err.message);
                    }
                    expect(account.id()).toEqual(1);
                    expect(account.getName()).toEqual('Mushu');

                    snapshot = snapshots.forYear(2008);
                    var divs = snapshot.dividends();
                    expect(divs.length).toEqual(4);
                    gain = _.last(divs);
                    expect(gain.stock).toEqual('SBI');
                    expect(gain.amount.toString()).toEqual('90');

                    snapshot = snapshots.forYear(2009);
                    expect(snapshot.gains().length).toEqual(2);
                    gain = _.last(snapshot.gains());
                    expect(gain.stock).toEqual('HDFCBANK');
                    expect(gain.gain.toString()).toEqual('5590.46');

                    done();
                });
        });
    });

    it('ERR - cannot persist annual stmts until account has been saved once');
    it('ERR - cannot persist annual stmts until all trades and dividends are saved');
    it('Split buy into multiple sales - brokerage split')


});