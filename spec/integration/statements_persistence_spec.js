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

    describe('Annual Stmts', () => {

        var fromDisk,
            inMemAccount,
            savedAccountId,
            snapshotsToSave;



        beforeEach((done) => {
            inMemAccount = account.create('Mushu', 'HDFC');

            async.waterfall([
                (cb) => {           // load trades from CSV into account
                    parse(helpers.getCsvStream('trades_scenario2.csv'), (err, results) => {
                        if (err) {
                            cb(err, null);
                            return;
                        }
                        inMemAccount.register(results.trades);
                        inMemAccount.addDividends(results.dividends);
                        cb(null)
                    });
                },
                (cb) => {
                    mapper.save(inMemAccount, (err, account) => {
                        cb(null, account);
                    });
                },

                (account, cb) => {
                    account.getAnnualStmts((err, snapshots) => {
                        if (err) {
                            cb(err, null);
                            return;
                        }
                        cb(null, account.id(), snapshots);
                    });
                }
            ],
                (err, id, snapshots) => {
                    if (!err) {
                        savedAccountId = id;
                        snapshotsToSave = snapshots;
                        done();
                    }
                }
            );
        });

        it('can persist gains', done => {

            async.series([
                (cb) => snapshotMapper.saveSnapshots(savedAccountId, snapshotsToSave, err => cb(err)),
                (cb) => snapshotMapper.loadSnapshots(savedAccountId, (err, snapshots) => cb(err, snapshots))
            ],
                (err, results) => {
                    var snapshots = results[1];
                    if (err) { done.fail(err); }

                    expect(snapshots.length).toBeGreaterThan(0);

                    var snapshot = snapshots.forYear(2008);
                    expect(snapshot.gains().length).toBe(0);


                    snapshot = snapshots.forYear(2009);
                    var gains = _.sortBy(snapshot.gains(), 'saleId');
                    expect(_.map(gains, 'stock')).toEqual(['HDFC', 'HDFCBANK', 'SBI', 'ONGC', 'HDFC']);
                    expect(_.map(gains, 'qty')).toEqual([4, 10, 5, 10, 11]);

                    expect(_.map(gains, g => g.gain.toString())).toEqual(['1724.88', '5590.46', '5831.64', '4063.77', '10981.3']);
                    done();
                });
        });

        it('can persist closing/holding stmts', done => {
            var fromDisk = mapper.load(savedAccountId, (err, account) => {
                account.getHoldings((err, holdings) => {
                    expect(_.map(holdings, 'stock')).toEqual(["TATA ST", "VOLTAS"]);
                    expect(_.map(holdings, 'qty')).toEqual([60, 50]);
                    done();
                });

            });
        });

        it('can persist dividends', done => {
            async.series([
                cb => snapshotMapper.saveSnapshots(savedAccountId, snapshotsToSave, err => cb(err)),
                cb => snapshotMapper.loadSnapshots(savedAccountId, (err, snapshots) => cb(err, snapshots))
            ],
                (err, results) => {
                    var snapshots = results[1],
                        snapshot = snapshots.forYear(2008),
                        div = snapshot.dividends()[0];

                    expect(div.stock).toBe("SBI");
                    expect(div.amount).toBeWorth("123.00");


                    snapshot = snapshots.forYear(2009);
                    expect(snapshot.dividends().length).toBe(0);
                    done();
                });
        });

        it('can be deleted', done => {
            async.series([
                cb => snapshotMapper.saveSnapshots(savedAccountId, snapshotsToSave, err => cb(err)),
                cb => snapshotMapper.getLatestSnapshot(savedAccountId, (err, snapshot) => cb(err, snapshot)),
                cb => snapshotMapper.deleteSnapshots(savedAccountId, err => cb(err)),
                cb => snapshotMapper.getLatestSnapshot(savedAccountId, (err, snapshot) => cb(err, snapshot))
            ],
                (err, results) => {
                    if (err) {
                        done.fail(err);
                        return;
                    }

                    var latestSnapshotBeforeDelete = results[1],
                        latestSnapshotAfterDelete = results[3];

                    expect(results[1].year()).toEqual(2010);
                    expect(latestSnapshotAfterDelete).toBeNull();
                    done();
                }
            );

        });

    });
});

