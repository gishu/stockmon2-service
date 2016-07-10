var sqlite = require('sqlite3').verbose();
var async = require('async');
var _ = require('lodash');
var moment = require('moment');

var make = require('../Trade.js');
var makeNew = require('../Snapshot.js');
var log = require('debug')('snapMapper');

module.exports = function getSnapshotMapper(database) {
    function _getLatestSnapshot(accountId, callback) {
        database.execute(db => {
            async.series([
                cb => {
                    db.get('SELECT MAX(Year) as LastYear from Snapshot_Holdings WHERE AccountId = ?', [accountId],
                        (err, row) => {
                            cb(err, row['LastYear']);
                        })
                }
            ],
                (err, results) => {
                    if (err) {
                        callback(err);
                        return;
                    }
                    var lastYear = results[0];
                    if (!lastYear) {
                        callback(null, null);
                        return;
                    }
                    _loadSnapshots(accountId, [lastYear],
                        (err, snapshots) => {
                            callback(null, _.find(snapshots, ['year', lastYear]));
                        }
                    );
                }
            )
        });
    }
    function _loadSnapshots(accountId, years, callback) {
        database.execute(db => {
            async.map(years, (year, itemCallback) => {

                async.parallel([
                    cb => {
                        db.all(
                            'select c.BuyId, c.Balance, b.Date, b.Stock, b.Qty, b.Price, b.Brokerage, b.Notes' +
                            ' from snapshot_holdings c' +
                            ' join Buys b ON c.BuyId = b.Id' +
                            ' where c.AccountId = ? and c.Year = ?' +
                            ' order by c.BuyId', [accountId, year],
                            (err, rows) => {
                                if (err) { cb(err); return; }
                                var holdings = {};
                                _.each(rows, row => {
                                    var buy = make.loadBuy(row);
                                    var o = Object.create(buy);
                                    o.balance = row.Balance;
                                    holdings[o.stock] = holdings[o.stock] || [];
                                    holdings[o.stock].push(o);
                                });
                                cb(null, holdings);
                            });
                    },
                    cb => {
                        db.all(
                            'select r.AccountId, r.Year, r.Qty, b.Stock, b.Id as BuyId, b.Price as BuyPrice, s.Id as SaleId, s.Price as SalePrice, r.Brokerage, r.Gain, r.IsShortTerm' +
                            ' from snapshot_gains r' +
                            ' inner join buys b on r.BuyId = b.Id' +
                            ' inner join sales s on r.SaleId = s.Id' +
                            ' where r.AccountId = ? and r.Year = ?' +
                            ' order by r.SrNo', [accountId, year],
                            (err, rows) => {
                                if (err) { cb(err); return; }

                                cb(null,
                                    _.map(rows, row => make.makeGain(moment(row.Date), row.Stock, row.Qty, row.BuyId, row.BuyPrice, row.SaleId, row.SalePrice, row.Brokerage, row.Gain, (row.IsShortTerm !== 0))));
                            }
                        )
                    },
                    cb => {
                        db.all(
                            'select d.Id, d.Date, d.Stock, d.Amount, d.Notes' +
                            ' from snapshot_divs sd' +
                            ' inner join dividends d on sd.DivId = d.Id' +
                            ' where sd.AccountId = ? and sd.Year = ?' +
                            ' order by sd.DivId', [accountId, year],
                            (err, rows) => {
                                if (err) { cb(err); return; }

                                cb(null, _.map(rows, make.loadDiv));
                            }
                        )
                    }
                ],
                    (err, results) => {
                        if (err) {
                            itemCallback(err, null);

                        } else {
                            itemCallback(null, makeNew.snapshot(year, results[1], results[2], results[0]));
                        }
                    }
                );

            },
                (err, results) => {

                    callback(err, makeNew.snapshots(results));
                }
            );
        });

    }

    function _saveHoldings(accountId, year, holdings, holdingsSavedCallback) {
        database.execute(db => {
            try {
                var insertStmt = db.prepare('insert into snapshot_holdings(AccountId, Year, BuyId, Balance) values(?,?,?,?)');

                async.each(_.keys(holdings), (stock, stockCallback) => {
                    var trades = holdings[stock];

                    async.each(trades, (t, tradeCallback) => {
                        var values = [accountId, year, t.id, t.balance];

                        insertStmt.run(values, err => {
                            tradeCallback(err);
                        });
                    },
                        (err) => { stockCallback(err); } // all trades done
                    );
                },
                    (err) => {
                        insertStmt.finalize();
                        holdingsSavedCallback(err, true);
                    }      // all holdings done
                );// each holding
            } catch (err) {
                holdingsSavedCallback(err, null);
            }


        });
    }
    function _saveGains(accountId, year, gains, saveCallback) {
        database.execute(db => {
            try {
                // saleId => date, SPrice, stock
                // buyid => CPrice 
                var insertStmt = db.prepare('insert into snapshot_gains(AccountId, Year, SrNo, Qty, BuyId, SaleId, Brokerage, Gain, IsShortTerm) values(?,?,?,?,?,?,?,?,?)');

                async.forEachOf(gains, (gain, index, gainCallback) => {
                    var values = [accountId, year, index, gain.qty, gain.buyId, gain.saleId, gain.brokerage.toString(), gain.gain.toString(), (gain.isShortTerm ? 1 : 0)];

                    insertStmt.run(values, err => {
                        gainCallback(err);
                    });
                },
                    (err) => {
                        insertStmt.finalize();
                        saveCallback(err, true);
                    }
                );// all gains done
            } catch (err) {
                saveCallback(err, null);
            }
        });
    }
    function _saveDivvies(accountId, year, dividends, saveCallback) {
        database.execute(db => {
            try {
                // saleId => date, SPrice, stock
                // buyid => CPrice 
                var insertStmt = db.prepare('insert into snapshot_divs(AccountId, Year, DivId) values(?,?,?)');

                async.each(dividends, (div, divCallback) => {
                    var values = [accountId, year, div.id];

                    insertStmt.run(values, err => {
                        divCallback(err);
                    });
                },
                    (err) => {
                        insertStmt.finalize();
                        saveCallback(err, true);
                    }
                );// all gains done
            } catch (err) {
                saveCallback(err, null);
            }
        });
    }
    function _saveSnapshots(accountId, snapshots, saveCallback) {
        log('Saving snapshot...');
        try {
            database.execute(db => {
                db.run('BEGIN TRANSACTION');
                // ordered keys
                async.each(snapshots, (snapshot, snapshotSavedCallback) => {

                    async.parallel([
                        cb => _saveHoldings(accountId, snapshot.year(), snapshot.holdings(), cb),
                        cb => _saveGains(accountId, snapshot.year(), snapshot.gains(), cb),
                        cb => _saveDivvies(accountId, snapshot.year(), snapshot.dividends(), cb)
                    ],
                        (err, results) => snapshotSavedCallback(err)
                    );
                },
                    (err) => {
                        db.run((err ? 'ROLLBACK TRANSACTION' : 'COMMIT TRANSACTION'));
                        log('Done');
                        saveCallback(err);
                    }     // all snapshots done
                ); // each snapshot/year

            });
        } catch (err) {
            callback(new Error(err));
        }
    }

    return {
        loadSnapshots: _loadSnapshots,
        saveSnapshots: _saveSnapshots,
        getLatestSnapshot: _getLatestSnapshot
    };
}


