var sqlite = require('sqlite3').verbose();
var async = require('async');
var _ = require('lodash');
var moment = require('moment');

var make = require('../Trade.js');
var makeNew = require('../Snapshot.js');
var log = require('debug')('snapMapper');

module.exports = function getSnapshotMapper(database) {

    //TODO:  can be replacedBy getSnapshotForYear(?)
    function _getLatestSnapshot(accountId, callback) {
        database.execute(db => {
            async.series([
                cb => {
                    db.get('SELECT MAX(Year) as LastYear from Statements WHERE account_id = ?', [accountId],
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
                    _loadSnapshots(accountId,
                        (err, snapshots) => {
                            callback(null, snapshots.forYear(lastYear));
                        }
                    );
                }
            )
        });
    }

    function _loadSnapshots(accountId, callback) {
        database.execute(db => {
            async.waterfall([
                (cb) => {
                    db.all('select id, year, created_at from Statements where account_id = ? order by year', [accountId],
                        (err, rows) => cb(err, rows)
                    );
                },
                (rows, cb) => {
                    var keys = _.map(rows, function (row) {
                        return {
                            'id': _.toInteger(row.id),
                            'year': _.toInteger(row.year),
                            'createdAt': moment(rows[0].created_at)
                        };
                    });

                    _loadAnnualStmtsFor(accountId, keys, (err, snapshots) => cb(err, snapshots));
                }
            ],
                (err, snapshots) => {
                    callback(err, snapshots);
                });

        });
    }

    function _loadAnnualStmtsFor(accountId, keys, callback) {
        database.execute(db => {

            async.map(keys, (key, itemCallback) => {

                async.parallel([
                    cb => {
                        db.all(
                            `select c.buy_id, c.balance, b.Date, b.Stock, b.Qty, b.Price, b.Brokerage, b.Notes
                             from StatementHoldings c
                             join Buys b ON c.buy_id = b.Id
                             where c.stmt_id = ?
                             order by c.buy_id`,
                            [key.id],
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
                            `select s.date, r.Qty, b.Stock, b.Id as BuyId, b.Price as BuyPrice, s.Id as SaleId, s.Price as SalePrice, r.Brokerage, r.Gain, r.IsShortTerm
                                from StatementGains r
                                inner join buys b on r.buy_id = b.Id
                                inner join sales s on r.sale_id = s.Id
                                where r.stmt_id = ?
                                order by r.sale_id`,
                            [key.id],
                            (err, rows) => {
                                if (err) { cb(err); return; }

                                cb(null,
                                    _.map(rows, row => make.makeGain(moment(row.Date), row.Stock, row.Qty, row.BuyId, row.BuyPrice, row.SaleId, row.SalePrice, row.Brokerage, (row.IsShortTerm !== 0))));
                            }
                        )
                    },
                    cb => {
                        db.all(
                            `select d.Date, d.Stock, d.Amount, d.Notes
                                from StatementDividends sd
                                inner join dividends d on sd.div_id = d.Id
                                where sd.stmt_id = ?
                                order by sd.div_id`,
                            [key.id],
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
                            itemCallback(null, makeNew.snapshot(key.year, results[1], results[2], results[0]));
                        }
                    }
                );

            },
                (err, results) => {
                    var generatedAt = (keys.length > 0 ? keys[0].createdAt : null);

                    callback(err, makeNew.snapshots(results, generatedAt));
                }
            );
        });

    }

    function _saveHoldings(stmtId, holdings, holdingsSavedCallback) {
        database.execute(db => {
            try {
                var insertStmt = db.prepare('insert into StatementHoldings(stmt_id, buy_id, balance) values(?,?,?)');

                async.each(_.keys(holdings), (stock, stockCallback) => {
                    var trades = holdings[stock];

                    async.each(trades, (t, tradeCallback) => {
                        var values = [stmtId, t.id, t.balance];

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
    function _saveGains(stmtId, gains, saveCallback) {
        database.execute(db => {
            try {

                var insertStmt = db.prepare('insert into StatementGains(stmt_id, Qty, buy_id, sale_id, Brokerage, Gain, IsShortTerm) values(?,?,?,?,?,?,?)');

                async.forEachOf(gains, (gain, index, gainCallback) => {
                    var values = [stmtId, gain.qty, gain.buyId, gain.saleId, gain.brokerage.toString(), gain.gain.toString(), (gain.isShortTerm ? 1 : 0)];

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
    function _saveDivvies(stmtId, dividends, saveCallback) {
        database.execute(db => {
            try {

                var insertStmt = db.prepare('insert into StatementDividends(stmt_id, div_id) values(?,?)');

                async.each(dividends, (div, divCallback) => {
                    insertStmt.run([stmtId, div.id], err => divCallback(err));
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

    // saveCallback (err) => ..
    function _saveSnapshots(accountId, snapshots, saveCallback) {
        log('Saving snapshot...');
        try {
            database.execute(db => {

                db.run('BEGIN TRANSACTION');
                // ordered keys
                async.each(snapshots, (snapshot, snapshotSavedCallback) => {
                    var INSERT_MASTER_ROW =
                        `INSERT INTO Statements (account_id, year, created_at, long_term,
                        short_term, dividends, brokerage, taxes, net_gain) VALUES (?,?,?,?,?,?,?,?,?);`;

                    async.waterfall([cb => {
                        try {
                            var args = [accountId, snapshot.year(), snapshots.createdAt().toISOString(),
                                snapshot.longTermGains().toFixed(2), snapshot.shortTermGains().toFixed(2), snapshot.dividendGains().toFixed(2),
                                snapshot.brokerage().toFixed(2), snapshot.taxes().toFixed(2), snapshot.netGain().toFixed(2)];
                            db.run(INSERT_MASTER_ROW, args, function (err) {
                                cb(err, this.lastID);
                            });
                        } catch (err) {
                            cb(err);
                        }
                    }],
                        (err, stmtId) => {
                            async.parallel([
                                cb => _saveHoldings(stmtId, snapshot.holdings(), cb),
                                cb => _saveGains(stmtId, snapshot.gains(), cb),
                                cb => _saveDivvies(stmtId, snapshot.dividends(), cb)
                            ],
                                (err, results) => {
                                    snapshotSavedCallback(err);
                                }

                            );
                        });

                },
                    (err) => {
                        log('Save snapshots ' + (err ? 'failed with' + err : 'succeeded'));
                        db.run((err ? 'ROLLBACK TRANSACTION' : 'COMMIT TRANSACTION'));
                        saveCallback(err);
                    }     // all snapshots done
                ); // each snapshot/year

            });
        } catch (err) {
            callback(err);
        }
    }

    function _deleteSnapshot(accountId, deleteCallback) {
        try {
            database.execute(db => {
                async.waterfall([
                    cb => db.run('BEGIN TRANSACTION', [], err => {
                        cb(err);
                    }),
                    cb => db.all('SELECT id from Statements where account_id = ?', [accountId], (err, rows) => {
                        var snapshotIds = _.map(rows, row => _.toInteger(row.id));
                        cb(err, snapshotIds);
                    }),
                    (snapshotIds, detailsCallback) => {
                        var deleteTasks = _.map([
                            'DELETE FROM StatementGains where stmt_id in (',
                            'DELETE FROM StatementHoldings where stmt_id in (',
                            'DELETE FROM StatementDividends where stmt_id in (',
                            'DELETE FROM Statements where id in ('],
                            (stmt) => {
                                return function (tableCallback) {
                                    db.run(stmt + snapshotIds + ');', [snapshotIds], err => tableCallback(err));
                                };
                            });

                        async.parallel(deleteTasks,
                            (err) => {
                                detailsCallback(err);
                            });
                    }
                ],
                    (err) => {
                        log('Delete snapshots ' + (err ? 'failed with' + err : 'succeeded'));
                        db.run((err ? 'ROLLBACK TRANSACTION' : 'COMMIT TRANSACTION'));
                        deleteCallback(err);
                    }
                );
            });

        } catch (err) {
            deleteCallback(err);
        }
    }

    return {
        loadSnapshots: _loadSnapshots,
        saveSnapshots: _saveSnapshots,
        getLatestSnapshot: _getLatestSnapshot,
        deleteSnapshots: _deleteSnapshot
    };
}


